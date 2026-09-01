use crate::{commands::assert_remote_caller, models::BRIDGE_VERSION, runtime::DesktopRuntime};
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, sync::Mutex};
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

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CloseNativeCallWindowInput {
    #[serde(default)]
    pub action: Option<NativeCallAction>,
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
    action_claimed: bool,
}

#[derive(Debug, Default)]
struct NativeCallState {
    incoming: Option<RoutedCall>,
    active: Option<RoutedCall>,
    closing_sessions: HashSet<String>,
}

#[derive(Debug)]
struct NativeClosePlan {
    close_key: String,
    profile_window_label: Option<String>,
    event: Option<NativeCallActionEvent>,
}

#[derive(Debug)]
enum NativeClosePreparation {
    AlreadyClosing,
    Started(NativeClosePlan),
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

    fn prepare_action(
        &self,
        session_id: &str,
        action: NativeCallAction,
        reason: Option<String>,
    ) -> Result<Option<(String, NativeCallActionEvent)>, String> {
        let mut state = self
            .state
            .lock()
            .map_err(|_| "Lo stato della chiamata Desktop non è disponibile")?;
        let routed = if state
            .active
            .as_ref()
            .is_some_and(|entry| entry.call.session_id == session_id)
        {
            state.active.as_mut().expect("active entry checked above")
        } else if state
            .incoming
            .as_ref()
            .is_some_and(|entry| entry.call.session_id == session_id)
        {
            state
                .incoming
                .as_mut()
                .expect("incoming entry checked above")
        } else {
            return Err("La chiamata non è più attiva".into());
        };
        if action_is_claimed_once(action) {
            if routed.action_claimed {
                return Ok(None);
            }
            routed.action_claimed = true;
        }
        Ok(Some((
            routed.profile_window_label.clone(),
            NativeCallActionEvent {
                session_id: session_id.to_owned(),
                action,
                reason,
            },
        )))
    }

    fn begin_close(
        &self,
        kind: NativeWindowKind,
        session_id: &str,
        action: Option<NativeCallAction>,
        reason: Option<String>,
    ) -> Result<NativeClosePreparation, String> {
        let mut state = self
            .state
            .lock()
            .map_err(|_| "Lo stato della chiamata Desktop non è disponibile")?;
        let close_key = match kind {
            NativeWindowKind::Call => call_label(session_id),
            NativeWindowKind::Incoming => incoming_label(session_id),
        };
        if state.closing_sessions.contains(&close_key) {
            return Ok(NativeClosePreparation::AlreadyClosing);
        }

        let mut routed = match kind {
            NativeWindowKind::Call => state
                .active
                .take_if(|entry| entry.call.session_id == session_id),
            NativeWindowKind::Incoming => state
                .incoming
                .take_if(|entry| entry.call.session_id == session_id),
        };
        let profile_window_label = routed
            .as_ref()
            .map(|entry| entry.profile_window_label.clone());
        let event = action.and_then(|action| {
            let routed = routed.as_mut()?;
            if action_is_claimed_once(action) && routed.action_claimed {
                return None;
            }
            if action_is_claimed_once(action) {
                routed.action_claimed = true;
            }
            Some(NativeCallActionEvent {
                session_id: session_id.to_owned(),
                action,
                reason,
            })
        });
        state.closing_sessions.insert(close_key.clone());
        Ok(NativeClosePreparation::Started(NativeClosePlan {
            close_key,
            profile_window_label,
            event,
        }))
    }

