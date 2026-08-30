# Rack document import

**Status:** implemented first slice  
**Date:** 30 August 2026

Rack can use existing local documents as a starting point for context.

## Product rule

Imported documents are **source/reference material**, not `PracticeSource`s.

A document can contain useful facts, language, constraints or background without being an instruction that should automatically govern AI behaviour. Import therefore follows this sequence:

```text
local document
    |
    v
Anydoc conversion
    |
    v
editable Markdown preview
    |
    v
user chooses where to use it
    |
    v
ordinary Rack context
    |
    v
existing Rack review / source diff
```

Only explicit Rack instructions participate in practice authority and resolution.

## Local boundary

The desktop backend uses the pinned Rust `anydoc` crate. Conversion is local and has no hosted OCR fallback.

If a PDF contains scanned or image-only pages, the import stops and explains that OCR is required. Rack does not send the file to Firecrawl or another service.

The first slice accepts Word, PowerPoint, spreadsheets, OpenDocument, RTF, EPUB, CSV and text-based PDF files up to 60 MB.

## UX

The importer is available:

- while creating a Rack, for the main organisation/project context field;
- while maintaining an existing context instruction.

The converted Markdown is editable before it is applied. Existing Rack review remains in place before source is written.
