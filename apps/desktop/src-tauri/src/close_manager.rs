use crate::{preferences::CloseBehavior, runtime::DesktopRuntime};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};
use tauri::{AppHandle, Emitter, Manager, Runtime};

pub const CLOSE_PROMPT_EVENT: &str = "desktop://close-prompt-requested";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CloseAction {
    Prompt,
    Hide,
    Exit,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CloseResolution {
    pub action: CloseAction,
    pub persisted_behavior: CloseBehavior,
}

pub fn action_for(behavior: CloseBehavior) -> CloseAction {
    match behavior {
        CloseBehavior::Ask => CloseAction::Prompt,
        CloseBehavior::Tray => CloseAction::Hide,
        CloseBehavior::Exit => CloseAction::Exit,
    }
}

pub fn resolve_prompt_choice(
    current: CloseBehavior,
    choice: CloseBehavior,
    remember: bool,
) -> Option<CloseResolution> {
    let action = match choice {
        CloseBehavior::Tray => CloseAction::Hide,
        CloseBehavior::Exit => CloseAction::Exit,
        CloseBehavior::Ask => return None,
    };
    Some(CloseResolution {
        action,
        persisted_behavior: if remember { choice } else { current },
    })
}

pub struct CloseManager {
    behavior: Mutex<CloseBehavior>,
    pending_window: Mutex<Option<String>>,
    explicit_exit: AtomicBool,
}

impl CloseManager {
    pub fn new(behavior: CloseBehavior) -> Self {
        Self {
            behavior: Mutex::new(behavior),
            pending_window: Mutex::new(None),
            explicit_exit: AtomicBool::new(false),
        }
    }

    pub fn behavior(&self) -> CloseBehavior {
        self.behavior.lock().map(|value| *value).unwrap_or_default()
    }

    pub fn set_behavior(&self, behavior: CloseBehavior) {
        if let Ok(mut current) = self.behavior.lock() {
            *current = behavior;
        }
    }

    pub fn begin_explicit_exit(&self) {
        self.explicit_exit.store(true, Ordering::SeqCst);
    }

    pub fn is_explicit_exit(&self) -> bool {
        self.explicit_exit.load(Ordering::SeqCst)
    }

    fn set_pending(&self, label: String) {
        if let Ok(mut pending) = self.pending_window.lock() {
            *pending = Some(label);
        }
    }

    fn take_pending(&self) -> Option<String> {
        self.pending_window
            .lock()
            .ok()
            .and_then(|mut pending| pending.take())
    }

    pub fn clear_pending(&self) {
        let _ = self.take_pending();
    }
}

pub fn is_managed_close_window(label: &str) -> bool {
    label == "bootstrap" || label.starts_with("remote-")
}

pub fn request_user_close<R: Runtime>(app: &AppHandle<R>, source_label: &str) {
    let runtime = app.state::<DesktopRuntime>();
    if runtime.close.is_explicit_exit() || !is_managed_close_window(source_label) {
        return;
    }
    match action_for(runtime.close.behavior()) {
        CloseAction::Prompt => {
            runtime.close.set_pending(source_label.to_owned());
            if source_label.starts_with("remote-") {
                hide_window(app, source_label);
            }
            if let Some(bootstrap) = app.get_webview_window("bootstrap") {
                let _ = bootstrap.show();
                let _ = bootstrap.unminimize();
                let _ = bootstrap.set_focus();
            }
            let _ = app.emit_to("bootstrap", CLOSE_PROMPT_EVENT, ());
        }
        CloseAction::Hide => hide_window(app, source_label),
        CloseAction::Exit => exit_desktop(app),
    }
}

pub fn resolve_close_request<R: Runtime>(
    app: &AppHandle<R>,
    behavior: CloseBehavior,
    remember: bool,
) -> Result<(), String> {
    let runtime = app.state::<DesktopRuntime>();
    let resolution = resolve_prompt_choice(runtime.close.behavior(), behavior, remember)
        .ok_or("A concrete close choice is required")?;
    if remember {
        runtime
            .preferences
            .save_close_behavior(resolution.persisted_behavior)
            .map_err(|error| error.to_string())?;
        runtime.close.set_behavior(resolution.persisted_behavior);
    }
    let pending = runtime.close.take_pending();
    match resolution.action {
        CloseAction::Hide => {
            if let Some(label) = pending.as_deref() {
                hide_window(app, label);
            }
            hide_window(app, "bootstrap");
        }
        CloseAction::Exit => exit_desktop(app),
        CloseAction::Prompt => unreachable!("prompt choices never resolve to another prompt"),
    }
    Ok(())
}

pub fn cancel_close_request<R: Runtime>(app: &AppHandle<R>) {
    let runtime = app.state::<DesktopRuntime>();
    if let Some(label) = runtime.close.take_pending() {
        if label.starts_with("remote-") {
            show_window(app, &label);
            hide_window(app, "bootstrap");
        } else {
            show_window(app, "bootstrap");
        }
    }
}

pub fn set_close_behavior<R: Runtime>(
    app: &AppHandle<R>,
    behavior: CloseBehavior,
) -> Result<(), String> {
    let runtime = app.state::<DesktopRuntime>();
    runtime
        .preferences
        .save_close_behavior(behavior)
        .map_err(|error| error.to_string())?;
    runtime.close.set_behavior(behavior);
    Ok(())
}

pub fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    let runtime = app.state::<DesktopRuntime>();
    runtime.close.clear_pending();
    let active = runtime.active.lock().ok().and_then(|active| active.clone());
    let target = user_facing_window_label(active.as_ref());

    if target.starts_with("remote-") {
        show_window(app, target);
        hide_window(app, "bootstrap");
    } else {
        show_window(app, "bootstrap");
    }
}