    fn finish_close(&self, close_key: &str) {
        if let Ok(mut state) = self.state.lock() {
            state.closing_sessions.remove(close_key);
        }
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
            state.closing_sessions.clear();
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
            action_claimed: false,
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

fn action_is_claimed_once(action: NativeCallAction) -> bool {
    matches!(
        action,
        NativeCallAction::Accept
            | NativeCallAction::Reject
            | NativeCallAction::Cancel
            | NativeCallAction::End
            | NativeCallAction::Failed
    )
}

fn validate_action_reason(reason: Option<String>) -> Result<Option<String>, String> {
    let reason = reason.map(|value| value.trim().to_owned());
    if reason
        .as_ref()
        .is_some_and(|value| value.len() > 120 || value.chars().any(char::is_control))
    {
        return Err("Motivo chiamata non valido".into());
    }
    Ok(reason)
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
        if window.destroy().is_err() {
            let _ = window.close();
        }
    }
}

fn dispatch_remote_action_to_profile<R: Runtime>(
    app: &AppHandle<R>,
    profile_label: &str,
    event: NativeCallActionEvent,
) -> Result<(), String> {
    let profile = app
        .get_webview_window(profile_label)
        .ok_or("La finestra del profilo Doflow non è disponibile")?;
    let payload =
        serde_json::to_string(&event).map_err(|_| "Azione chiamata non serializzabile")?;
    profile
        .eval(format!(
            "window.dispatchEvent(new CustomEvent({REMOTE_ACTION_EVENT:?},{{detail:{payload}}}));"
        ))
        .map_err(|_| "Impossibile inoltrare l'azione alla sessione Doflow".into())
}

fn schedule_native_window_close<R: Runtime>(
    app: &AppHandle<R>,
    label: &str,
    action: Option<NativeCallAction>,
    reason: Option<String>,
) -> Result<bool, String> {
    let (kind, session_id) = parse_native_window_label(label)?;
    if action.is_some_and(|action| !action_allowed(kind, action)) {
        return Err("Azione non consentita per questa finestra".into());
    }
    let runtime = app.state::<DesktopRuntime>();
    let preparation = runtime
        .calls
        .begin_close(kind, &session_id, action, reason)?;
    let NativeClosePreparation::Started(plan) = preparation else {
        return Ok(false);
    };
    let NativeClosePlan {
        close_key,
        profile_window_label,
        event,
        ..
    } = plan;
    let close_app = app.clone();
    let close_label = label.to_owned();
    tauri::async_runtime::spawn(async move {
        // Yield until the originating CloseRequested handler has returned. Destroying a
        // WebView from inside that handler is re-entrant on Windows and can hang WebView2.
        tokio::task::yield_now().await;
        destroy_window(&close_app, &close_label);
        if let (Some(profile_label), Some(event)) = (profile_window_label.as_deref(), event) {
            // The local privacy boundary has already completed. Remote state notification
            // is best-effort and never blocks the call window from disappearing.
            let notify_app = close_app.clone();
            let notify_profile = profile_label.to_owned();
            tauri::async_runtime::spawn_blocking(move || {
                let _ = dispatch_remote_action_to_profile(&notify_app, &notify_profile, event);
            });
        }
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        close_app
            .state::<DesktopRuntime>()
            .calls
            .finish_close(&close_key);
    });
    Ok(true)
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
            action_claimed: false,
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
    let _ = schedule_native_window_close(&app, &incoming_label(&session_id), None, None)?;
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
            action_claimed: false,
        });
        if native
            .incoming
            .as_ref()
            .is_some_and(|entry| entry.call.session_id == call.session_id)
        {
            native.incoming = None;
        }
    }
    let _ = schedule_native_window_close(&app, &incoming_label(&call.session_id), None, None)?;
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
    let _ = schedule_native_window_close(&app, &call_label(&session_id), None, None)?;
    let _ = schedule_native_window_close(&app, &incoming_label(&session_id), None, None)?;
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
    let reason = validate_action_reason(input.reason)?;
    let Some((profile_label, event)) =
        state
            .calls
            .prepare_action(&session_id, input.action, reason)?
    else {
        return Ok(());
    };
    dispatch_remote_action_to_profile(&app, &profile_label, event)
}

#[tauri::command]
pub fn close_native_call_window<R: Runtime>(
    app: AppHandle<R>,
    webview: WebviewWindow<R>,
    input: CloseNativeCallWindowInput,
) -> Result<(), String> {
    let (kind, _) = parse_native_window_label(webview.label())?;
    if input
        .action
        .is_some_and(|action| !action_allowed(kind, action))
    {
        return Err("Azione non consentita per questa finestra".into());
    }
    let reason = validate_action_reason(input.reason)?;
    let _ = schedule_native_window_close(&app, webview.label(), input.action, reason)?;
    Ok(())
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
    match schedule_native_window_close(
        app,
        label,
        Some(action),
        Some("native_window_closed".into()),
    ) {
        Ok(started) => started,
        Err(_) => {
            // If native state is unavailable, never trap the user in a media window.
            runtime.calls.clear_session(&session_id);
            false
        }
    }
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

#[cfg(feature = "calls-qa-fixture")]
pub fn install_qa_fixture<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let call = NativeCallDescriptor {
        session_id: "11111111-1111-4111-8111-111111111111".into(),
        call_type: NativeCallType::Video,
        direction: NativeCallDirection::Outgoing,
        display_name: "Partecipante QA".into(),
        guest_mode: false,
        expires_at: None,
    };
    let runtime = app.state::<DesktopRuntime>();
    runtime
        .calls
        .state
        .lock()
        .map_err(|_| "Lo stato della chiamata Desktop non è disponibile")?
        .active = Some(RoutedCall {
        call: call.clone(),
        profile_window_label: "bootstrap".into(),
        credentials: Some(LivekitCredentials {
            server_url: "ws://127.0.0.1:9".into(),
            access_token: "q".repeat(80),
        }),
        action_claimed: false,
    });
    build_call_window(app, &call)?;
    if let Some(window) = app.get_webview_window(&call_label(&call.session_id)) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
    Ok(())
}

