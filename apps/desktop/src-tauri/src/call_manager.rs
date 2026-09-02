use crate::{commands::assert_remote_caller, models::BRIDGE_VERSION, runtime::DesktopRuntime};
use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    sync::{
        atomic::{AtomicBool, AtomicU8, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};
use tauri::{
    utils::config::WebviewUrl,
    webview::{PageLoadEvent, WebviewWindowBuilder},
    AppHandle, Emitter, Manager, Runtime, State, WebviewWindow,
};
use tauri_plugin_notification::NotificationExt;
use tokio::sync::{oneshot, watch};
use url::Url;
use uuid::Uuid;

const CALL_LABEL_PREFIX: &str = "call-";
const INCOMING_LABEL_PREFIX: &str = "incoming-";
const CALL_CONTEXT_UPDATED_EVENT: &str = "desktop://call-context-updated";
const REMOTE_ACTION_EVENT: &str = "doflow:desktop-call-action";
const WINDOW_BUILD_TIMEOUT: Duration = Duration::from_secs(5);
const RENDERER_READY_TIMEOUT: Duration = Duration::from_secs(5);

const DEFERRED_QUEUED: u8 = 0;
const DEFERRED_STARTED: u8 = 1;
const DEFERRED_CANCELLED: u8 = 2;

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

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum RendererLifecycle {
    Pending,
    Ready,
    Cancelled,
}

#[derive(Debug)]
struct WindowLaunch {
    kind: NativeWindowKind,
    session_id: String,
    lifecycle: watch::Sender<RendererLifecycle>,
    local_page_started: bool,
    local_page_finished: bool,
}

#[derive(Debug, Default)]
struct NativeCallState {
    incoming: Option<RoutedCall>,
    active: Option<RoutedCall>,
    closing_sessions: HashSet<String>,
    window_launches: HashMap<String, WindowLaunch>,
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

    fn begin_window_launch(
        &self,
        kind: NativeWindowKind,
        session_id: &str,
    ) -> Result<watch::Receiver<RendererLifecycle>, String> {
        let label = kind.label(session_id);
        let mut state = self
            .state
            .lock()
            .map_err(|_| "Lo stato della chiamata Desktop non è disponibile")?;
        let routed = match kind {
            NativeWindowKind::Call => state.active.as_ref(),
            NativeWindowKind::Incoming => state.incoming.as_ref(),
        }
        .filter(|entry| entry.call.session_id == session_id)
        .ok_or("Il contesto della chiamata non è più disponibile")?;
        if routed.call.session_id != session_id {
            return Err("Il contesto della chiamata non è più disponibile".into());
        }
        if let Some(existing) = state.window_launches.get(&label) {
            if existing.kind != kind || existing.session_id != session_id {
                return Err("La finestra chiamata è associata a una sessione diversa".into());
            }
            return Ok(existing.lifecycle.subscribe());
        }
        let (lifecycle, receiver) = watch::channel(RendererLifecycle::Pending);
        state.window_launches.insert(
            label,
            WindowLaunch {
                kind,
                session_id: session_id.to_owned(),
                lifecycle,
                local_page_started: false,
                local_page_finished: false,
            },
        );
        Ok(receiver)
    }

    fn record_local_page_load(
        &self,
        label: &str,
        event: PageLoadEvent,
        is_calls_page: bool,
    ) -> bool {
        if !is_calls_page {
            return false;
        }
        if let Ok(mut state) = self.state.lock() {
            let Some(launch) = state.window_launches.get_mut(label) else {
                return false;
            };
            match event {
                PageLoadEvent::Started => launch.local_page_started = true,
                PageLoadEvent::Finished => {
                    launch.local_page_started = true;
                    launch.local_page_finished = true;
                }
            }
            return true;
        }
        false
    }

    fn mark_renderer_ready(&self, label: &str) -> Result<bool, String> {
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
        if routed.call.session_id != session_id {
            return Err("Il contesto della chiamata non è più disponibile".into());
        }
        let launch = state
            .window_launches
            .get(label)
            .filter(|entry| entry.kind == kind && entry.session_id == session_id)
            .ok_or("La finestra chiamata non è in fase di avvio")?;
        if !launch.local_page_started && !launch.local_page_finished {
            return Err("La pagina locale della chiamata non è stata caricata".into());
        }
        let was_ready = *launch.lifecycle.borrow() == RendererLifecycle::Ready;
        if !was_ready {
            launch.lifecycle.send_replace(RendererLifecycle::Ready);
        }
        Ok(!was_ready)
    }

    fn launch_is(&self, label: &str, expected: RendererLifecycle) -> bool {
        self.state
            .lock()
            .ok()
            .and_then(|state| {
                state
                    .window_launches
                    .get(label)
                    .map(|launch| *launch.lifecycle.borrow())
            })
            .is_some_and(|lifecycle| lifecycle == expected)
    }

    fn has_window_launch(&self, label: &str) -> bool {
        self.state
            .lock()
            .is_ok_and(|state| state.window_launches.contains_key(label))
    }

    fn rollback_window_launch(
        &self,
        kind: NativeWindowKind,
        session_id: &str,
    ) -> Result<Option<(String, NativeCallActionEvent)>, String> {
        let label = kind.label(session_id);
        let mut state = self
            .state
            .lock()
            .map_err(|_| "Lo stato della chiamata Desktop non è disponibile")?;
        if let Some(launch) = state.window_launches.remove(&label) {
            launch.lifecycle.send_replace(RendererLifecycle::Cancelled);
        }
        state.closing_sessions.remove(&label);
        let routed = match kind {
            NativeWindowKind::Incoming => state
                .incoming
                .take_if(|entry| entry.call.session_id == session_id),
            NativeWindowKind::Call => state
                .active
                .take_if(|entry| entry.call.session_id == session_id),
        };
        if kind == NativeWindowKind::Incoming {
            return Ok(None);
        }
        Ok(routed.and_then(|entry| {
            (!entry.action_claimed).then(|| {
                (
                    entry.profile_window_label,
                    NativeCallActionEvent {
                        session_id: session_id.to_owned(),
                        action: NativeCallAction::Failed,
                        reason: Some("desktop_window_unavailable".into()),
                    },
                )
            })
        }))
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
        if let Some(launch) = state.window_launches.remove(&close_key) {
            launch.lifecycle.send_replace(RendererLifecycle::Cancelled);
        }
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
            let labels = [call_label(session_id), incoming_label(session_id)];
            for label in labels {
                if let Some(launch) = state.window_launches.remove(&label) {
                    launch.lifecycle.send_replace(RendererLifecycle::Cancelled);
                }
                state.closing_sessions.remove(&label);
            }
        }
    }

    pub fn clear_all(&self) {
        if let Ok(mut state) = self.state.lock() {
            state.incoming = None;
            state.active = None;
            state.closing_sessions.clear();
            for (_, launch) in state.window_launches.drain() {
                launch.lifecycle.send_replace(RendererLifecycle::Cancelled);
            }
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

impl NativeWindowKind {
    fn label(self, session_id: &str) -> String {
        match self {
            Self::Call => call_label(session_id),
            Self::Incoming => incoming_label(session_id),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum NativeWindowBuild {
    Created,
    Existing,
}

#[derive(Debug, Default)]
struct DeferredWindowGuard {
    phase: AtomicU8,
    expired: AtomicBool,
}

impl DeferredWindowGuard {
    fn begin(&self) -> bool {
        self.phase
            .compare_exchange(
                DEFERRED_QUEUED,
                DEFERRED_STARTED,
                Ordering::AcqRel,
                Ordering::Acquire,
            )
            .is_ok()
    }

    fn expire(&self) -> bool {
        self.expired.store(true, Ordering::Release);
        self.phase
            .compare_exchange(
                DEFERRED_QUEUED,
                DEFERRED_CANCELLED,
                Ordering::AcqRel,
                Ordering::Acquire,
            )
            .is_ok()
    }

    fn is_expired(&self) -> bool {
        self.expired.load(Ordering::Acquire)
    }
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

#[cfg(feature = "calls-qa-fixture")]
fn qa_window_dimensions(default: (f64, f64), minimum: (f64, f64)) -> (f64, f64) {
    let base = if std::env::var("DOFLOW_CALLS_QA_MINIMUM_WINDOW").as_deref() == Ok("1") {
        minimum
    } else {
        default
    };
    let scale = match std::env::var("DOFLOW_CALLS_QA_SCALE").as_deref() {
        Ok("1.25") => 1.25,
        Ok("1.5") => 1.5,
        _ => 1.0,
    };
    (base.0 * scale, base.1 * scale)
}

#[cfg(not(feature = "calls-qa-fixture"))]
fn qa_window_dimensions(default: (f64, f64), _minimum: (f64, f64)) -> (f64, f64) {
    default
}

fn build_incoming_window<R: Runtime>(
    app: &AppHandle<R>,
    call: &NativeCallDescriptor,
) -> Result<NativeWindowBuild, String> {
    let label = incoming_label(&call.session_id);
    if app.get_webview_window(&label).is_some() {
        return Ok(NativeWindowBuild::Existing);
    }
    let (width, height) = qa_window_dimensions((420.0, 280.0), (380.0, 250.0));
    WebviewWindowBuilder::new(app, &label, WebviewUrl::App("calls.html".into()))
        .title("Chiamata Doflow in arrivo")
        .inner_size(width, height)
        .min_inner_size(380.0, 250.0)
        .resizable(false)
        .decorations(true)
        .always_on_top(true)
        .skip_taskbar(false)
        .background_color(tauri::window::Color(5, 7, 14, 255))
        .center()
        .visible(false)
        .focused(false)
        .on_page_load(show_local_call_shell)
        .build()
        .map(|_| NativeWindowBuild::Created)
        .map_err(|_| "Impossibile aprire la chiamata in arrivo".into())
}

fn build_call_window<R: Runtime>(
    app: &AppHandle<R>,
    call: &NativeCallDescriptor,
) -> Result<NativeWindowBuild, String> {
    let label = call_label(&call.session_id);
    if app.get_webview_window(&label).is_some() {
        return Ok(NativeWindowBuild::Existing);
    }
    let (width, height) = qa_window_dimensions((1080.0, 700.0), (640.0, 520.0));
    WebviewWindowBuilder::new(app, &label, WebviewUrl::App("calls.html".into()))
        .title("Doflow Calls")
        .inner_size(width, height)
        .min_inner_size(640.0, 520.0)
        .resizable(true)
        .decorations(true)
        .background_color(tauri::window::Color(5, 7, 14, 255))
        .center()
        .visible(false)
        .focused(false)
        .on_page_load(show_local_call_shell)
        .build()
        .map(|_| NativeWindowBuild::Created)
        .map_err(|_| "Impossibile aprire la finestra chiamata".into())
}

fn show_local_call_shell<R: Runtime>(
    window: WebviewWindow<R>,
    payload: tauri::webview::PageLoadPayload<'_>,
) {
    if parse_native_window_label(window.label()).is_err() {
        return;
    }
    let event = payload.event();
    let is_calls_page = payload.url().path().ends_with("/calls.html");
    let registered = window
        .state::<DesktopRuntime>()
        .calls
        .record_local_page_load(window.label(), event, is_calls_page);
    if matches!(event, PageLoadEvent::Finished) && is_calls_page && registered {
        // The bundled calls.html contains a dark, non-sensitive pre-React fallback. Showing it
        // only after navigation prevents the WebView2 default white surface from flashing.
        let _ = window.show();
        if !window
            .state::<DesktopRuntime>()
            .calls
            .has_window_launch(window.label())
        {
            let _ = window.hide();
        }
    }
}

fn show_ready_window<R: Runtime>(app: &AppHandle<R>, label: &str) -> Result<(), String> {
    let runtime = app.state::<DesktopRuntime>();
    let calls = &runtime.calls;
    if !calls.launch_is(label, RendererLifecycle::Ready) {
        return Err("La finestra chiamata non è più attiva".into());
    }
    let window = app
        .get_webview_window(label)
        .ok_or("La finestra chiamata non è disponibile")?;
    let result = window
        .show()
        .and_then(|_| window.unminimize())
        .and_then(|_| window.set_focus())
        .map_err(|_| "Impossibile mostrare la finestra chiamata".into());
    if !calls.launch_is(label, RendererLifecycle::Ready) {
        let _ = window.hide();
        return Err("La finestra chiamata è stata chiusa durante l'avvio".into());
    }
    result
}

fn hide_window<R: Runtime>(app: &AppHandle<R>, label: &str) {
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.hide();
    }
}

fn schedule_destroy_window<R: Runtime>(app: &AppHandle<R>, label: String) -> Result<(), String> {
    let close_app = app.clone();
    app.run_on_main_thread(move || destroy_window(&close_app, &label))
        .map_err(|_| "Impossibile pianificare la chiusura della finestra chiamata".into())
}

async fn build_window_after_ipc<R, F>(
    app: AppHandle<R>,
    label: String,
    build: F,
) -> Result<NativeWindowBuild, String>
where
    R: Runtime,
    F: FnOnce(&AppHandle<R>) -> Result<NativeWindowBuild, String> + Send + 'static,
{
    // Tauri dispatches an async command away from WebMessageReceived. This explicit yield plus
    // run_on_main_thread ensures WebView construction cannot be nested in the caller's IPC hook.
    tokio::task::yield_now().await;
    let guard = Arc::new(DeferredWindowGuard::default());
    let (sender, receiver) = oneshot::channel();
    let scheduled_app = app.clone();
    let scheduled_guard = guard.clone();
    let scheduled_label = label.clone();
    app.run_on_main_thread(move || {
        if !scheduled_guard.begin() {
            let _ = sender.send(Err("Creazione finestra chiamata annullata".into()));
            return;
        }
        let result = build(&scheduled_app);
        if scheduled_guard.is_expired() && result.is_ok() {
            hide_window(&scheduled_app, &scheduled_label);
            let _ = schedule_destroy_window(&scheduled_app, scheduled_label);
        }
        let _ = sender.send(result);
    })
    .map_err(|_| "Impossibile pianificare la finestra chiamata".to_owned())?;

    match tokio::time::timeout(WINDOW_BUILD_TIMEOUT, receiver).await {
        Ok(Ok(result)) => result,
        Ok(Err(_)) => Err("Creazione finestra chiamata interrotta".into()),
        Err(_) => {
            let cancelled_before_start = guard.expire();
            if cancelled_before_start {
                Err("Creazione finestra chiamata scaduta prima dell'avvio".into())
            } else {
                Err("Creazione finestra chiamata non responsiva".into())
            }
        }
    }
}

async fn wait_for_renderer_ready(
    receiver: watch::Receiver<RendererLifecycle>,
) -> Result<(), String> {
    wait_for_renderer_ready_with_timeout(receiver, RENDERER_READY_TIMEOUT).await
}

async fn wait_for_renderer_ready_with_timeout(
    mut receiver: watch::Receiver<RendererLifecycle>,
    timeout: Duration,
) -> Result<(), String> {
    let wait = async {
        loop {
            match *receiver.borrow_and_update() {
                RendererLifecycle::Ready => return Ok(()),
                RendererLifecycle::Cancelled => {
                    return Err("Avvio finestra chiamata annullato".into())
                }
                RendererLifecycle::Pending => {}
            }
            receiver
                .changed()
                .await
                .map_err(|_| "Avvio finestra chiamata interrotto".to_owned())?;
        }
    };
    tokio::time::timeout(timeout, wait)
        .await
        .map_err(|_| "Il renderer della chiamata non ha risposto".to_owned())?
}

fn rollback_failed_window<R: Runtime>(
    app: &AppHandle<R>,
    kind: NativeWindowKind,
    session_id: &str,
) {
    let label = kind.label(session_id);
    let failure = app
        .state::<DesktopRuntime>()
        .calls
        .rollback_window_launch(kind, session_id)
        .ok()
        .flatten();
    hide_window(app, &label);
    let _ = schedule_destroy_window(app, label);
    if let Some((profile_label, event)) = failure {
        let notify_app = app.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let _ = dispatch_remote_action_to_profile(&notify_app, &profile_label, event);
        });
    }
}

async fn launch_native_window<R: Runtime>(
    app: AppHandle<R>,
    kind: NativeWindowKind,
    call: NativeCallDescriptor,
    renderer: watch::Receiver<RendererLifecycle>,
) -> Result<(), String> {
    let session_id = call.session_id.clone();
    let label = kind.label(&session_id);
    let build_call = call.clone();
    let build_result =
        build_window_after_ipc(app.clone(), label.clone(), move |build_app| match kind {
            NativeWindowKind::Incoming => build_incoming_window(build_app, &build_call),
            NativeWindowKind::Call => build_call_window(build_app, &build_call),
        })
        .await;
    if let Err(error) = build_result {
        rollback_failed_window(&app, kind, &session_id);
        return Err(error);
    }
    if let Err(error) = wait_for_renderer_ready(renderer).await {
        rollback_failed_window(&app, kind, &session_id);
        return Err(error);
    }
    if let Err(error) = show_ready_window(&app, &label) {
        rollback_failed_window(&app, kind, &session_id);
        return Err(error);
    }
    Ok(())
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
    // Hiding is the fail-open local privacy boundary. It must not wait for React, the
    // profile WebView, the backend, or the deferred destruction path.
    hide_window(app, label);
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
        if schedule_destroy_window(&close_app, close_label.clone()).is_err() {
            // Scheduling can fail only while the runtime is shutting down. A best-effort
            // direct destroy keeps explicit exit fail-open without trapping the user.
            destroy_window(&close_app, &close_label);
        }
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
pub async fn show_incoming_desktop_call<R: Runtime>(
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
    let renderer = match state
        .calls
        .begin_window_launch(NativeWindowKind::Incoming, &call.session_id)
    {
        Ok(renderer) => renderer,
        Err(error) => {
            let _ = state
                .calls
                .rollback_window_launch(NativeWindowKind::Incoming, &call.session_id);
            return Err(error);
        }
    };
    launch_native_window(app.clone(), NativeWindowKind::Incoming, call, renderer).await?;
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
pub async fn open_desktop_call<R: Runtime>(
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
    let renderer = match state
        .calls
        .begin_window_launch(NativeWindowKind::Call, &call.session_id)
    {
        Ok(renderer) => renderer,
        Err(error) => {
            rollback_failed_window(&app, NativeWindowKind::Call, &call.session_id);
            return Err(error);
        }
    };
    launch_native_window(app, NativeWindowKind::Call, call, renderer).await
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
pub fn native_call_window_ready<R: Runtime>(
    _app: AppHandle<R>,
    webview: WebviewWindow<R>,
    state: State<'_, DesktopRuntime>,
) -> Result<(), String> {
    let label = webview.label().to_owned();
    state.calls.mark_renderer_ready(&label)?;

    #[cfg(feature = "calls-qa-fixture")]
    if std::env::var("DOFLOW_CALLS_QA_MODE").as_deref() == Ok("ipc") {
        let close_app = _app.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(Duration::from_millis(250)).await;
            if let Some(window) = close_app.get_webview_window(&label) {
                let _ = window.close();
            }
        });
    }

    Ok(())
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
pub fn install_qa_ipc_fixture<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let mode = std::env::var("DOFLOW_CALLS_QA_MODE").unwrap_or_else(|_| "ipc".into());
    if !matches!(mode.as_str(), "ipc" | "incoming" | "active") {
        return Err("Modalità QA Calls non valida".into());
    }
    let runtime = app.state::<DesktopRuntime>();
    *runtime
        .active
        .lock()
        .map_err(|_| "Lo stato del profilo Desktop non è disponibile")? =
        Some(crate::runtime::ActiveProfile {
            profile_id: "33333333-3333-4333-8333-333333333333".into(),
            webview_label: "bootstrap".into(),
            existing: false,
            ready: true,
        });

    let mode_json = serde_json::to_string(&mode).map_err(|_| "Modalità QA non serializzabile")?;
    let bridge_version = BRIDGE_VERSION;
    let script = format!(
        r#"
(() => {{
  const mode = {mode_json};
  const invoke = window.__TAURI_INTERNALS__?.invoke;
  if (typeof invoke !== 'function') return;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const bounded = (promise, name) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(name + '_timeout')), 4500)),
  ]);
  const incoming = {{
    schemaVersion: {bridge_version},
    call: {{
      sessionId: '22222222-2222-4222-8222-222222222222',
      callType: 'audio',
      direction: 'incoming',
      displayName: 'Partecipante QA',
      guestMode: false,
    }},
  }};
  const active = {{
    schemaVersion: {bridge_version},
    call: {{
      sessionId: '11111111-1111-4111-8111-111111111111',
      callType: 'video',
      direction: 'outgoing',
      displayName: 'Partecipante QA',
      guestMode: false,
    }},
    credentials: {{
      serverUrl: 'ws://127.0.0.1:9',
      accessToken: 'qa-only-synthetic-credential-not-valid-for-any-provider-000000000000',
    }},
  }};
  const verify = {{
    schemaVersion: {bridge_version},
    call: {{
      sessionId: '44444444-4444-4444-8444-444444444444',
      callType: 'audio',
      direction: 'incoming',
      displayName: 'Verifica cleanup QA',
      guestMode: false,
    }},
  }};

  void (async () => {{
    document.documentElement.dataset.callsQa = 'running';
    if (mode !== 'active') {{
      await bounded(invoke('show_incoming_desktop_call', {{ input: incoming }}), 'incoming_ipc');
      document.documentElement.dataset.callsQaIncoming = 'ready';
      if (mode === 'incoming') return;
      await bounded(invoke('show_incoming_desktop_call', {{ input: incoming }}), 'incoming_idempotency');
      document.documentElement.dataset.callsQaIncomingIdempotent = 'pass';
      await sleep(700);
    }}
    await bounded(invoke('open_desktop_call', {{ input: active }}), 'active_ipc');
    document.documentElement.dataset.callsQaActive = 'ready';
    if (mode === 'active') return;
    await bounded(invoke('open_desktop_call', {{ input: active }}), 'active_idempotency');
    document.documentElement.dataset.callsQaActiveIdempotent = 'pass';
    await sleep(700);
    await bounded(invoke('show_incoming_desktop_call', {{ input: verify }}), 'cleanup_ipc');
    document.documentElement.dataset.callsQaCleanup = 'ready';
    await sleep(700);
    document.documentElement.dataset.callsQa = 'pass';
    document.title = 'Doflow Calls QA — PASS';
    await invoke('quit_desktop');
  }})().catch((error) => {{
    document.documentElement.dataset.callsQa = 'failed';
    document.documentElement.dataset.callsQaFailure = String(error?.message || 'unknown').slice(0, 80);
    document.title = 'Doflow Calls QA — FAIL';
  }});
}})();
"#,
    );
    app.get_webview_window("bootstrap")
        .ok_or("Finestra QA bootstrap non disponibile")?
        .eval(script)
        .map_err(|_| "Impossibile avviare il test IPC Calls".into())
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

    #[test]
    fn deferred_guard_cancels_before_start_and_marks_started_timeouts() {
        let cancelled = DeferredWindowGuard::default();
        assert!(cancelled.expire());
        assert!(!cancelled.begin());
        assert!(cancelled.is_expired());

        let started = DeferredWindowGuard::default();
        assert!(started.begin());
        assert!(!started.expire());
        assert!(started.is_expired());
    }

    #[tokio::test]
    async fn incoming_renderer_ready_is_validated_and_idempotent() {
        let manager = CallManager::new();
        let call = descriptor(Uuid::new_v4().to_string());
        let label = incoming_label(&call.session_id);
        manager.install_incoming_for_test(call.clone()).unwrap();
        let receiver = manager
            .begin_window_launch(NativeWindowKind::Incoming, &call.session_id)
            .unwrap();

        assert!(manager.mark_renderer_ready(&label).is_err());
        manager.record_local_page_load(&label, PageLoadEvent::Started, true);
        assert!(manager.mark_renderer_ready(&label).unwrap());
        assert!(!manager.mark_renderer_ready(&label).unwrap());
        wait_for_renderer_ready_with_timeout(receiver, Duration::from_millis(20))
            .await
            .unwrap();
        assert!(manager.mark_renderer_ready("remote-profile").is_err());
    }

    #[tokio::test]
    async fn active_renderer_ready_requires_matching_active_state() {
        let manager = CallManager::new();
        let call = descriptor(Uuid::new_v4().to_string());
        manager.install_incoming_for_test(call.clone()).unwrap();
        {
            let mut state = manager.state.lock().unwrap();
            state.active = state.incoming.take();
        }
        let receiver = manager
            .begin_window_launch(NativeWindowKind::Call, &call.session_id)
            .unwrap();
        manager.record_local_page_load(
            &call_label(&call.session_id),
            PageLoadEvent::Finished,
            true,
        );
        assert!(manager
            .mark_renderer_ready(&call_label(&call.session_id))
            .unwrap());
        wait_for_renderer_ready_with_timeout(receiver, Duration::from_millis(20))
            .await
            .unwrap();
        assert!(manager
            .mark_renderer_ready(&incoming_label(&call.session_id))
            .is_err());
    }

    #[tokio::test]
    async fn renderer_watchdog_times_out_and_close_cancels_pending_waiters() {
        let (_sender, pending) = watch::channel(RendererLifecycle::Pending);
        assert!(
            wait_for_renderer_ready_with_timeout(pending, Duration::from_millis(5))
                .await
                .is_err()
        );

        let manager = CallManager::new();
        let call = descriptor(Uuid::new_v4().to_string());
        manager.install_incoming_for_test(call.clone()).unwrap();
        let receiver = manager
            .begin_window_launch(NativeWindowKind::Incoming, &call.session_id)
            .unwrap();
        assert!(matches!(
            manager
                .begin_close(NativeWindowKind::Incoming, &call.session_id, None, None)
                .unwrap(),
            NativeClosePreparation::Started(_)
        ));
        assert!(
            wait_for_renderer_ready_with_timeout(receiver, Duration::from_millis(20))
                .await
                .is_err()
        );
    }

    #[tokio::test]
    async fn failed_window_rollbacks_are_session_scoped_and_active_failure_is_once() {
        let incoming_manager = CallManager::new();
        let incoming = descriptor(Uuid::new_v4().to_string());
        incoming_manager
            .install_incoming_for_test(incoming.clone())
            .unwrap();
        let receiver = incoming_manager
            .begin_window_launch(NativeWindowKind::Incoming, &incoming.session_id)
            .unwrap();
        assert!(incoming_manager
            .rollback_window_launch(NativeWindowKind::Incoming, &incoming.session_id)
            .unwrap()
            .is_none());
        assert!(incoming_manager.state.lock().unwrap().incoming.is_none());
        assert!(
            wait_for_renderer_ready_with_timeout(receiver, Duration::from_millis(20))
                .await
                .is_err()
        );

        let active_manager = CallManager::new();
        let active = descriptor(Uuid::new_v4().to_string());
        active_manager
            .install_incoming_for_test(active.clone())
            .unwrap();
        {
            let mut state = active_manager.state.lock().unwrap();
            state.active = state.incoming.take();
        }
        active_manager
            .begin_window_launch(NativeWindowKind::Call, &active.session_id)
            .unwrap();
        let failure = active_manager
            .rollback_window_launch(NativeWindowKind::Call, &active.session_id)
            .unwrap()
            .expect("active launch must produce one failure event");
        assert_eq!(failure.1.action, NativeCallAction::Failed);
        assert!(active_manager
            .rollback_window_launch(NativeWindowKind::Call, &active.session_id)
            .unwrap()
            .is_none());
        assert!(active_manager.state.lock().unwrap().active.is_none());
    }
}
