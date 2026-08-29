use atomic_write_file::AtomicWriteFile;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};
use thiserror::Error;

pub const DESKTOP_PREFERENCES_VERSION: u8 = 1;

#[derive(Clone, Copy, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum CloseBehavior {
    #[default]
    Ask,
    Tray,
    Exit,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct DesktopPreferences {
    schema_version: u8,
    close_behavior: CloseBehavior,
}

impl Default for DesktopPreferences {
    fn default() -> Self {
        Self {
            schema_version: DESKTOP_PREFERENCES_VERSION,
            close_behavior: CloseBehavior::Ask,
        }
    }
}

#[derive(Debug, Error)]
pub enum PreferencesError {
    #[error("desktop preferences I/O error")]
    Io(#[from] std::io::Error),
    #[error("desktop preferences serialization error")]
    Json(#[from] serde_json::Error),
}

#[derive(Clone, Debug)]
pub struct PreferencesStore {
    app_data_dir: PathBuf,
}

impl PreferencesStore {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self { app_data_dir }
    }

    pub fn path(&self) -> PathBuf {
        self.app_data_dir.join("desktop-preferences.json")
    }

    pub fn load_close_behavior(&self) -> CloseBehavior {
        load_preferences(&self.path())
            .filter(|preferences| preferences.schema_version == DESKTOP_PREFERENCES_VERSION)
            .map(|preferences| preferences.close_behavior)
            .unwrap_or_default()
    }

    pub fn save_close_behavior(
        &self,
        close_behavior: CloseBehavior,
    ) -> Result<(), PreferencesError> {
        fs::create_dir_all(&self.app_data_dir)?;
        let payload = serde_json::to_vec_pretty(&DesktopPreferences {
            schema_version: DESKTOP_PREFERENCES_VERSION,
            close_behavior,
        })?;
        let mut file = AtomicWriteFile::open(self.path())?;
        file.write_all(&payload)?;
        file.write_all(b"\n")?;
        file.sync_all()?;
        file.commit()?;
        Ok(())
    }
}

fn load_preferences(path: &Path) -> Option<DesktopPreferences> {
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn missing_corrupt_and_unsupported_preferences_fall_back_to_ask() {
        let temp = TempDir::new().unwrap();
        let store = PreferencesStore::new(temp.path().to_path_buf());
        assert_eq!(store.load_close_behavior(), CloseBehavior::Ask);

        fs::write(store.path(), b"not json").unwrap();
        assert_eq!(store.load_close_behavior(), CloseBehavior::Ask);

        fs::write(
            store.path(),
            br#"{"schemaVersion":2,"closeBehavior":"tray"}"#,
        )
        .unwrap();
        assert_eq!(store.load_close_behavior(), CloseBehavior::Ask);

        fs::write(
            store.path(),
            br#"{"schemaVersion":1,"closeBehavior":"unknown"}"#,
        )
        .unwrap();
        assert_eq!(store.load_close_behavior(), CloseBehavior::Ask);
    }

    #[test]
    fn tray_and_exit_round_trip_in_a_minimal_atomic_document() {
        let temp = TempDir::new().unwrap();
        let store = PreferencesStore::new(temp.path().to_path_buf());

        store.save_close_behavior(CloseBehavior::Tray).unwrap();
        assert_eq!(store.load_close_behavior(), CloseBehavior::Tray);
        let tray_raw = fs::read_to_string(store.path()).unwrap();
        assert!(tray_raw.contains(r#""schemaVersion": 1"#));
        assert!(tray_raw.contains(r#""closeBehavior": "tray""#));
        assert!(!tray_raw.contains("profile"));
        assert!(!tray_raw.contains("token"));

        store.save_close_behavior(CloseBehavior::Exit).unwrap();
        assert_eq!(store.load_close_behavior(), CloseBehavior::Exit);
        assert!(!store.path().with_extension("tmp").exists());
    }

    #[test]
    fn saving_preferences_does_not_touch_profile_storage() {
        let temp = TempDir::new().unwrap();
        let profile_path = temp.path().join("profiles.json");
        fs::write(&profile_path, b"sentinel").unwrap();
        let store = PreferencesStore::new(temp.path().to_path_buf());

        store.save_close_behavior(CloseBehavior::Tray).unwrap();

        assert_eq!(fs::read(profile_path).unwrap(), b"sentinel");
    }
}
