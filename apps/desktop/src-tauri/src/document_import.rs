use anydoc::{ConvertError, Format};
use serde::Serialize;
use std::{fs, path::Path};

const DOCUMENT_IMPORT_LIMIT: u64 = 60 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedDocument {
    path: String,
    file_name: String,
    format: String,
    markdown: String,
}

fn format_label(format: Format) -> &'static str {
    match format {
        Format::Doc => "doc",
        Format::Docx => "docx",
        Format::Odt => "odt",
        Format::Pdf => "pdf",
        Format::Ppt => "ppt",
        Format::Pptx => "pptx",
        Format::Rtf => "rtf",
        Format::Epub => "epub",
        Format::Excel => "spreadsheet",
        Format::Ods => "ods",
        Format::Odp => "odp",
        Format::Csv => "csv",
    }
}

fn describe_conversion_error(error: ConvertError) -> String {
    match error {
        error @ ConvertError::NeedsOcr { .. } => format!(
            "{error}. Rack keeps document import local and will not send this PDF to a hosted OCR service."
        ),
        ConvertError::Encrypted => {
            "This document is encrypted or password-protected. Remove the protection locally before importing it.".to_string()
        }
        error @ ConvertError::Unsupported(_) => format!(
            "{error}. Choose a supported Word, PowerPoint, spreadsheet, OpenDocument, RTF, EPUB, CSV or text-based PDF file."
        ),
        error @ ConvertError::Malformed { .. } => format!(
            "{error}. The document is too damaged or incomplete for Rack to import reliably."
        ),
        error @ ConvertError::ResourceLimit { .. } => format!(
            "{error}. Rack stopped rather than importing a document that crossed the parser's safety limits."
        ),
        error @ ConvertError::MissingPart { .. } => format!(
            "{error}. A required part of the document is missing, so Rack cannot treat the conversion as complete."
        ),
        error => format!("Rack could not convert this document: {error}"),
    }
}

fn convert_bytes(path: &Path, bytes: &[u8]) -> Result<(Format, String), String> {
    let format = Format::from_bytes(bytes)
        .or_else(|| Format::from_path(path))
        .ok_or_else(|| {
            "Rack could not recognise this document format. Choose a supported Word, PowerPoint, spreadsheet, OpenDocument, RTF, EPUB, CSV or PDF file.".to_string()
        })?;

    let markdown = anydoc::to_markdown_bytes(bytes, format).map_err(describe_conversion_error)?;
    if markdown.trim().is_empty() {
        return Err(
            "The document converted without any usable text. Rack has not imported it.".to_string(),
        );
    }

    Ok((format, markdown))
}

#[tauri::command]
pub fn import_document(path: String) -> Result<ImportedDocument, String> {
    let requested = Path::new(&path);
    let metadata = fs::symlink_metadata(requested)
        .map_err(|error| format!("Could not inspect that document: {error}"))?;

    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Rack will only import an ordinary local file.".to_string());
    }
    if metadata.len() > DOCUMENT_IMPORT_LIMIT {
        return Err("That document is larger than Rack's 60 MB import limit.".to_string());
    }

    let canonical = requested
        .canonicalize()
        .map_err(|error| format!("Could not open that document: {error}"))?;
    let bytes = fs::read(&canonical)
        .map_err(|error| format!("Could not read that document: {error}"))?;
    let (format, markdown) = convert_bytes(&canonical, &bytes)?;
    let file_name = canonical
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("document")
        .to_string();

    Ok(ImportedDocument {
        path: canonical.to_string_lossy().to_string(),
        file_name,
        format: format_label(format).to_string(),
        markdown,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn csv_material_converts_to_markdown_locally() {
        let bytes = b"Name,Role\nAda,Researcher\nGrace,Engineer\n";
        let (format, markdown) =
            convert_bytes(Path::new("people.csv"), bytes).expect("CSV should convert");

        assert_eq!(format, Format::Csv);
        assert!(markdown.contains("Ada"));
        assert!(markdown.contains("Researcher"));
        assert!(markdown.contains('|'));
    }

    #[test]
    fn signature_less_csv_needs_its_file_extension() {
        let bytes = b"Name,Role\nAda,Researcher\n";
        let error = convert_bytes(Path::new("people"), bytes).expect_err("format should be unknown");

        assert!(error.contains("recognise this document format"));
    }
}
