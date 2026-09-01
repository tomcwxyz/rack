use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    fs,
    io::{Read, Write},
    net::{IpAddr, Ipv4Addr, SocketAddr, TcpStream},
    path::{Path, PathBuf},
    time::Duration,
};

const DISCOVERY_PROTOCOL: &str = "oos-local/0.1";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(3);
const MAX_RESPONSE_BYTES: u64 = 2 * 1024 * 1024;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DiscoveryFile {
    protocol: String,
    node: DiscoveryNode,
    endpoint: String,
    token: String,
    pid: u32,
    started_at: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct DiscoveryNode {
    id: String,
    name: String,
    version: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TopoLocalStatus {
    available: bool,
    state: &'static str,
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

fn read_discovery_optional_from(path: &Path) -> Result<Option<DiscoveryFile>, String> {
    match fs::symlink_metadata(path) {
        Ok(_) => read_discovery_from(path).map(Some),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("Could not inspect TOPO local discovery: {error}")),
    }
}

fn read_discovery_optional() -> Result<Option<DiscoveryFile>, String> {
    read_discovery_optional_from(&discovery_path()?)
}

fn read_discovery() -> Result<DiscoveryFile, String> {
    read_discovery_optional()?.ok_or_else(|| {
        "TOPO local discovery is unavailable. Open TOPO and allow local tools.".to_owned()
    })
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

fn capability_state(capabilities: &Value) -> &'static str {
    let sharing_enabled = capabilities
        .get("extensions")
        .and_then(Value::as_object)
        .and_then(|extensions| extensions.get("sharing_enabled"))
        .and_then(Value::as_bool);

    if sharing_enabled == Some(false) {
        return "sharing-off";
    }

    let provides_context = capabilities
        .get("queries")
        .and_then(Value::as_array)
        .is_some_and(|items| items.iter().any(|item| item.as_str() == Some("context")));

    if provides_context {
        "connected"
    } else {
        "unsupported"
    }
}

#[tauri::command]
pub fn topo_local_status() -> Result<TopoLocalStatus, String> {
    let discovery = match read_discovery_optional() {
        Ok(Some(discovery)) => discovery,
        Ok(None) => {
            return Ok(TopoLocalStatus {
                available: false,
                state: "not-running",
                node_id: None,
                version: None,
                message: "TOPO is not sharing local connection information yet.".to_owned(),
            })
        }
        Err(error) => {
            return Ok(TopoLocalStatus {
                available: false,
                state: "discovery-error",
                node_id: None,
                version: None,
                message: error,
            })
        }
    };

    match get_capabilities(&discovery) {
        Ok(capabilities) => match capability_state(&capabilities) {
            "sharing-off" => Ok(TopoLocalStatus {
                available: false,
                state: "sharing-off",
                node_id: Some(discovery.node.id),
                version: Some(discovery.node.version),
                message: "TOPO is open. Allow local tools in TOPO and Rack will connect automatically.".to_owned(),
            }),
            "connected" => Ok(TopoLocalStatus {
                available: true,
                state: "connected",
                node_id: Some(discovery.node.id),
                version: Some(discovery.node.version),
                message: "TOPO local context is available.".to_owned(),
            }),
            _ => Ok(TopoLocalStatus {
                available: false,
                state: "unsupported",
                node_id: Some(discovery.node.id),
                version: Some(discovery.node.version),
                message: "TOPO is open but this version does not offer local context to Rack.".to_owned(),
            }),
        },
        Err(error) => Ok(TopoLocalStatus {
            available: false,
            state: "unreachable",
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
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
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
    #[test]
    fn missing_discovery_is_not_treated_as_invalid_discovery() {
        let directory = test_directory();
        let path = directory.join("oos-local.json");
        assert!(read_discovery_optional_from(&path).unwrap().is_none());
    }

    #[test]
    fn capability_state_distinguishes_permission_support_and_connection() {
        assert_eq!(
            capability_state(&json!({
                "queries": ["context"],
                "extensions": { "sharing_enabled": false }
            })),
            "sharing-off"
        );
        assert_eq!(
            capability_state(&json!({
                "queries": ["status"],
                "extensions": { "sharing_enabled": true }
            })),
            "unsupported"
        );
        assert_eq!(
            capability_state(&json!({
                "queries": ["context"],
                "extensions": { "sharing_enabled": true }
            })),
            "connected"
        );
    }

    #[test]
    fn loopback_request_uses_current_token_and_purpose_bound_body() {
        use std::net::TcpListener;
        use std::thread;

        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let token = "b".repeat(64);
        let expected_token = token.clone();

        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(2)))
                .unwrap();

            let mut buffer = [0_u8; 8192];
            let read = stream.read(&mut buffer).unwrap();
            let request = String::from_utf8_lossy(&buffer[..read]);

            assert!(request.starts_with("POST /v0/context HTTP/1.1"));
            assert!(request.contains(&format!(
                "Authorization: Bearer {expected_token}"
            )));
            assert!(request.contains("\"subject\":\"project:rack\""));
            assert!(request.contains("\"purpose\":\"prepare implementation\""));

            let body = r#"{"ok":true}"#;
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            );
            stream.write_all(response.as_bytes()).unwrap();
            stream.flush().unwrap();
        });

        let mut local = discovery(&format!("http://127.0.0.1:{port}"));
        local.token = token;
        let result = http_json(
            &local,
            "POST",
            "/v0/context",
            Some(&json!({
                "subject": "project:rack",
                "purpose": "prepare implementation"
            })),
        )
        .unwrap();

        assert_eq!(result, json!({ "ok": true }));
        server.join().unwrap();
    }

}
