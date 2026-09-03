use std::{
    fs::File,
    io::Read,
    path::{Path, PathBuf},
};

use tauri::{AppHandle, Manager, Runtime};

#[cfg(not(target_os = "windows"))]
use tauri_plugin_notification::NotificationExt;
#[cfg(target_os = "windows")]
use windows::{
    core::HSTRING,
    Data::Xml::Dom::XmlDocument,
    Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID,
    UI::Notifications::{ToastNotification, ToastNotificationManager},
};

const NOTIFICATION_APP_LOGO_RESOURCE: &str = "notification-app-logo.png";
const NOTIFICATION_TITLE: &str = "Doflow Calls";
const NOTIFICATION_BODY: &str = "Chiamata Doflow in arrivo";
const NOTIFICATION_ALT_TEXT: &str = "Doflow";
const NOTIFICATION_LOGO_PLACEMENT: &str = "appLogoOverride";
const PNG_SIGNATURE: [u8; 8] = [0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a];

#[derive(Clone, Debug, PartialEq, Eq)]
struct IncomingNotification {
    app_id: String,
    title: &'static str,
    body: &'static str,
    logo_path: PathBuf,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
enum NotificationBrandError {
    #[error("notification resource directory is unavailable")]
    ResourceDirectoryUnavailable,
    #[error("notification resource path must be local and absolute")]
    NonLocalResourcePath,
    #[error("notification resource is outside the application resource directory")]
    ResourceOutsideDirectory,
    #[error("notification resource is missing")]
    MissingResource,
    #[error("notification resource is not a valid PNG")]
    InvalidPng,
    #[error("notification delivery failed")]
    DeliveryFailed,
}

impl IncomingNotification {
    fn from_resource_dir(
        app_id: String,
        resource_dir: &Path,
    ) -> Result<Self, NotificationBrandError> {
        let logo_path = resource_dir.join(NOTIFICATION_APP_LOGO_RESOURCE);
        validate_resource_path(resource_dir, &logo_path)?;
        Ok(Self {
            app_id,
            title: NOTIFICATION_TITLE,
            body: NOTIFICATION_BODY,
            logo_path,
        })
    }

    fn xml(&self) -> Result<String, NotificationBrandError> {
        let logo_uri = url::Url::from_file_path(&self.logo_path)
            .map_err(|_| NotificationBrandError::NonLocalResourcePath)?;
        if logo_uri.scheme() != "file" {
            return Err(NotificationBrandError::NonLocalResourcePath);
        }
        let logo_uri = escape_xml(logo_uri.as_str());
        // A square app logo is represented by omitting hint-crop="circle".
        Ok(format!(
            r#"<toast duration="short"><visual><binding template="ToastGeneric"><image placement="{}" src="{logo_uri}" alt="{}"/><text>{}</text><text>{}</text></binding></visual><audio silent="true"/></toast>"#,
            NOTIFICATION_LOGO_PLACEMENT,
            escape_xml(NOTIFICATION_ALT_TEXT),
            escape_xml(self.title),
            escape_xml(self.body),
        ))
    }

    #[cfg(target_os = "windows")]
    fn show(self) -> Result<(), NotificationBrandError> {
        let xml = XmlDocument::new().map_err(|_| NotificationBrandError::DeliveryFailed)?;
        xml.LoadXml(&HSTRING::from(self.xml()?))
            .map_err(|_| NotificationBrandError::DeliveryFailed)?;
        let toast = ToastNotification::CreateToastNotification(&xml)
            .map_err(|_| NotificationBrandError::DeliveryFailed)?;
        let notifier =
            ToastNotificationManager::CreateToastNotifierWithId(&HSTRING::from(&self.app_id))
                .map_err(|_| NotificationBrandError::DeliveryFailed)?;
        notifier
            .Show(&toast)
            .map_err(|_| NotificationBrandError::DeliveryFailed)?;
        std::thread::sleep(std::time::Duration::from_millis(10));
        Ok(())
    }
}

fn escape_xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

pub(crate) fn initialize_windows_identity(app_id: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // SAFETY: the owned HSTRING remains alive for the duration of the synchronous call.
        unsafe { SetCurrentProcessExplicitAppUserModelID(&HSTRING::from(app_id)) }
            .map_err(|_| "Windows application identity initialization failed".to_owned())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app_id;
        Ok(())
    }
}

fn is_unc_path(path: &Path) -> bool {
    let value = path.as_os_str().to_string_lossy().replace('/', "\\");
    value.starts_with("\\\\?\\UNC\\")
        || (value.starts_with("\\\\") && !value.starts_with("\\\\?\\"))
}

