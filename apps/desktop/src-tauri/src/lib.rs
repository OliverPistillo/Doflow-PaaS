mod commands;
mod models;
mod oauth;
mod profile_registry;
mod profile_webview;
mod runtime;
mod updater;

use profile_registry::ProfileRegistryStore;
use runtime::DesktopRuntime;
use tauri::Manager;
use updater::UpdateManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(updater::updater_plugin())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|error| format!("unable to resolve Doflow app data: {error}"))?;
            let profiles = ProfileRegistryStore::new(app_data_dir.clone());
            let updater = UpdateManager::new(app_data_dir, app.package_info().version.to_string());
            app.manage(DesktopRuntime::new(profiles, updater));
            Ok(())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running Doflow Desktop");
}
