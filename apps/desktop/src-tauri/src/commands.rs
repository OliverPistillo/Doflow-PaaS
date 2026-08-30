use crate::{
    models::{
        DesktopReadyInput, DesktopUpdateState, PreparedProfile, ProfileMetadataInput,
        ProfileRegistry, RemoteReadyPayload, SavedProfile, BRIDGE_VERSION,
    },
    oauth::StartDesktopGoogleOAuthInput,
    preferences::CloseBehavior,
    profile_registry::{now_rfc3339, validate_opaque_id},
    profile_webview::{create_remote_webview, remote_label, REMOTE_ORIGIN},
    runtime::{ActiveProfile, DesktopRuntime},
};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, Runtime, State, WebviewWindow};
use uuid::Uuid;

#[tauri::command]
pub fn load_profile_registry(state: State<'_, DesktopRuntime>) -> Result<ProfileRegistry, String> {
    state.profiles.load().map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn check_for_updates<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, DesktopRuntime>,
) -> Result<DesktopUpdateState, String> {
    state
        .updater
        .check(&app)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_bootstrap_update_state(
    state: State<'_, DesktopRuntime>,
) -> Result<DesktopUpdateState, String> {
    state
        .updater
        .current_state()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn prepare_profile_webview<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, DesktopRuntime>,
    profile_id: Option<String>,
) -> Result<PreparedProfile, String> {
    let registry = state.profiles.load().map_err(|error| error.to_string())?;
    let (profile_id, existing) = match profile_id {
        Some(profile_id) => {
            validate_opaque_id(&profile_id).map_err(|error| error.to_string())?;
            if !registry
                .profiles
                .iter()
                .any(|profile| profile.id == profile_id)
            {
                return Err("The selected profile does not exist".into());
            }
            (profile_id, true)
        }
        None => (Uuid::new_v4().to_string(), false),
    };
    let label = remote_label(&profile_id);
    let create_app = app.clone();
    let create_store = state.profiles.clone();
    let create_profile_id = profile_id.clone();
    let (created_tx, created_rx) = tokio::sync::oneshot::channel();
    app.run_on_main_thread(move || {
        let result =
            create_remote_webview(&create_app, &create_store, &create_profile_id).map(|_| ());
        let _ = created_tx.send(result);
    })
    .map_err(|_| "Unable to schedule the Doflow WebView")?;
    created_rx
        .await
        .map_err(|_| "Doflow WebView creation was interrupted")??;
    *state
        .active
        .lock()
        .map_err(|_| "Desktop profile state is unavailable")? = Some(ActiveProfile {
        profile_id: profile_id.clone(),
        webview_label: label.clone(),
        existing,
        ready: false,
    });
    let timeout_app = app.clone();
    let timeout_profile_id = profile_id.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(25)).await;
        let runtime = timeout_app.state::<DesktopRuntime>();
        let timed_out = runtime
            .active
            .lock()
            .ok()
            .and_then(|active| active.clone())
            .is_some_and(|active| active.profile_id == timeout_profile_id && !active.ready);
        if timed_out {
            let _ = timeout_app.emit(
                "desktop://bootstrap-error",
                "Doflow did not become ready in time. Check the network connection and retry.",
            );
        }
    });

    Ok(PreparedProfile {
        profile_id,
        existing,
    })
}

#[tauri::command]
pub fn activate_prepared_profile<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, DesktopRuntime>,
) -> Result<(), String> {
    let active = state
        .active
        .lock()
        .map_err(|_| "Desktop profile state is unavailable")?
        .clone()
        .ok_or("No profile WebView has been prepared")?;
    if !active.ready {
        return Err("The Doflow WebView is not ready".into());
    }
    let remote = app
        .get_webview_window(&active.webview_label)
        .ok_or("The prepared Doflow WebView is missing")?;
    if active.existing {
        let _ = state.profiles.mark_last_used(&active.profile_id);
    }
    #[cfg(target_os = "windows")]
    remote
        .set_skip_taskbar(false)
        .map_err(|_| "Unable to restore Doflow in the taskbar")?;
    remote.show().map_err(|_| "Unable to show Doflow")?;
    remote.set_focus().map_err(|_| "Unable to focus Doflow")?;
    if let Some(bootstrap) = app.get_webview_window("bootstrap") {
        bootstrap
            .hide()
            .map_err(|_| "Unable to hide the bootstrap window")?;
    }
    Ok(())
}

