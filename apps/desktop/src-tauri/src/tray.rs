use crate::{close_manager, preferences::CloseBehavior, runtime::DesktopRuntime};
use tauri::{
    menu::{CheckMenuItemBuilder, Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};

const OPEN_ID: &str = "tray-open";
const ASK_ID: &str = "tray-close-ask";
const TRAY_ID: &str = "tray-close-tray";
const EXIT_POLICY_ID: &str = "tray-close-exit";
const QUIT_ID: &str = "tray-quit";

pub fn setup<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let behavior = app.state::<DesktopRuntime>().close.behavior();
    let open = MenuItem::with_id(app, OPEN_ID, "Apri Doflow", true, None::<&str>)?;
    let ask = CheckMenuItemBuilder::with_id(ASK_ID, "Chiedi ogni volta")
        .checked(behavior == CloseBehavior::Ask)
        .build(app)?;
    let tray = CheckMenuItemBuilder::with_id(TRAY_ID, "Rimani nell’area di notifica")
        .checked(behavior == CloseBehavior::Tray)
        .build(app)?;
    let exit_policy = CheckMenuItemBuilder::with_id(EXIT_POLICY_ID, "Esci da Doflow")
        .checked(behavior == CloseBehavior::Exit)
        .build(app)?;
    let policy = Submenu::with_id_and_items(
        app,
        "tray-close-policy",
        "Quando chiudo Doflow",
        true,
        &[&ask, &tray, &exit_policy],
    )?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, QUIT_ID, "Esci da Doflow", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &policy, &separator, &quit])?;

    let ask_for_event = ask.clone();
    let tray_for_event = tray.clone();
    let exit_for_event = exit_policy.clone();
    let icon = app.default_window_icon().cloned();
    let mut builder = TrayIconBuilder::with_id("doflow-tray")
        .menu(&menu)
        .tooltip("Doflow")
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| {
            let id = event.id().as_ref();
            if id == OPEN_ID {
                close_manager::show_main_window(app);
                return;
            }
            if id == QUIT_ID {
                close_manager::exit_desktop(app);
                return;
            }
            let behavior = match id {
                ASK_ID => Some(CloseBehavior::Ask),
                TRAY_ID => Some(CloseBehavior::Tray),
                EXIT_POLICY_ID => Some(CloseBehavior::Exit),
                _ => None,
            };
            if let Some(behavior) = behavior {
                if close_manager::set_close_behavior(app, behavior).is_ok() {
                    let _ = ask_for_event.set_checked(behavior == CloseBehavior::Ask);
                    let _ = tray_for_event.set_checked(behavior == CloseBehavior::Tray);
                    let _ = exit_for_event.set_checked(behavior == CloseBehavior::Exit);
                }
            }
        })
        .on_tray_icon_event(|tray, event| match event {
            TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            }
            | TrayIconEvent::DoubleClick {
                button: MouseButton::Left,
                ..
            } => close_manager::show_main_window(tray.app_handle()),
            _ => {}
        });
    if let Some(icon) = icon {
        builder = builder.icon(icon);
    }
    builder.build(app)?;
    Ok(())
}
