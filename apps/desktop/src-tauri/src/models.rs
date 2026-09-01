use serde::{Deserialize, Serialize};

pub const PROFILE_REGISTRY_VERSION: u8 = 1;
pub const BRIDGE_VERSION: u8 = 2;

fn is_false(value: &bool) -> bool {
    !*value
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SavedProfile {
    pub id: String,
    pub user_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tenant_slug: Option<String>,
    pub name: String,
    pub email: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub initials: Option<String>,
    pub created_at: String,
    pub last_used_at: String,
    pub webview_context_id: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProfileRegistry {
    pub version: u8,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_used_profile_id: Option<String>,
    pub profiles: Vec<SavedProfile>,
    #[serde(default, skip_serializing_if = "is_false")]
    pub recovered_from_corruption: bool,
}

impl Default for ProfileRegistry {
    fn default() -> Self {
        Self {
            version: PROFILE_REGISTRY_VERSION,
            last_used_profile_id: None,
            profiles: Vec::new(),
            recovered_from_corruption: false,
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProfileMetadataInput {
    pub schema_version: u8,
    pub profile_id: String,
    pub user_id: String,
    pub tenant_id: Option<String>,
    pub tenant_slug: Option<String>,
    pub name: String,
    pub email: String,
    pub avatar_url: Option<String>,
    pub initials: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DesktopReadyInput {
    pub schema_version: u8,
    pub profile_id: String,
    pub state: RemoteSessionState,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum RemoteSessionState {
    Authenticated,
    NeedsAuth,
    Mfa,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteReadyPayload {
    pub profile_id: String,
    pub state: RemoteSessionState,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreparedProfile {
    pub profile_id: String,
    pub existing: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReleasePolicy {
    pub schema_version: u8,
    pub channel: String,
    pub minimum_supported_version: String,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopUpdateState {
    pub kind: UpdateKind,
    pub current_version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latest_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub minimum_supported_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    pub policy_source: PolicySource,
    pub update_available: bool,
    pub can_continue_without_update: bool,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum UpdateKind {
    None,
    Optional,
    Mandatory,
    Unavailable,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PolicySource {
    Network,
    Cache,
    None,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProgressPayload {
    pub downloaded: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total: Option<u64>,
    pub phase: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}
