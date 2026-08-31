use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    fs,
    io::{Read, Write},
    net::{IpAddr, Ipv4Addr, SocketAddr, TcpStream},
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

const DISCOVERY_PROTOCOL: &str = "oos-local/0.1";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(3);
const MAX_RESPONSE_BYTES: u64 = 2 * 1024 * 1024;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DiscoveryFile {
    protocol: String,
    node: DiscoveryNode,
    endpoint: String,
    token: String,
    pid: u32,
    started_at: String,
}

#[derive(Debug, Clone, Deserialize)]
struct DiscoveryNode {
    id: String,
    name: String,
    version: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopoLocalStatus {
    available: bool,
    node_id: Option<String>,
    version: Option<String>,
    message: String,
}

fn discovery_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "Could not locate your home folder.".to_owned())?;
    Ok(home.join(".topo").join("oos-local.json"))
}

fn loopback_port(endpoint: &str) -> Result<u16, String> {
    let port = endpoint
        .strip_prefix("http://127.0.0.1:")
        .ok_or_else(|| "TOPO local discovery did not point to a loopback HTTP endpoint.".to_owned())?;

    if port.is_empty() || port.contains('/') {
        return Err("TOPO local discovery contained an invalid loopback port.".to_owned());
    }

    port.parse::<u16>()
        .ok()
        .filter(|value| *value > 0)
        .ok_or_else(|| "TOPO local discovery contained an invalid loopback port.".to_owned())
}

fn read_discovery_from(path: &Path) -> Result<DiscoveryFile, String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("TOPO local discovery is unavailable: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("TOPO local discovery is not an ordinary file.".to_owned());
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if metadata.permissions().mode() & 0o077 != 0 {
            return Err("TOPO local discovery permissions are too broad.".to_owned());
        }
    }

    let content = fs::read_to_string(path)
        .map_err(|error| format!("Could not read TOPO local discovery: {error}"))?;
    let discovery: DiscoveryFile = serde_json::from_str(&content)
        .map_err(|error| format!("TOPO local discovery is invalid JSON: {error}"))?;

    if discovery.protocol != DISCOVERY_PROTOCOL {
        return Err(format!(
            "Unsupported TOPO local discovery protocol: {}",
            discovery.protocol
        ));
    }
    if discovery.node.id != "topo" {
        return Err("The discovered local node is not TOPO.".to_owned());
    }
    if discovery.token.len() < 32 {
        return Err("TOPO local discovery token is invalid.".to_owned());
    }
    if discovery.pid == 0
        || discovery.started_at.trim().is_empty()
        || discovery.node.name.trim().is_empty()
    {
        return Err("TOPO local discovery metadata is incomplete.".to_owned());
    }
    loopback_port(&discovery.endpoint)?;
    Ok(discovery)
}

fn read_discovery() -> Result<DiscoveryFile, String> {
    read_discovery_from(&discovery_path()?)
}

fn http_json(
    discovery: &DiscoveryFile,
    method: &str,
    path: &str,
    body: Option<&Value>,
) -> Result<Value, String> {
    let port = loopback_port(&discovery.endpoint)?;
    let address = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), port);
    let mut stream = TcpStream::connect_timeout(&address, REQUEST_TIMEOUT)
        .map_err(|error| format!("TOPO local endpoint is unavailable: {error}"))?;
    stream
        .set_read_timeout(Some(REQUEST_TIMEOUT))
        .map_err(|error| format!("Could not configure TOPO read timeout: {error}"))?;
    stream
        .set_write_timeout(Some(REQUEST_TIMEOUT))
        .map_err(|error| format!("Could not configure TOPO write timeout: {error}"))?;

    let body_text = body
        .map(serde_json::to_string)
        .transpose()
        .map_err(|error| format!("Could not encode TOPO request: {error}"))?
        .unwrap_or_default();
    let request = format!(
        "{method} {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nAuthorization: Bearer {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        discovery.token,
        body_text.len(),
        body_text,
    );
    stream
        .write_all(request.as_bytes())
        .map_err(|error| format!("Could not send TOPO local request: {error}"))?;
    stream
        .flush()
        .map_err(|error| format!("Could not finish TOPO local request: {error}"))?;

    let mut response = Vec::new();
    stream
        .take(MAX_RESPONSE_BYTES + 1)
        .read_to_end(&mut response)
        .map_err(|error| format!("Could not read TOPO local response: {error}"))?;
    if response.len() as u64 > MAX_RESPONSE_BYTES {
        return Err("TOPO local response exceeded Rack's 2 MiB limit.".to_owned());
    }

    let text = String::from_utf8(response)
        .map_err(|error| format!("TOPO local response was not UTF-8: {error}"))?;
    let (headers, body) = text
        .split_once("\r\n\r\n")
        .ok_or_else(|| "TOPO local endpoint returned an invalid HTTP response.".to_owned())?;
    let status = headers
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|value| value.parse::<u16>().ok())
        .ok_or_else(|| "TOPO local endpoint returned an invalid HTTP status.".to_owned())?;

    if !(200..300).contains(&status) {
        return Err(format!(
            "TOPO local endpoint returned HTTP {status}: {}",
            body.trim()
        ));
    }

    serde_json::from_str(body)
        .map_err(|error| format!("TOPO local endpoint returned invalid JSON: {error}"))
}

