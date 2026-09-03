use crate::{
    call_manager::CallManager, close_manager::CloseManager, credentials::CredentialManager,
    oauth::OAuthManager, preferences::PreferencesStore, profile_registry::ProfileRegistryStore,
    updater::UpdateManager, window_state::MainWindowStateManager,
};
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
    pub preferences: PreferencesStore,
    pub close: CloseManager,
    pub calls: CallManager,
    pub credentials: CredentialManager,
    pub main_window: MainWindowStateManager,
}

impl DesktopRuntime {
    pub fn new(
        profiles: ProfileRegistryStore,
        updater: UpdateManager,
        preferences: PreferencesStore,
        main_window: MainWindowStateManager,
    ) -> Self {
        let close = CloseManager::new(preferences.load_close_behavior());
        Self {
            profiles,
            active: Mutex::new(None),
            updater,
            oauth: OAuthManager::default(),
            preferences,
            close,
            calls: CallManager::new(),
            credentials: CredentialManager::new(),
            main_window,
        }
    }
}
