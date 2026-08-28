use crate::{oauth::OAuthManager, profile_registry::ProfileRegistryStore, updater::UpdateManager};
use std::sync::Mutex;

#[derive(Clone, Debug)]
pub struct ActiveProfile {
    pub profile_id: String,
    pub webview_label: String,
    pub existing: bool,
    pub ready: bool,
}

pub struct DesktopRuntime {
    pub profiles: ProfileRegistryStore,
    pub active: Mutex<Option<ActiveProfile>>,
    pub updater: UpdateManager,
    pub oauth: OAuthManager,
}

impl DesktopRuntime {
    pub fn new(profiles: ProfileRegistryStore, updater: UpdateManager) -> Self {
        Self {
            profiles,
            active: Mutex::new(None),
            updater,
            oauth: OAuthManager::default(),
        }
    }
}
