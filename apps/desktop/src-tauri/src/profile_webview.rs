use crate::{models::BRIDGE_VERSION, profile_registry::ProfileRegistryStore};
use serde_json::json;
use std::{fs, path::PathBuf};
use tauri::{
    utils::config::WebviewUrl,
    webview::{NewWindowResponse, WebviewWindow, WebviewWindowBuilder},
    AppHandle, Manager, Runtime,
};
use tauri_plugin_opener::OpenerExt;
use url::Url;

pub const REMOTE_ORIGIN: &str = "https://app.doflow.it";

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ProfileWebViewContext {
    #[cfg(target_os = "windows")]
    WindowsDataDirectory(PathBuf),
    #[cfg(any(target_os = "macos", target_os = "ios"))]
    AppleDataStoreIdentifier([u8; 16]),
}

impl ProfileWebViewContext {
    pub fn for_profile(store: &ProfileRegistryStore, profile_id: &str) -> Result<Self, String> {
        let uuid = crate::profile_registry::validate_opaque_id(profile_id)
            .map_err(|error| error.to_string())?;
        #[cfg(target_os = "windows")]
        {
            let _ = uuid;
            let data_dir = store
                .webview_dir(profile_id)
                .map_err(|error| error.to_string())?;
            return Ok(Self::WindowsDataDirectory(data_dir));
        }
        #[cfg(any(target_os = "macos", target_os = "ios"))]
        {
            return Ok(Self::AppleDataStoreIdentifier(*uuid.as_bytes()));
        }
        #[allow(unreachable_code)]
        Err(format!("profile context is unsupported for {uuid}"))
    }
}

pub fn remote_label(profile_id: &str) -> String {
    format!("remote-{profile_id}")
}

pub fn create_remote_webview<R: Runtime>(
    app: &AppHandle<R>,
    store: &ProfileRegistryStore,
    profile_id: &str,
) -> Result<WebviewWindow<R>, String> {
    close_remote_webviews(app, None);
    let context = ProfileWebViewContext::for_profile(store, profile_id)?;
    #[cfg(target_os = "windows")]
    {
        let ProfileWebViewContext::WindowsDataDirectory(path) = &context;
        fs::create_dir_all(path).map_err(|_| "unable to create profile WebView directory")?;
    }
    let label = remote_label(profile_id);
    let url = Url::parse(REMOTE_ORIGIN).map_err(|_| "invalid Doflow application URL")?;
    let profile_email = store
        .load()
        .ok()
        .and_then(|registry| {
            registry
                .profiles
                .into_iter()
                .find(|profile| profile.id == profile_id)
        })
        .map(|profile| profile.email);
    let script = initialization_script(
        profile_id,
        &app.package_info().version.to_string(),
        profile_email.as_deref(),
    );
    let navigation_app = app.clone();
    let new_window_app = app.clone();

    let mut builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::External(url))
        .title("Doflow")
        .inner_size(1180.0, 760.0)
        .min_inner_size(760.0, 560.0)
        .resizable(true)
        .decorations(true)
        .background_color(tauri::window::Color(5, 7, 14, 255))
        .initialization_script(script)
        .on_navigation(move |url| {
            if is_allowed_doflow_navigation(url) {
                true
            } else {
                open_external_if_safe(&navigation_app, url);
                false
            }
        })
        .on_new_window(move |url, _features| {
            open_external_if_safe(&new_window_app, &url);
            NewWindowResponse::Deny
        });

    #[cfg(target_os = "windows")]
    {
        // WebView2 stalls when the document-start bridge is combined with a controller
        // created hidden. Build below the bootstrap, then hide it before navigation starts.
        builder = builder
            .visible(true)
            .center()
            .focused(false)
            .always_on_bottom(true)
            .skip_taskbar(true);
    }
    #[cfg(not(target_os = "windows"))]
    {
        builder = builder.visible(false).center();
    }

    match context {
        #[cfg(target_os = "windows")]
        ProfileWebViewContext::WindowsDataDirectory(path) => {
            builder = builder.data_directory(path);
        }
        #[cfg(any(target_os = "macos", target_os = "ios"))]
        ProfileWebViewContext::AppleDataStoreIdentifier(identifier) => {
            builder = builder.data_store_identifier(identifier);
        }
    }

    let window = builder
        .build()
        .map_err(|_| "unable to create the Doflow WebView")?;
    #[cfg(target_os = "windows")]
    {
        window
            .hide()
            .map_err(|_| "unable to hide the prepared Doflow WebView")?;
        window
            .set_always_on_bottom(false)
            .map_err(|_| "unable to restore the prepared Doflow window level")?;
    }
    Ok(window)
}

pub fn close_remote_webviews<R: Runtime>(app: &AppHandle<R>, keep: Option<&str>) {
    for (label, window) in app.webview_windows() {
        if label.starts_with("remote-") && keep != Some(label.as_str()) {
            let _ = window.destroy();
        }
    }
}

pub fn is_allowed_doflow_navigation(url: &Url) -> bool {
    (url.scheme() == "https" && url.host_str() == Some("app.doflow.it") && url.port().is_none())
        || url.as_str() == "about:blank"
}

fn open_external_if_safe<R: Runtime>(app: &AppHandle<R>, url: &Url) {
    let allowed = match url.scheme() {
        "https" | "mailto" | "tel" => true,
        "http" => url.host_str().is_some_and(|host| {
            host.eq_ignore_ascii_case("127.0.0.1") || host.eq_ignore_ascii_case("[::1]")
        }),
        _ => false,
    };
    if allowed {
        let _ = app.opener().open_url(url.as_str(), None::<&str>);
    }
}