fn get_capabilities(discovery: &DiscoveryFile) -> Result<Value, String> {
    http_json(discovery, "GET", "/v0/capabilities", None)
}

#[tauri::command]
pub fn topo_local_status() -> Result<TopoLocalStatus, String> {
    let discovery = match read_discovery() {
        Ok(discovery) => discovery,
        Err(error) => {
            return Ok(TopoLocalStatus {
                available: false,
                node_id: None,
                version: None,
                message: error,
            })
        }
    };

    match get_capabilities(&discovery) {
        Ok(capabilities) => {
            let provides_context = capabilities
                .get("queries")
                .and_then(Value::as_array)
                .is_some_and(|items| items.iter().any(|item| item.as_str() == Some("context")));
            if !provides_context {
                return Ok(TopoLocalStatus {
                    available: false,
                    node_id: Some(discovery.node.id),
                    version: Some(discovery.node.version),
                    message: "TOPO is running but does not advertise context queries.".to_owned(),
                });
            }

            Ok(TopoLocalStatus {
                available: true,
                node_id: Some(discovery.node.id),
                version: Some(discovery.node.version),
                message: "TOPO local context is available.".to_owned(),
            })
        }
        Err(error) => Ok(TopoLocalStatus {
            available: false,
            node_id: Some(discovery.node.id),
            version: Some(discovery.node.version),
            message: error,
        }),
    }
}

#[tauri::command(rename_all = "camelCase")]
pub fn topo_local_context(
    subject: String,
    purpose: String,
    max_items: usize,
) -> Result<Value, String> {
    if subject.trim().is_empty() || purpose.trim().is_empty() {
        return Err("Subject and purpose are required for TOPO context.".to_owned());
    }
    if !(1..=100).contains(&max_items) {
        return Err("maxItems must be between 1 and 100.".to_owned());
    }

    let discovery = read_discovery()?;
    http_json(
        &discovery,
        "POST",
        "/v0/context",
        Some(&json!({
            "subject": subject,
            "purpose": purpose,
            "requested_by": "rack",
            "wanted": {
                "max_items": max_items
            }
        })),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn discovery(endpoint: &str) -> DiscoveryFile {
        DiscoveryFile {
            protocol: DISCOVERY_PROTOCOL.to_owned(),
            node: DiscoveryNode {
                id: "topo".to_owned(),
                name: "TOPO".to_owned(),
                version: "0.1.0-test".to_owned(),
            },
            endpoint: endpoint.to_owned(),
            token: "a".repeat(64),
            pid: 123,
            started_at: "2026-08-31T09:00:00Z".to_owned(),
        }
    }

    fn test_directory() -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("rack-topo-local-{}-{nonce}", std::process::id()))
    }

    #[test]
    fn only_loopback_discovery_is_accepted() {
        assert!(loopback_port("http://127.0.0.1:49152").is_ok());
        assert!(loopback_port("http://localhost:49152").is_err());
        assert!(loopback_port("http://192.168.1.10:49152").is_err());
        assert!(loopback_port("https://127.0.0.1:49152").is_err());
        assert!(loopback_port("http://127.0.0.1:49152/other").is_err());
    }

    #[test]
    fn discovery_requires_private_permissions_on_unix() {
        let directory = test_directory();
        fs::create_dir_all(&directory).unwrap();
        let path = directory.join("oos-local.json");
        fs::write(
            &path,
            serde_json::to_vec(&discovery("http://127.0.0.1:49152")).unwrap(),
        )
        .unwrap();

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).unwrap();
            assert!(read_discovery_from(&path).unwrap_err().contains("permissions"));
            fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
            assert!(read_discovery_from(&path).is_ok());
        }

        let _ = fs::remove_dir_all(directory);
    }
}