#[tauri::command]
pub async fn remove_saved_profile<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, DesktopRuntime>,
    profile_id: String,
) -> Result<ProfileRegistry, String> {
    validate_opaque_id(&profile_id).map_err(|error| error.to_string())?;
    let label = remote_label(&profile_id);
    if let Some(remote) = app.get_webview_window(&label) {
        let _ = remote.eval(
            r#"(() => { try { const csrf = document.cookie.split(';').map(v => v.trim()).find(v => v.startsWith('doflow_csrf='))?.slice(13); if (csrf) fetch('/api/auth/logout', { method: 'POST', credentials: 'include', headers: { 'X-Doflow-Web': '1', 'X-CSRF-Token': decodeURIComponent(csrf) } }).catch(() => undefined); } catch (_) {} })();"#,
        );
        let _ = remote.destroy();
    }
    {
        let mut active = state
            .active
            .lock()
            .map_err(|_| "Desktop profile state is unavailable")?;
        if active
            .as_ref()
            .is_some_and(|value| value.profile_id == profile_id)
        {
            *active = None;
        }
    }
    let registry = state
        .profiles
        .remove_profile_metadata(&profile_id)
        .map_err(|error| error.to_string())?;
    let mut last_error = None;
    for _ in 0..3 {
        match state.profiles.remove_profile_directory(&profile_id) {
            Ok(()) => {
                last_error = None;
                break;
            }
            Err(error) => {
                last_error = Some(error.to_string());
                tokio::time::sleep(Duration::from_millis(120)).await;
            }
        }
    }
    if let Some(error) = last_error {
        return Err(error);
    }
    Ok(registry)
}

#[tauri::command]
pub fn desktop_ready<R: Runtime>(
    app: AppHandle<R>,
    webview: WebviewWindow<R>,
    state: State<'_, DesktopRuntime>,
    input: DesktopReadyInput,
) -> Result<(), String> {
    assert_remote_caller(&webview, &state)?;
    if input.schema_version != BRIDGE_VERSION {
        return Err("Unsupported Desktop bridge version".into());
    }
    validate_opaque_id(&input.profile_id).map_err(|error| error.to_string())?;
    let mut active = state
        .active
        .lock()
        .map_err(|_| "Desktop profile state is unavailable")?;
    let current = active.as_mut().ok_or("No active Desktop profile")?;
    if current.profile_id != input.profile_id {
        return Err("Desktop profile mismatch".into());
    }
    current.ready = true;
    app.emit(
        "desktop://remote-ready",
        RemoteReadyPayload {
            profile_id: input.profile_id,
            state: input.state,
        },
    )
    .map_err(|_| "Unable to notify Desktop readiness".to_owned())
}