pub fn user_facing_window_label(active: Option<&crate::runtime::ActiveProfile>) -> &str {
    active
        .filter(|active| active.ready)
        .map(|active| active.webview_label.as_str())
        .unwrap_or("bootstrap")
}

pub fn exit_desktop<R: Runtime>(app: &AppHandle<R>) {
    let runtime = app.state::<DesktopRuntime>();
    runtime.close.begin_explicit_exit();
    app.exit(0);
}

fn hide_window<R: Runtime>(app: &AppHandle<R>, label: &str) {
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.hide();
    }
}

fn show_window<R: Runtime>(app: &AppHandle<R>, label: &str) {
    if let Some(window) = app.get_webview_window(label) {
        #[cfg(target_os = "windows")]
        let _ = window.set_skip_taskbar(false);
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_persisted_policy_maps_to_one_close_action() {
        assert_eq!(action_for(CloseBehavior::Ask), CloseAction::Prompt);
        assert_eq!(action_for(CloseBehavior::Tray), CloseAction::Hide);
        assert_eq!(action_for(CloseBehavior::Exit), CloseAction::Exit);
    }

    #[test]
    fn ask_choices_apply_now_and_only_persist_when_requested() {
        assert_eq!(
            resolve_prompt_choice(CloseBehavior::Ask, CloseBehavior::Tray, false),
            Some(CloseResolution {
                action: CloseAction::Hide,
                persisted_behavior: CloseBehavior::Ask,
            })
        );
        assert_eq!(
            resolve_prompt_choice(CloseBehavior::Ask, CloseBehavior::Tray, true),
            Some(CloseResolution {
                action: CloseAction::Hide,
                persisted_behavior: CloseBehavior::Tray,
            })
        );
        assert_eq!(
            resolve_prompt_choice(CloseBehavior::Ask, CloseBehavior::Exit, false),
            Some(CloseResolution {
                action: CloseAction::Exit,
                persisted_behavior: CloseBehavior::Ask,
            })
        );
        assert_eq!(
            resolve_prompt_choice(CloseBehavior::Ask, CloseBehavior::Exit, true),
            Some(CloseResolution {
                action: CloseAction::Exit,
                persisted_behavior: CloseBehavior::Exit,
            })
        );
        assert_eq!(
            resolve_prompt_choice(CloseBehavior::Ask, CloseBehavior::Ask, true),
            None
        );
    }

    #[test]
    fn direct_policies_and_explicit_tray_exit_are_unambiguous() {
        assert_eq!(action_for(CloseBehavior::Tray), CloseAction::Hide);
        assert_eq!(action_for(CloseBehavior::Exit), CloseAction::Exit);
        let tray_policy = CloseManager::new(CloseBehavior::Tray);
        tray_policy.begin_explicit_exit();
        assert!(tray_policy.is_explicit_exit());
    }

    #[test]
    fn single_instance_restore_selects_ready_remote_or_bootstrap() {
        let ready = crate::runtime::ActiveProfile {
            profile_id: "profile".into(),
            webview_label: "remote-profile".into(),
            existing: true,
            ready: true,
        };
        let preparing = crate::runtime::ActiveProfile {
            ready: false,
            ..ready.clone()
        };
        assert_eq!(user_facing_window_label(Some(&ready)), "remote-profile");
        assert_eq!(user_facing_window_label(Some(&preparing)), "bootstrap");
        assert_eq!(user_facing_window_label(None), "bootstrap");
    }

    #[test]
    fn only_primary_doflow_windows_use_close_policy() {
        assert!(is_managed_close_window("bootstrap"));
        assert!(is_managed_close_window("remote-safe-id"));
        assert!(!is_managed_close_window("oauth"));
        assert!(!is_managed_close_window("updater"));
    }

    #[test]
    fn explicit_exit_is_monotonic() {
        let manager = CloseManager::new(CloseBehavior::Ask);
        assert!(!manager.is_explicit_exit());
        manager.begin_explicit_exit();
        assert!(manager.is_explicit_exit());
    }
}
