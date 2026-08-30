fn main() {
    const COMMANDS: &[&str] = &[
        "load_profile_registry",
        "check_for_updates",
        "get_bootstrap_update_state",
        "prepare_profile_webview",
        "activate_prepared_profile",
        "remove_saved_profile",
        "quit_desktop",
        "minimize_bootstrap",
        "request_desktop_close",
        "resolve_desktop_close",
        "cancel_desktop_close",
        "desktop_ready",
        "register_profile_metadata",
        "request_profile_switch",
        "get_update_state",
        "install_current_verified_update",
        "start_desktop_google_oauth",
        "get_desktop_call_capabilities",
        "show_incoming_desktop_call",
        "dismiss_incoming_desktop_call",
        "open_desktop_call",
        "update_desktop_call_credentials",
        "close_desktop_call",
        "get_native_call_context",
        "send_native_call_action",
    ];

    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
    )
    .expect("failed to build Doflow Desktop metadata");
}
