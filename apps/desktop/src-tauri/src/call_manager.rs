use crate::{commands::assert_remote_caller, models::BRIDGE_VERSION, runtime::DesktopRuntime};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{
    utils::config::WebviewUrl, webview::WebviewWindowBuilder, AppHandle, Emitter, Manager, Runtime,
    State, WebviewWindow,
};
use tauri_plugin_notification::NotificationExt;
use url::Url;
use uuid::Uuid;

const CALL_LABEL_PREFIX: &str = "call-";
const INCOMING_LABEL_PREFIX: &str = "incoming-";
const CALL_CONTEXT_UPDATED_EVENT: &str = "desktop://call-context-updated";
const REMOTE_ACTION_EVENT: &str = "doflow:desktop-call-action";

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum NativeCallType {
    Audio,
    Video,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum NativeCallDirection {
    Incoming,
    Outgoing,
    Guest,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NativeCallDescriptor {
    pub session_id: String,
    pub call_type: NativeCallType,
    pub direction: NativeCallDirection,
    pub display_name: String,
    #[serde(default)]
    pub guest_mode: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LivekitCredentials {
    pub server_url: String,
    pub access_token: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ShowIncomingCallInput {
    pub schema_version: u8,
    pub call: NativeCallDescriptor,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OpenDesktopCallInput {
    pub schema_version: u8,
    pub call: NativeCallDescriptor,
    pub credentials: LivekitCredentials,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateDesktopCallCredentialsInput {
    pub schema_version: u8,
    pub session_id: String,
    pub credentials: LivekitCredentials,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DesktopCallSessionInput {
    pub schema_version: u8,
    pub session_id: String,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum NativeCallAction {
    Accept,
    Reject,
    Cancel,
    End,
    Failed,
    RefreshToken,
    Ready,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NativeCallActionInput {
    pub action: NativeCallAction,
    #[serde(default)]
    pub reason: Option<String>,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NativeCallActionEvent {
    pub session_id: String,
    pub action: NativeCallAction,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopCallCapabilities {
    pub schema_version: u8,
    pub capabilities: Vec<&'static str>,
    pub notification_actions: bool,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NativeCallContext {
    pub call: NativeCallDescriptor,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub credentials: Option<LivekitCredentials>,
}

#[derive(Clone, Debug)]
struct RoutedCall {
    call: NativeCallDescriptor,
    profile_window_label: String,
    credentials: Option<LivekitCredentials>,
}

#[derive(Debug, Default)]
struct NativeCallState {
    incoming: Option<RoutedCall>,
    active: Option<RoutedCall>,
}

#[derive(Debug, Default)]
pub struct CallManager {
    state: Mutex<NativeCallState>,
}

impl CallManager {
    pub fn new() -> Self {
        Self::default()
    }

    fn context_for_label(&self, label: &str) -> Result<NativeCallContext, String> {
        let (kind, session_id) = parse_native_window_label(label)?;
        let state = self
            .state
            .lock()
            .map_err(|_| "Lo stato della chiamata Desktop non è disponibile")?;
        let routed = match kind {
            NativeWindowKind::Call => state.active.as_ref(),
            NativeWindowKind::Incoming => state.incoming.as_ref(),
        }
        .filter(|entry| entry.call.session_id == session_id)
        .ok_or("Il contesto della chiamata non è più disponibile")?;
        Ok(NativeCallContext {
            call: routed.call.clone(),
            credentials: routed.credentials.clone(),
        })
    }

    fn profile_for(&self, session_id: &str) -> Result<String, String> {
        let state = self
            .state
            .lock()
            .map_err(|_| "Lo stato della chiamata Desktop non è disponibile")?;
        state
            .active
            .as_ref()
            .filter(|entry| entry.call.session_id == session_id)
            .or_else(|| {
                state
                    .incoming
                    .as_ref()
                    .filter(|entry| entry.call.session_id == session_id)
            })
            .map(|entry| entry.profile_window_label.clone())
            .ok_or_else(|| "La chiamata non è più attiva".to_owned())
    }

    pub fn clear_session(&self, session_id: &str) {
        if let Ok(mut state) = self.state.lock() {
            if state
                .incoming
                .as_ref()
                .is_some_and(|entry| entry.call.session_id == session_id)
            {
                state.incoming = None;
            }
            if state
                .active
                .as_ref()
                .is_some_and(|entry| entry.call.session_id == session_id)
            {
                state.active = None;
            }
        }
    }

    pub fn clear_all(&self) {
        if let Ok(mut state) = self.state.lock() {
            state.incoming = None;
            state.active = None;
        }
    }

    #[cfg(test)]
    fn install_incoming_for_test(&self, call: NativeCallDescriptor) -> Result<(), String> {
        let mut state = self.state.lock().map_err(|_| "lock")?;
        if state.active.is_some()
            || state
                .incoming
                .as_ref()
                .is_some_and(|entry| entry.call.session_id != call.session_id)
        {
            return Err("È già attiva una chiamata Desktop".into());
        }
        state.incoming = Some(RoutedCall {
            call,
            profile_window_label: "remote-test".into(),
            credentials: None,
        });
        Ok(())
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum NativeWindowKind {
    Call,
    Incoming,
}

fn validate_schema_version(value: u8) -> Result<(), String> {
    if value == BRIDGE_VERSION {
        Ok(())
    } else {
        Err("Versione del bridge Desktop non supportata".into())
    }
}

fn validate_session_id(value: &str) -> Result<String, String> {
    let parsed = Uuid::parse_str(value).map_err(|_| "Identificatore chiamata non valido")?;
    if parsed.get_version_num() != 4 {
        return Err("Identificatore chiamata non valido".into());
    }
    Ok(parsed.hyphenated().to_string())
}

fn validate_call(mut call: NativeCallDescriptor) -> Result<NativeCallDescriptor, String> {
    call.session_id = validate_session_id(&call.session_id)?;
    call.display_name = call.display_name.trim().to_owned();
    if call.display_name.is_empty()
        || call.display_name.chars().count() > 120
        || call.display_name.chars().any(char::is_control)
    {
        return Err("Nome partecipante non valido".into());
    }
    if call
        .expires_at
        .as_ref()
        .is_some_and(|value| value.len() > 64 || value.chars().any(char::is_control))
    {
        return Err("Scadenza chiamata non valida".into());
    }
    Ok(call)
}

fn validate_credentials(mut value: LivekitCredentials) -> Result<LivekitCredentials, String> {
    value.server_url = value.server_url.trim().to_owned();
    let url = Url::parse(&value.server_url).map_err(|_| "URL LiveKit non valido")?;
    let host = url.host_str().unwrap_or_default();
    let provider_host = host.eq_ignore_ascii_case("doflow.it")
        || host.to_ascii_lowercase().ends_with(".doflow.it")
        || host.eq_ignore_ascii_case("livekit.cloud")
        || host.to_ascii_lowercase().ends_with(".livekit.cloud");
    let secure = url.scheme() == "wss" && provider_host;
    let local = url.scheme() == "ws"
        && url.host_str().is_some_and(|host| {
            host.eq_ignore_ascii_case("localhost")
                || host.eq_ignore_ascii_case("127.0.0.1")
                || host.eq_ignore_ascii_case("::1")
        });
    if (!secure && !local)
        || url.host_str().is_none()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("URL LiveKit non consentito".into());
    }
    if value.access_token.len() < 40
        || value.access_token.len() > 16_384
        || value.access_token.chars().any(char::is_whitespace)
    {
        return Err("Credenziale LiveKit non valida".into());
    }
    Ok(value)
}

fn call_label(session_id: &str) -> String {
    format!("{CALL_LABEL_PREFIX}{session_id}")
}

fn incoming_label(session_id: &str) -> String {
    format!("{INCOMING_LABEL_PREFIX}{session_id}")
}

fn parse_native_window_label(label: &str) -> Result<(NativeWindowKind, String), String> {
    let (kind, value) = if let Some(value) = label.strip_prefix(CALL_LABEL_PREFIX) {
        (NativeWindowKind::Call, value)
    } else if let Some(value) = label.strip_prefix(INCOMING_LABEL_PREFIX) {
        (NativeWindowKind::Incoming, value)
    } else {
        return Err("Finestra chiamata non autorizzata".into());
    };
    Ok((kind, validate_session_id(value)?))
}

fn action_allowed(kind: NativeWindowKind, action: NativeCallAction) -> bool {
    match kind {
        NativeWindowKind::Incoming => {
            matches!(action, NativeCallAction::Accept | NativeCallAction::Reject)
        }
        NativeWindowKind::Call => matches!(
            action,
            NativeCallAction::Cancel
                | NativeCallAction::End
                | NativeCallAction::Failed
                | NativeCallAction::RefreshToken
                | NativeCallAction::Ready
        ),
    }
}

fn active_profile_label<R: Runtime>(
    state: &DesktopRuntime,
    caller: &WebviewWindow<R>,
) -> Result<String, String> {
    assert_remote_caller(caller, state)?;
    state
        .active
        .lock()
        .map_err(|_| "Lo stato del profilo Desktop non è disponibile")?
        .as_ref()
        .map(|active| active.webview_label.clone())
        .ok_or_else(|| "Nessun profilo Desktop attivo".to_owned())
}

fn build_incoming_window<R: Runtime>(
    app: &AppHandle<R>,
    call: &NativeCallDescriptor,
) -> Result<(), String> {
    let label = incoming_label(&call.session_id);
    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.show();
        let _ = window.unminimize();
        return window
            .set_focus()
            .map_err(|_| "Impossibile focalizzare la chiamata in arrivo".into());
    }
    WebviewWindowBuilder::new(app, &label, WebviewUrl::App("index.html".into()))
        .title("Chiamata Doflow in arrivo")
        .inner_size(420.0, 280.0)
        .min_inner_size(380.0, 250.0)
        .resizable(false)
        .decorations(true)
        .always_on_top(true)
        .skip_taskbar(false)
        .center()
        .focused(true)
        .build()
        .map(|_| ())
        .map_err(|_| "Impossibile aprire la chiamata in arrivo".into())
}

fn build_call_window<R: Runtime>(
    app: &AppHandle<R>,
    call: &NativeCallDescriptor,
) -> Result<(), String> {
    let label = call_label(&call.session_id);
    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.show();
        let _ = window.unminimize();
        return window
            .set_focus()
            .map_err(|_| "Impossibile focalizzare la chiamata".into());
    }
    WebviewWindowBuilder::new(app, &label, WebviewUrl::App("index.html".into()))
        .title("Doflow Calls")
        .inner_size(1080.0, 700.0)
        .min_inner_size(640.0, 520.0)
        .resizable(true)
        .decorations(true)
        .background_color(tauri::window::Color(5, 7, 14, 255))
        .center()
        .focused(true)
        .build()
        .map(|_| ())
        .map_err(|_| "Impossibile aprire la finestra chiamata".into())
}

fn destroy_window<R: Runtime>(app: &AppHandle<R>, label: &str) {
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.destroy();
    }
}

fn dispatch_remote_action<R: Runtime>(
    app: &AppHandle<R>,
    state: &DesktopRuntime,
    event: NativeCallActionEvent,
) -> Result<(), String> {
    let profile_label = state.calls.profile_for(&event.session_id)?;
    let profile = app
        .get_webview_window(&profile_label)
        .ok_or("La finestra del profilo Doflow non è disponibile")?;
    let payload =
        serde_json::to_string(&event).map_err(|_| "Azione chiamata non serializzabile")?;
    profile
        .eval(format!(
            "window.dispatchEvent(new CustomEvent({REMOTE_ACTION_EVENT:?},{{detail:{payload}}}));"
        ))
        .map_err(|_| "Impossibile inoltrare l'azione alla sessione Doflow".into())
}

#[tauri::command]
pub fn get_desktop_call_capabilities(
    webview: WebviewWindow,
    state: State<'_, DesktopRuntime>,
) -> Result<DesktopCallCapabilities, String> {
    assert_remote_caller(&webview, &state)?;
    Ok(DesktopCallCapabilities {
        schema_version: BRIDGE_VERSION,
        capabilities: vec![
            "calls.internal",
            "calls.video",
            "calls.screenShare",
            "calls.guest",
            "calls.incomingWindow",
            "calls.nativeNotification",
        ],
        // Windows action buttons are not exposed reliably by the pinned desktop plugin.
        notification_actions: false,
    })
}

#[tauri::command]
pub fn show_incoming_desktop_call<R: Runtime>(
    app: AppHandle<R>,
    webview: WebviewWindow<R>,
    state: State<'_, DesktopRuntime>,
    input: ShowIncomingCallInput,
) -> Result<(), String> {
    validate_schema_version(input.schema_version)?;
    let profile_window_label = active_profile_label(&state, &webview)?;
    let call = validate_call(input.call)?;
    if call.direction != NativeCallDirection::Incoming {
        return Err("Direzione chiamata in arrivo non valida".into());
    }
    {
        let mut native = state
            .calls
            .state
            .lock()
            .map_err(|_| "Lo stato della chiamata Desktop non è disponibile")?;
        if native
            .active
            .as_ref()
            .is_some_and(|entry| entry.call.session_id != call.session_id)
        {
            return Err("È già attiva una chiamata Desktop".into());
        }
        if native
            .incoming
            .as_ref()
            .is_some_and(|entry| entry.call.session_id != call.session_id)
        {
            return Err("È già presente una chiamata Desktop in arrivo".into());
        }
        native.incoming = Some(RoutedCall {
            call: call.clone(),
            profile_window_label,
            credentials: None,
        });
    }
    build_incoming_window(&app, &call)?;
    let _ = app
        .notification()
        .builder()
        .title("Doflow Calls")
        .body("Chiamata Doflow in arrivo")
        .show();
    Ok(())
}

#[tauri::command]
pub fn dismiss_incoming_desktop_call<R: Runtime>(
    app: AppHandle<R>,
    webview: WebviewWindow<R>,
    state: State<'_, DesktopRuntime>,
    input: DesktopCallSessionInput,
) -> Result<(), String> {
    validate_schema_version(input.schema_version)?;
    assert_remote_caller(&webview, &state)?;
    let session_id = validate_session_id(&input.session_id)?;
    destroy_window(&app, &incoming_label(&session_id));
    if let Ok(mut native) = state.calls.state.lock() {
        if native
            .incoming
            .as_ref()
            .is_some_and(|entry| entry.call.session_id == session_id)
        {
            native.incoming = None;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn open_desktop_call<R: Runtime>(
    app: AppHandle<R>,
    webview: WebviewWindow<R>,
    state: State<'_, DesktopRuntime>,
    input: OpenDesktopCallInput,
) -> Result<(), String> {
    validate_schema_version(input.schema_version)?;
    let profile_window_label = active_profile_label(&state, &webview)?;
    let call = validate_call(input.call)?;
    let credentials = validate_credentials(input.credentials)?;
    {
        let mut native = state
            .calls
            .state
            .lock()
            .map_err(|_| "Lo stato della chiamata Desktop non è disponibile")?;
        if native
            .active
            .as_ref()
            .is_some_and(|entry| entry.call.session_id != call.session_id)
        {
            return Err("È già attiva una chiamata Desktop".into());
        }
        native.active = Some(RoutedCall {
            call: call.clone(),
            profile_window_label,
            credentials: Some(credentials),
        });
        if native
            .incoming
            .as_ref()
            .is_some_and(|entry| entry.call.session_id == call.session_id)
        {
            native.incoming = None;
        }
    }
    destroy_window(&app, &incoming_label(&call.session_id));
    build_call_window(&app, &call)
}

#[tauri::command]
pub fn update_desktop_call_credentials<R: Runtime>(
    app: AppHandle<R>,
    webview: WebviewWindow<R>,
    state: State<'_, DesktopRuntime>,
    input: UpdateDesktopCallCredentialsInput,
) -> Result<(), String> {
    validate_schema_version(input.schema_version)?;
    assert_remote_caller(&webview, &state)?;
    let session_id = validate_session_id(&input.session_id)?;
    let credentials = validate_credentials(input.credentials)?;
    let context = {
        let mut native = state
            .calls
            .state
            .lock()
            .map_err(|_| "Lo stato della chiamata Desktop non è disponibile")?;
        let active = native
            .active
            .as_mut()
            .filter(|entry| entry.call.session_id == session_id)
            .ok_or("La chiamata non è più attiva")?;
        active.credentials = Some(credentials);
        NativeCallContext {
            call: active.call.clone(),
            credentials: active.credentials.clone(),
        }
    };
    app.get_webview_window(&call_label(&session_id))
        .ok_or("La finestra chiamata non è disponibile")?
        .emit(CALL_CONTEXT_UPDATED_EVENT, context)
        .map_err(|_| "Impossibile aggiornare le credenziali della chiamata".into())
}

#[tauri::command]
pub fn close_desktop_call<R: Runtime>(
    app: AppHandle<R>,
    webview: WebviewWindow<R>,
    state: State<'_, DesktopRuntime>,
    input: DesktopCallSessionInput,
) -> Result<(), String> {
    validate_schema_version(input.schema_version)?;
    assert_remote_caller(&webview, &state)?;
    let session_id = validate_session_id(&input.session_id)?;
    destroy_window(&app, &call_label(&session_id));
    destroy_window(&app, &incoming_label(&session_id));
    state.calls.clear_session(&session_id);
    Ok(())
}

#[tauri::command]
pub fn get_native_call_context(
    webview: WebviewWindow,
    state: State<'_, DesktopRuntime>,
) -> Result<NativeCallContext, String> {
    state.calls.context_for_label(webview.label())
}

#[tauri::command]
pub fn send_native_call_action<R: Runtime>(
    app: AppHandle<R>,
    webview: WebviewWindow<R>,
    state: State<'_, DesktopRuntime>,
    input: NativeCallActionInput,
) -> Result<(), String> {
    let (kind, session_id) = parse_native_window_label(webview.label())?;
    if !action_allowed(kind, input.action) {
        return Err("Azione non consentita per questa finestra".into());
    }
    let reason = input.reason.map(|value| value.trim().to_owned());
    if reason
        .as_ref()
        .is_some_and(|value| value.len() > 120 || value.chars().any(char::is_control))
    {
        return Err("Motivo chiamata non valido".into());
    }
    dispatch_remote_action(
        &app,
        &state,
        NativeCallActionEvent {
            session_id,
            action: input.action,
            reason,
        },
    )
}

pub fn handle_native_close_requested<R: Runtime>(app: &AppHandle<R>, label: &str) -> bool {
    let Ok((kind, session_id)) = parse_native_window_label(label) else {
        return false;
    };
    let runtime = app.state::<DesktopRuntime>();
    if runtime.close.is_explicit_exit() {
        runtime.calls.clear_session(&session_id);
        return false;
    }
    let action = match kind {
        NativeWindowKind::Incoming => NativeCallAction::Reject,
        NativeWindowKind::Call => NativeCallAction::End,
    };
    let _ = dispatch_remote_action(
        app,
        &runtime,
        NativeCallActionEvent {
            session_id: session_id.clone(),
            action,
            reason: Some("native_window_closed".into()),
        },
    );
    // Closing a media window is a local privacy boundary: stop its WebView and tracks
    // immediately even when the network is unavailable. The backend request above is
    // best-effort and persisted authority deterministically expires any failed delivery.
    runtime.calls.clear_session(&session_id);
    destroy_window(app, label);
    true
}

pub fn destroy_all_call_windows<R: Runtime>(app: &AppHandle<R>) {
    let labels: Vec<String> = app
        .webview_windows()
        .keys()
        .filter(|label| {
            label.starts_with(CALL_LABEL_PREFIX) || label.starts_with(INCOMING_LABEL_PREFIX)
        })
        .cloned()
        .collect();
    for label in labels {
        destroy_window(app, &label);
    }
    app.state::<DesktopRuntime>().calls.clear_all();
}

#[cfg(test)]
mod tests {
    use super::*;

    fn descriptor(session_id: String) -> NativeCallDescriptor {
        NativeCallDescriptor {
            session_id,
            call_type: NativeCallType::Video,
            direction: NativeCallDirection::Incoming,
            display_name: "Mario Rossi".into(),
            guest_mode: false,
            expires_at: None,
        }
    }

    #[test]
    fn session_ids_map_only_to_safe_window_labels() {
        let id = Uuid::new_v4().to_string();
        assert_eq!(parse_native_window_label(&call_label(&id)).unwrap().1, id);
        assert!(validate_session_id("../remote-admin").is_err());
        assert!(parse_native_window_label("remote-safe").is_err());
        assert!(validate_session_id(&Uuid::nil().to_string()).is_err());
    }

    #[test]
    fn livekit_credentials_require_secure_remote_or_loopback_url() {
        let token = "x".repeat(80);
        assert!(validate_credentials(LivekitCredentials {
            server_url: "wss://calls.doflow.it".into(),
            access_token: token.clone(),
        })
        .is_ok());
        assert!(validate_credentials(LivekitCredentials {
            server_url: "ws://127.0.0.1:7880".into(),
            access_token: token.clone(),
        })
        .is_ok());
        assert!(validate_credentials(LivekitCredentials {
            server_url: "ws://attacker.example.test".into(),
            access_token: token,
        })
        .is_err());
        assert!(validate_credentials(LivekitCredentials {
            server_url: "wss://attacker.example.test".into(),
            access_token: "x".repeat(80),
        })
        .is_err());
    }

    #[test]
    fn only_one_active_native_call_is_accepted() {
        let manager = CallManager::new();
        let first = descriptor(Uuid::new_v4().to_string());
        manager.install_incoming_for_test(first.clone()).unwrap();
        {
            let mut state = manager.state.lock().unwrap();
            state.active = state.incoming.take();
        }
        let second = descriptor(Uuid::new_v4().to_string());
        assert!(manager.install_incoming_for_test(second).is_err());
        assert_eq!(
            manager
                .context_for_label(&call_label(&first.session_id))
                .unwrap()
                .call,
            first
        );
    }

    #[test]
    fn malformed_payloads_and_cross_window_actions_are_rejected() {
        assert!(validate_call(descriptor("not-a-uuid".into())).is_err());
        assert!(action_allowed(
            NativeWindowKind::Incoming,
            NativeCallAction::Accept
        ));
        assert!(!action_allowed(
            NativeWindowKind::Incoming,
            NativeCallAction::End
        ));
        assert!(!action_allowed(
            NativeWindowKind::Call,
            NativeCallAction::Accept
        ));
        let id = Uuid::new_v4().to_string();
        let malformed = serde_json::json!({
            "schemaVersion": BRIDGE_VERSION,
            "call": {
                "sessionId": id,
                "callType": "audio",
                "direction": "incoming",
                "displayName": "Mario",
                "guestMode": false,
                "unexpected": true
            }
        });
        assert!(serde_json::from_value::<ShowIncomingCallInput>(malformed).is_err());
    }
}