fn validate_resource_path(
    resource_dir: &Path,
    candidate: &Path,
) -> Result<(), NotificationBrandError> {
    if !resource_dir.is_absolute()
        || !candidate.is_absolute()
        || is_unc_path(resource_dir)
        || is_unc_path(candidate)
    {
        return Err(NotificationBrandError::NonLocalResourcePath);
    }

    let canonical_dir = resource_dir
        .canonicalize()
        .map_err(|_| NotificationBrandError::ResourceDirectoryUnavailable)?;
    let canonical_candidate = candidate
        .canonicalize()
        .map_err(|_| NotificationBrandError::MissingResource)?;
    if !canonical_candidate.starts_with(&canonical_dir) {
        return Err(NotificationBrandError::ResourceOutsideDirectory);
    }
    if !canonical_candidate.is_file() {
        return Err(NotificationBrandError::MissingResource);
    }

    let mut signature = [0_u8; PNG_SIGNATURE.len()];
    File::open(&canonical_candidate)
        .and_then(|mut file| file.read_exact(&mut signature))
        .map_err(|_| NotificationBrandError::InvalidPng)?;
    if signature != PNG_SIGNATURE {
        return Err(NotificationBrandError::InvalidPng);
    }
    Ok(())
}

pub(crate) fn show_incoming_call<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let resource_dir = app
            .path()
            .resource_dir()
            .map_err(|_| NotificationBrandError::ResourceDirectoryUnavailable.to_string())?;
        let notification =
            IncomingNotification::from_resource_dir(app.config().identifier.clone(), &resource_dir)
                .map_err(|error| error.to_string())?;
        tauri::async_runtime::spawn_blocking(move || {
            if notification.show().is_err() {
                eprintln!("Doflow: Windows notification delivery failed");
            }
        });
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        app.notification()
            .builder()
            .title(NOTIFICATION_TITLE)
            .body(NOTIFICATION_BODY)
            .show()
            .map_err(|_| NotificationBrandError::DeliveryFailed.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn write_png(path: &Path) {
        fs::write(path, PNG_SIGNATURE).expect("write test PNG signature");
    }

    #[test]
    fn preserves_calls_notification_contract_for_production_app_id() {
        let root = tempfile::tempdir().expect("resource dir");
        write_png(&root.path().join(NOTIFICATION_APP_LOGO_RESOURCE));
        let notification =
            IncomingNotification::from_resource_dir("it.doflow.desktop".into(), root.path())
                .expect("valid notification");

        assert_eq!(notification.app_id, "it.doflow.desktop");
        assert_eq!(notification.title, "Doflow Calls");
        assert_eq!(notification.body, "Chiamata Doflow in arrivo");
        assert!(notification.logo_path.is_absolute());
        let xml = notification.xml().expect("notification XML");
        assert!(xml.contains("placement=\"appLogoOverride\""));
        assert!(!xml.contains("hint-crop"));
        assert!(xml.contains("duration=\"short\""));
        assert!(xml.contains("<audio silent=\"true\"/>"));
    }

    #[test]
    fn preserves_calls_notification_contract_for_isolated_qa_app_id() {
        let root = tempfile::tempdir().expect("resource dir");
        let spaced = root.path().join("resource directory with spaces");
        fs::create_dir(&spaced).expect("spaced resource dir");
        write_png(&spaced.join(NOTIFICATION_APP_LOGO_RESOURCE));
        let notification = IncomingNotification::from_resource_dir(
            "it.doflow.desktop.phase1-toast-qa2".into(),
            &spaced,
        )
        .expect("valid notification");

        assert_eq!(notification.app_id, "it.doflow.desktop.phase1-toast-qa2");
        assert_eq!(
            notification
                .logo_path
                .file_name()
                .and_then(|name| name.to_str()),
            Some(NOTIFICATION_APP_LOGO_RESOURCE)
        );
        let xml = notification.xml().expect("notification XML");
        assert!(xml.contains("resource%20directory%20with%20spaces"));
        assert!(!xml.contains("resource directory with spaces"));
        assert!(!xml.contains(r"file:///\\"));
    }

    #[test]
    fn rejects_unc_resource_paths_before_io() {
        let unc = Path::new(r"\\server\share\notification-app-logo.png");
        assert_eq!(
            validate_resource_path(Path::new(r"\\server\share"), unc),
            Err(NotificationBrandError::NonLocalResourcePath)
        );
    }

    #[test]
    fn rejects_resources_outside_the_authorized_directory() {
        let root = tempfile::tempdir().expect("resource dir");
        let outside = tempfile::tempdir().expect("outside dir");
        let candidate = outside.path().join(NOTIFICATION_APP_LOGO_RESOURCE);
        write_png(&candidate);

        assert_eq!(
            validate_resource_path(root.path(), &candidate),
            Err(NotificationBrandError::ResourceOutsideDirectory)
        );
    }

    #[test]
    fn missing_or_invalid_resource_never_panics() {
        let root = tempfile::tempdir().expect("resource dir");
        let candidate = root.path().join(NOTIFICATION_APP_LOGO_RESOURCE);
        assert_eq!(
            validate_resource_path(root.path(), &candidate),
            Err(NotificationBrandError::MissingResource)
        );

        fs::write(&candidate, b"not a png").expect("write invalid resource");
        assert_eq!(
            validate_resource_path(root.path(), &candidate),
            Err(NotificationBrandError::InvalidPng)
        );
    }
}