#[tauri::command]
pub fn register_profile_metadata<R: Runtime>(
    webview: WebviewWindow<R>,
    state: State<'_, DesktopRuntime>,
    input: ProfileMetadataInput,
) -> Result<ProfileRegistry, String> {
    assert_remote_caller(&webview, &state)?;
    if input.schema_version != BRIDGE_VERSION {
        return Err("Unsupported Desktop bridge version".into());
    }
    validate_opaque_id(&input.profile_id).map_err(|error| error.to_string())?;
    let active = state
        .active
        .lock()
        .map_err(|_| "Desktop profile state is unavailable")?
        .clone()
        .ok_or("No active Desktop profile")?;
    if active.profile_id != input.profile_id {
        return Err("Desktop profile mismatch".into());
    }
    let timestamp = now_rfc3339();
    let profile = SavedProfile {
        id: input.profile_id.clone(),
        user_id: input.user_id,
        tenant_id: input.tenant_id,
        tenant_slug: input.tenant_slug,
        name: input.name,
        email: input.email.to_lowercase(),
        avatar_url: input.avatar_url,
        initials: input.initials,
        created_at: timestamp.clone(),
        last_used_at: timestamp,
        webview_context_id: input.profile_id,
    };
    state
        .profiles
        .upsert_profile(profile)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn request_profile_switch<R: Runtime>(
    app: AppHandle<R>,
    webview: WebviewWindow<R>,
    state: State<'_, DesktopRuntime>,
) -> Result<(), String> {
    assert_remote_caller(&webview, &state)?;
    webview
        .hide()
        .map_err(|_| "Unable to hide the current profile")?;
    webview
        .destroy()
        .map_err(|_| "Unable to close the current profile")?;
    *state
        .active
        .lock()
        .map_err(|_| "Desktop profile state is unavailable")? = None;
    let bootstrap = app
        .get_webview_window("bootstrap")
        .ok_or("Bootstrap window is unavailable")?;
    bootstrap
        .show()
        .map_err(|_| "Unable to show profile picker")?;
    bootstrap
        .set_focus()
        .map_err(|_| "Unable to focus profile picker")?;
    app.emit("desktop://profile-switch-requested", ())
        .map_err(|_| "Unable to open profile picker".to_owned())
}

#[tauri::command]
pub fn get_update_state<R: Runtime>(
    webview: WebviewWindow<R>,
    state: State<'_, DesktopRuntime>,
) -> Result<DesktopUpdateState, String> {
    assert_remote_caller(&webview, &state)?;
    state
        .updater
        .current_state()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn install_current_verified_update<R: Runtime>(
    app: AppHandle<R>,
    webview: WebviewWindow<R>,
    state: State<'_, DesktopRuntime>,
) -> Result<(), String> {
    assert_update_caller(&webview, &state)?;
    if webview.label() != "bootstrap" {
        let _ = webview.hide();
        if let Some(bootstrap) = app.get_webview_window("bootstrap") {
            let _ = bootstrap.show();
            let _ = bootstrap.set_focus();
        }
    }
    state
        .updater
        .install(&app)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn start_desktop_google_oauth<R: Runtime>(
    app: AppHandle<R>,
    webview: WebviewWindow<R>,
    state: State<'_, DesktopRuntime>,
    input: StartDesktopGoogleOAuthInput,
) -> Result<(), String> {
    assert_remote_caller(&webview, &state)?;
    if input.schema_version != BRIDGE_VERSION {
        return Err("Unsupported Desktop bridge version".into());
    }
    validate_opaque_id(&input.profile_id).map_err(|error| error.to_string())?;
    let active = state
        .active
        .lock()
        .map_err(|_| "Desktop profile state is unavailable")?
        .clone()
        .ok_or("No active Desktop profile")?;
    if active.profile_id != input.profile_id || active.webview_label != webview.label() {
        return Err("Desktop profile mismatch".into());
    }
    state.oauth.start(app, active.webview_label).await
}

#[tauri::command]
pub fn quit_desktop<R: Runtime>(app: AppHandle<R>) {
    crate::close_manager::exit_desktop(&app);
}

#[tauri::command]
pub fn request_desktop_close<R: Runtime>(app: AppHandle<R>) {
    crate::close_manager::request_user_close(&app, "bootstrap");
}

#[tauri::command]
pub fn resolve_desktop_close<R: Runtime>(
    app: AppHandle<R>,
    behavior: CloseBehavior,
    remember: bool,
) -> Result<(), String> {
    crate::close_manager::resolve_close_request(&app, behavior, remember)
}

#[tauri::command]
pub fn cancel_desktop_close<R: Runtime>(app: AppHandle<R>) {
    crate::close_manager::cancel_close_request(&app);
}

#[tauri::command]
pub fn minimize_bootstrap<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    app.get_webview_window("bootstrap")
        .ok_or("Bootstrap window is unavailable")?
        .minimize()
        .map_err(|_| "Unable to minimize Doflow".into())
}

pub(crate) fn assert_remote_caller<R: Runtime>(
    webview: &WebviewWindow<R>,
    state: &DesktopRuntime,
) -> Result<(), String> {
    if !webview.label().starts_with("remote-") {
        return Err("Remote Desktop command rejected".into());
    }
    let url = webview
        .url()
        .map_err(|_| "Unable to validate WebView origin")?;
    if url.origin().ascii_serialization() != REMOTE_ORIGIN {
        return Err("Remote Desktop origin rejected".into());
    }
    let active = state
        .active
        .lock()
        .map_err(|_| "Desktop profile state is unavailable")?;
    if active
        .as_ref()
        .is_none_or(|value| value.webview_label != webview.label())
    {
        return Err("Inactive Desktop profile rejected".into());
    }
    Ok(())
}

fn assert_update_caller<R: Runtime>(
    webview: &WebviewWindow<R>,
    state: &DesktopRuntime,
) -> Result<(), String> {
    if webview.label() == "bootstrap" {
        return Ok(());
    }
    assert_remote_caller(webview, state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bridge_inputs_reject_wrong_schema_invalid_ids_and_oversized_metadata() {
        let input = DesktopReadyInput {
            schema_version: 1,
            profile_id: "../escape".into(),
            state: crate::models::RemoteSessionState::Authenticated,
        };
        assert_ne!(input.schema_version, BRIDGE_VERSION);
        assert!(validate_opaque_id(&input.profile_id).is_err());

        let huge_name = "x".repeat(500);
        let profile = SavedProfile {
            id: Uuid::new_v4().to_string(),
            user_id: Uuid::new_v4().to_string(),
            tenant_id: Some("doflow".into()),
            tenant_slug: Some("doflow".into()),
            name: huge_name,
            email: "safe@example.test".into(),
            avatar_url: None,
            initials: None,
            created_at: now_rfc3339(),
            last_used_at: now_rfc3339(),
            webview_context_id: String::new(),
        };
        assert!(serde_json::to_string(&profile).unwrap().len() > 500);
    }
}
