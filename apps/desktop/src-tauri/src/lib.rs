mod call_manager;
mod close_manager;
mod commands;
mod models;
mod oauth;
mod preferences;
mod profile_registry;
mod profile_webview;
mod runtime;
mod tray;
mod updater;

use preferences::PreferencesStore;
use profile_registry::ProfileRegistryStore;
use runtime::DesktopRuntime;
use tauri::{Manager, WindowEvent};
use updater::UpdateManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            close_manager::show_main_window(app);
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(updater::updater_plugin())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|error| format!("unable to resolve Doflow app data: {error}"))?;
            let profiles = ProfileRegistryStore::new(app_data_dir.clone());
            let preferences = PreferencesStore::new(app_data_dir.clone());
            let updater = UpdateManager::new(app_data_dir, app.package_info().version.to_string());
            app.manage(DesktopRuntime::new(profiles, updater, preferences));
            tray::setup(app.handle())?;
            #[cfg(feature = "calls-qa-fixture")]
            {
                let qa_app = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_millis(350)).await;
                    let create_app = qa_app.clone();
                    let _ = qa_app.run_on_main_thread(move || {
                        let status = match call_manager::install_qa_fixture(&create_app) {
                            Ok(()) => "started",
                            Err(_) => "failed",
                        };
                        if let Some(bootstrap) = create_app.get_webview_window("bootstrap") {
                            let _ = bootstrap.eval(format!(
                                "document.body.dataset.callsQaFixture = {status:?};"
                            ));
                            let _ = bootstrap.set_title(&format!("Doflow Calls QA — {status}"));
                            if status == "started" {
                                let _ = bootstrap.hide();
                                let incoming_app = create_app.clone();
                                tauri::async_runtime::spawn(async move {
                                    for _ in 0..120 {
                                        tokio::time::sleep(std::time::Duration::from_millis(250))
                                            .await;
                                        if incoming_app
                                            .webview_windows()
                                            .keys()
                                            .any(|label| label.starts_with("call-"))
                                        {
                                            continue;
                                        }
                                        let create_incoming = incoming_app.clone();
                                        let _ = incoming_app.run_on_main_thread(move || {
                                            let _ = call_manager::install_qa_incoming_fixture(
                                                &create_incoming,
                                            );
                                        });
                                        break;
                                    }
                                });
                            }
                        }
                    });
                });
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let label = window.label();
                if call_manager::handle_native_close_requested(window.app_handle(), label) {
                    api.prevent_close();
                } else if close_manager::is_managed_close_window(label) {
                    let runtime = window.app_handle().state::<DesktopRuntime>();
                    if !runtime.close.is_explicit_exit() {
                        api.prevent_close();
                        close_manager::request_user_close(window.app_handle(), label);
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::load_profile_registry,
            commands::check_for_updates,
            commands::get_bootstrap_update_state,
            commands::prepare_profile_webview,
            commands::activate_prepared_profile,
            commands::remove_saved_profile,
            commands::desktop_ready,
            commands::register_profile_metadata,
            commands::request_profile_switch,
            commands::get_update_state,
            commands::install_current_verified_update,
            commands::start_desktop_google_oauth,
            commands::quit_desktop,
            commands::minimize_bootstrap,
            commands::request_desktop_close,
            commands::resolve_desktop_close,
            commands::cancel_desktop_close,
            call_manager::get_desktop_call_capabilities,
            call_manager::show_incoming_desktop_call,
            call_manager::dismiss_incoming_desktop_call,
            call_manager::open_desktop_call,
            call_manager::update_desktop_call_credentials,
            call_manager::close_desktop_call,
            call_manager::get_native_call_context,
            call_manager::send_native_call_action,
            call_manager::close_native_call_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Doflow Desktop");
}
