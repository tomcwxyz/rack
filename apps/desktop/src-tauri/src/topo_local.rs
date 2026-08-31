use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{fs, path::{Path, PathBuf}, time::Duration};

const DISCOVERY_PROTOCOL: &str = "oos-local/0.1";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(3);

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

fn validate_loopback_endpoint(endpoint: &str) -> Result<(), String> {
    let port = endpoint
        .strip_prefix("http://127.0.0.1:")
        .ok_or_else(|| "TOPO local discovery did not point to a loopback HTTP endpoint.".to_owned())?;

    if port.is_empty()
        || port.contains('/')
        || port.parse::<u16>().ok().filter(|value| *value > 0).is_none()
    {
        return Err("TOPO local discovery contained an invalid loopback port.".to_owned());
    }
    Ok(())
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
    if discovery.pid == 0 || discovery.started_at.trim().is_empty() || discovery.node.name.trim().is_empty() {
        return Err("TOPO local discovery metadata is incomplete.".to_owned());
    }
    validate_loopback_endpoint(&discovery.endpoint)?;
    Ok(discovery)
}

fn read_discovery() -> Result<DiscoveryFile, String> {
    read_discovery_from(&discovery_path()?)
}

fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_connect(REQUEST_TIMEOUT)
        .timeout_read(REQUEST_TIMEOUT)
        .timeout_write(REQUEST_TIMEOUT)
        .build()
}

fn response_json(response: ureq::Response) -> Result<Value, String> {
    response
        .into_json::<Value>()
        .map_err(|error| format!("TOPO local endpoint returned invalid JSON: {error}"))
}

fn get_capabilities(discovery: &DiscoveryFile) -> Result<Value, String> {
    let url = format!("{}/v0/capabilities", discovery.endpoint);
    let response = agent()
        .get(&url)
        .set("Authorization", &format!("Bearer {}", discovery.token))
        .call()
        .map_err(|error| format!("TOPO local endpoint is unavailable: {error}"))?;
    response_json(response)
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
    let url = format!("{}/v0/context", discovery.endpoint);
    let response = agent()
        .post(&url)
        .set("Authorization", &format!("Bearer {}", discovery.token))
        .send_json(json!({
            "subject": subject,
            "purpose": purpose,
            "requested_by": "rack",
            "wanted": {
                "max_items": max_items
            }
        }))
        .map_err(|error| format!("TOPO context request failed: {error}"))?;

    response_json(response)
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

    #[test]
    fn only_loopback_discovery_is_accepted() {
        assert!(validate_loopback_endpoint("http://127.0.0.1:49152").is_ok());
        assert!(validate_loopback_endpoint("http://localhost:49152").is_err());
        assert!(validate_loopback_endpoint("http://192.168.1.10:49152").is_err());
        assert!(validate_loopback_endpoint("https://127.0.0.1:49152").is_err());
        assert!(validate_loopback_endpoint("http://127.0.0.1:49152/other").is_err());
    }

    #[test]
    fn discovery_requires_private_permissions_on_unix() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("oos-local.json");
        fs::write(&path, serde_json::to_vec(&discovery("http://127.0.0.1:49152")).unwrap()).unwrap();

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).unwrap();
            assert!(read_discovery_from(&path).unwrap_err().contains("permissions"));
            fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
            assert!(read_discovery_from(&path).is_ok());
        }
    }
}