fn initialization_script(
    profile_id: &str,
    app_version: &str,
    profile_email: Option<&str>,
) -> String {
    let profile = serde_json::to_string(profile_id).expect("profile id serializes");
    let version = serde_json::to_string(app_version).expect("version serializes");
    let bridge = json!(BRIDGE_VERSION).to_string();
    let email = serde_json::to_string(&profile_email).expect("optional email serializes");
    format!(
        r#"
(() => {{
  if (window.top !== window || window.location.origin !== 'https://app.doflow.it') return;
  const internals = window.__TAURI_INTERNALS__;
  if (!internals || typeof internals.invoke !== 'function') return;
  const profileId = {profile};
  const schemaVersion = {bridge};
  let lastReadyState;
  const signalDesktopReady = (state) => {{
    if (lastReadyState === state) return Promise.resolve();
    lastReadyState = state;
    return internals.invoke('desktop_ready', {{ input: {{ schemaVersion, profileId, state }} }})
      .catch((error) => {{ lastReadyState = undefined; throw error; }});
  }};
  const context = Object.freeze({{
    isDesktop: true,
    platform: 'windows',
    appVersion: {version},
    bridgeVersion: {bridge},
    profileId,
    profileEmail: {email},
    desktopReady: signalDesktopReady,
    registerProfileMetadata: (metadata) => internals.invoke('register_profile_metadata', {{ input: {{ ...metadata, schemaVersion, profileId }} }}),
    requestProfileSwitch: () => internals.invoke('request_profile_switch'),
    getUpdateState: () => internals.invoke('get_update_state'),
    installCurrentVerifiedUpdate: () => internals.invoke('install_current_verified_update'),
    startDesktopGoogleOAuth: () => internals.invoke('start_desktop_google_oauth', {{ input: {{ schemaVersion, profileId }} }}),
    getDesktopCallCapabilities: () => internals.invoke('get_desktop_call_capabilities'),
    showIncomingDesktopCall: (call) => internals.invoke('show_incoming_desktop_call', {{ input: {{ schemaVersion, call }} }}),
    dismissIncomingDesktopCall: (sessionId) => internals.invoke('dismiss_incoming_desktop_call', {{ input: {{ schemaVersion, sessionId }} }}),
    openDesktopCall: (call, credentials) => internals.invoke('open_desktop_call', {{ input: {{ schemaVersion, call, credentials }} }}),
    updateDesktopCallCredentials: (sessionId, credentials) => internals.invoke('update_desktop_call_credentials', {{ input: {{ schemaVersion, sessionId, credentials }} }}),
    closeDesktopCall: (sessionId) => internals.invoke('close_desktop_call', {{ input: {{ schemaVersion, sessionId }} }}),
    onDesktopCallAction: (handler) => {{
      if (typeof handler !== 'function') throw new TypeError('Desktop call action handler must be a function');
      const listener = (event) => {{
        const detail = event && event.detail;
        if (!detail || typeof detail.sessionId !== 'string' || typeof detail.action !== 'string') return;
        handler(Object.freeze({{ ...detail }}));
      }};
      window.addEventListener('doflow:desktop-call-action', listener);
      return () => window.removeEventListener('doflow:desktop-call-action', listener);
    }}
  }});
  Object.defineProperty(window, '__DOFLOW_DESKTOP__', {{ value: context, writable: false, configurable: false }});
  const signalLoadedLogin = () => {{
    if (window.location.origin === 'https://app.doflow.it' && window.location.pathname === '/login') {{
      void signalDesktopReady('needs-auth').catch(() => undefined);
    }}
  }};
  if (document.readyState === 'loading') {{
    document.addEventListener('DOMContentLoaded', signalLoadedLogin, {{ once: true }});
  }} else {{
    signalLoadedLogin();
  }}
}})();
"#
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    use uuid::Uuid;

    #[test]
    fn profile_contexts_use_distinct_windows_data_directories() {
        let temp = TempDir::new().unwrap();
        let store = ProfileRegistryStore::new(temp.path().join("Doflow"));
        let first = Uuid::new_v4().to_string();
        let second = Uuid::new_v4().to_string();
        let first_context = ProfileWebViewContext::for_profile(&store, &first).unwrap();
        let second_context = ProfileWebViewContext::for_profile(&store, &second).unwrap();
        assert_ne!(first_context, second_context);
    }

    #[test]
    fn navigation_policy_never_turns_external_origins_into_privileged_content() {
        assert!(is_allowed_doflow_navigation(
            &Url::parse("https://app.doflow.it/dashboard").unwrap()
        ));
        assert!(!is_allowed_doflow_navigation(
            &Url::parse("https://api.doflow.it/auth/google").unwrap()
        ));
        assert!(!is_allowed_doflow_navigation(
            &Url::parse("https://evil.invalid/").unwrap()
        ));
        assert!(!is_allowed_doflow_navigation(
            &Url::parse("file:///C:/secret").unwrap()
        ));
        assert!(!is_allowed_doflow_navigation(
            &Url::parse("javascript:alert(1)").unwrap()
        ));
    }

    #[test]
    fn injected_bridge_has_no_generic_native_proxy() {
        let script = initialization_script(&Uuid::new_v4().to_string(), "1.0.0", None);
        assert!(!script.contains("filesystem"));
        assert!(!script.contains("arbitraryUrl"));
        assert!(!script.contains("shell"));
        assert!(script.contains("start_desktop_google_oauth"));
        assert!(script.contains("get_desktop_call_capabilities"));
        assert!(script.contains("show_incoming_desktop_call"));
        assert!(script.contains("doflow:desktop-call-action"));
        assert!(script.contains("window.location.pathname === '/login'"));
        assert!(script.contains("signalDesktopReady('needs-auth')"));
    }
}