#[cfg(feature = "calls-qa-fixture")]
pub fn install_qa_incoming_fixture<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let call = NativeCallDescriptor {
        session_id: "22222222-2222-4222-8222-222222222222".into(),
        call_type: NativeCallType::Audio,
        direction: NativeCallDirection::Incoming,
        display_name: "Partecipante QA".into(),
        guest_mode: false,
        expires_at: None,
    };
    let runtime = app.state::<DesktopRuntime>();
    let mut native = runtime
        .calls
        .state
        .lock()
        .map_err(|_| "Lo stato della chiamata Desktop non è disponibile")?;
    if native.active.is_some() || native.incoming.is_some() {
        return Err("È già attiva una chiamata Desktop".into());
    }
    native.incoming = Some(RoutedCall {
        call: call.clone(),
        profile_window_label: "bootstrap".into(),
        credentials: None,
        action_claimed: false,
    });
    drop(native);
    build_incoming_window(app, &call)
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

    #[test]
    fn terminal_native_actions_are_claimed_exactly_once() {
        let manager = CallManager::new();
        let call = descriptor(Uuid::new_v4().to_string());
        let session_id = call.session_id.clone();
        manager.install_incoming_for_test(call).unwrap();
        let first = manager
            .prepare_action(&session_id, NativeCallAction::Reject, None)
            .unwrap();
        let duplicate = manager
            .prepare_action(&session_id, NativeCallAction::Reject, None)
            .unwrap();
        assert!(first.is_some());
        assert!(duplicate.is_none());
    }

    #[test]
    fn close_preparation_is_reentrant_safe_and_clears_native_state() {
        let manager = CallManager::new();
        let call = descriptor(Uuid::new_v4().to_string());
        let session_id = call.session_id.clone();
        manager.install_incoming_for_test(call).unwrap();
        {
            let mut state = manager.state.lock().unwrap();
            state.active = state.incoming.take();
        }

        let first = manager
            .begin_close(
                NativeWindowKind::Call,
                &session_id,
                Some(NativeCallAction::End),
                Some("native_window_closed".into()),
            )
            .unwrap();
        let NativeClosePreparation::Started(plan) = first else {
            panic!("first close must start");
        };
        assert_eq!(plan.profile_window_label.as_deref(), Some("remote-test"));
        assert_eq!(
            plan.event.as_ref().map(|event| event.action),
            Some(NativeCallAction::End)
        );
        assert!(manager.state.lock().unwrap().active.is_none());

        assert!(matches!(
            manager
                .begin_close(NativeWindowKind::Call, &session_id, None, None)
                .unwrap(),
            NativeClosePreparation::AlreadyClosing
        ));
        manager.finish_close(&plan.close_key);
        let stale = manager
            .begin_close(
                NativeWindowKind::Call,
                &session_id,
                Some(NativeCallAction::End),
                None,
            )
            .unwrap();
        let NativeClosePreparation::Started(stale_plan) = stale else {
            panic!("a stale native window must still be closable");
        };
        assert!(stale_plan.profile_window_label.is_none());
        assert!(stale_plan.event.is_none());
    }

    #[test]
    fn call_and_incoming_close_guards_are_window_specific() {
        let manager = CallManager::new();
        let call = descriptor(Uuid::new_v4().to_string());
        let session_id = call.session_id.clone();
        manager.install_incoming_for_test(call.clone()).unwrap();
        {
            let mut state = manager.state.lock().unwrap();
            let incoming = state.incoming.as_ref().unwrap().clone();
            state.active = Some(incoming);
        }
        assert!(matches!(
            manager
                .begin_close(NativeWindowKind::Call, &session_id, None, None)
                .unwrap(),
            NativeClosePreparation::Started(_)
        ));
        assert!(matches!(
            manager
                .begin_close(NativeWindowKind::Incoming, &session_id, None, None)
                .unwrap(),
            NativeClosePreparation::Started(_)
        ));
    }
}
