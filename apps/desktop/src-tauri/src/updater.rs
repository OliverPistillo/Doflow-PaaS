use crate::models::{
    DesktopUpdateState, PolicySource, ReleasePolicy, UpdateKind, UpdateProgressPayload,
};
use atomic_write_file::AtomicWriteFile;
use semver::Version;
use std::{
    io::Write,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::Duration,
};
use tauri::{AppHandle, Emitter, Runtime};
use tauri_plugin_updater::{Update, UpdaterExt};
use thiserror::Error;
use url::Url;

const UPDATER_ENDPOINT: &str =
    "https://github.com/OliverPistillo/Doflow-PaaS/releases/latest/download/latest.json";
const POLICY_ENDPOINT: &str =
    "https://github.com/OliverPistillo/Doflow-PaaS/releases/latest/download/desktop-policy.json";

#[derive(Debug, Error)]
pub enum UpdateError {
    #[error("updater is not configured for public releases")]
    NotConfigured,
    #[error("update state lock failed")]
    Lock,
    #[error("update metadata is invalid")]
    InvalidMetadata,
    #[error("no verified update is ready to install")]
    NoPendingUpdate,
    #[error("an update is already being installed")]
    AlreadyInstalling,
    #[error("update operation failed")]
    Operation,
}

pub struct UpdateManager {
    app_data_dir: PathBuf,
    pending: Mutex<Option<Update>>,
    state: Mutex<DesktopUpdateState>,
    installing: AtomicBool,
}

impl UpdateManager {
    pub fn new(app_data_dir: PathBuf, current_version: String) -> Self {
        Self {
            app_data_dir,
            pending: Mutex::new(None),
            state: Mutex::new(DesktopUpdateState {
                kind: UpdateKind::Unavailable,
                current_version,
                latest_version: None,
                minimum_supported_version: None,
                message: Some("Update check not started".into()),
                policy_source: PolicySource::None,
                update_available: false,
                can_continue_without_update: true,
            }),
            installing: AtomicBool::new(false),
        }
    }

    pub fn current_state(&self) -> Result<DesktopUpdateState, UpdateError> {
        self.state
            .lock()
            .map_err(|_| UpdateError::Lock)
            .map(|state| state.clone())
    }

    pub async fn check<R: Runtime>(
        &self,
        app: &AppHandle<R>,
    ) -> Result<DesktopUpdateState, UpdateError> {
        let current = Version::parse(&app.package_info().version.to_string())
            .map_err(|_| UpdateError::InvalidMetadata)?;
        let policy_future = self.resolve_policy();
        let update_future = async {
            if option_env!("DOFLOW_UPDATER_PUBLIC_KEY").is_none() {
                return Err(UpdateError::NotConfigured);
            }
            let endpoint =
                Url::parse(UPDATER_ENDPOINT).map_err(|_| UpdateError::InvalidMetadata)?;
            let updater = app
                .updater_builder()
                .endpoints(vec![endpoint])
                .map_err(|_| UpdateError::InvalidMetadata)?
                .timeout(Duration::from_secs(6))
                .build()
                .map_err(|_| UpdateError::InvalidMetadata)?;
            match tokio::time::timeout(Duration::from_secs(7), updater.check()).await {
                Ok(Ok(update)) => Ok(update),
                _ => Err(UpdateError::Operation),
            }
        };

        let (policy_result, update_result) = tokio::join!(policy_future, update_future);
        let (policy, source) = policy_result.unwrap_or((None, PolicySource::None));
        let policy_unavailable = policy.is_none();
        let update_failed = update_result.is_err();
        let update = update_result.ok().flatten();
        let latest_result =
            parse_stable_version(update.as_ref().map(|value| value.version.as_str()));
        let metadata_invalid = latest_result.is_err();
        let latest = latest_result.unwrap_or(None);

        let mut state = classify_update(&current, latest.as_ref(), policy.as_ref(), source)?;
        if metadata_invalid {
            state.message = Some("Update metadata is invalid".into());
            if state.kind == UpdateKind::None {
                state.kind = UpdateKind::Unavailable;
            }
        } else if update_failed || (policy_unavailable && update.is_none()) {
            state.message = Some(if option_env!("DOFLOW_UPDATER_PUBLIC_KEY").is_none() {
                "Updater signing public key is not configured in this local build".into()
            } else if policy_unavailable {
                "Update policy is temporarily unavailable".into()
            } else {
                "Update service is temporarily unavailable".into()
            });
            if state.kind == UpdateKind::None {
                state.kind = UpdateKind::Unavailable;
            }
        }

        let pending = if state.update_available && !metadata_invalid {
            update
        } else {
            None
        };
        *self.pending.lock().map_err(|_| UpdateError::Lock)? = pending;
        *self.state.lock().map_err(|_| UpdateError::Lock)? = state.clone();
        Ok(state)
    }

    pub async fn install<R: Runtime>(&self, app: &AppHandle<R>) -> Result<(), UpdateError> {
        let update = self
            .pending
            .lock()
            .map_err(|_| UpdateError::Lock)?
            .clone()
            .ok_or(UpdateError::NoPendingUpdate)?;
        self.begin_install()?;
        let downloaded = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0));
        let progress = downloaded.clone();
        let app_progress = app.clone();
        let app_finished = app.clone();
        let total = std::sync::Arc::new(Mutex::new(None::<u64>));
        let total_progress = total.clone();

        let _ = app.emit(
            "desktop://update-progress",
            UpdateProgressPayload {
                downloaded: 0,
                total: None,
                phase: "starting".into(),
                message: None,
            },
        );

        let result = update
            .download_and_install(
                move |chunk, content_length| {
                    use std::sync::atomic::Ordering;
                    let next = progress.fetch_add(chunk as u64, Ordering::Relaxed) + chunk as u64;
                    if let Ok(mut known_total) = total_progress.lock() {
                        if known_total.is_none() {
                            *known_total = content_length;
                        }
                    }
                    let _ = app_progress.emit(
                        "desktop://update-progress",
                        UpdateProgressPayload {
                            downloaded: next,
                            total: content_length,
                            phase: "downloading".into(),
                            message: None,
                        },
                    );
                },
                move || {
                    use std::sync::atomic::Ordering;
                    let total_value = total.lock().ok().and_then(|value| *value);
                    let _ = app_finished.emit(
                        "desktop://update-progress",
                        UpdateProgressPayload {
                            downloaded: downloaded.load(Ordering::Relaxed),
                            total: total_value,
                            phase: "installing".into(),
                            message: None,
                        },
                    );
                },
            )
            .await;

        if result.is_err() {
            self.finish_install();
            let _ = app.emit(
                "desktop://update-progress",
                UpdateProgressPayload {
                    downloaded: 0,
                    total: None,
                    phase: "failed".into(),
                    message: Some(
                        "Download, signature verification, or installation failed".into(),
                    ),
                },
            );
            return Err(UpdateError::Operation);
        }
        app.restart();
    }

    fn begin_install(&self) -> Result<(), UpdateError> {
        self.installing
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map(|_| ())
            .map_err(|_| UpdateError::AlreadyInstalling)
    }

    fn finish_install(&self) {
        self.installing.store(false, Ordering::Release);
    }

    async fn resolve_policy(&self) -> Result<(Option<ReleasePolicy>, PolicySource), UpdateError> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .map_err(|_| UpdateError::Operation)?;
        let network = async {
            let response = client
                .get(POLICY_ENDPOINT)
                .header(reqwest::header::ACCEPT, "application/json")
                .send()
                .await
                .map_err(|_| UpdateError::Operation)?;
            if !response.status().is_success() {
                return Err(UpdateError::Operation);
            }
            let raw = response.text().await.map_err(|_| UpdateError::Operation)?;
            let policy = parse_policy(&raw)?;
            self.cache_policy(&raw)?;
            Ok((Some(policy), PolicySource::Network))
        };

        match network.await {
            Ok(value) => Ok(value),
            Err(_) => match self.read_cached_policy() {
                Ok(Some(policy)) => Ok((Some(policy), PolicySource::Cache)),
                _ => Ok((None, PolicySource::None)),
            },
        }
    }

    fn policy_cache_path(&self) -> PathBuf {
        self.app_data_dir.join("desktop-policy.cache.json")
    }

    fn cache_policy(&self, raw: &str) -> Result<(), UpdateError> {
        std::fs::create_dir_all(&self.app_data_dir).map_err(|_| UpdateError::Operation)?;
        let mut file =
            AtomicWriteFile::open(self.policy_cache_path()).map_err(|_| UpdateError::Operation)?;
        file.write_all(raw.as_bytes())
            .map_err(|_| UpdateError::Operation)?;
        file.sync_all().map_err(|_| UpdateError::Operation)?;
        file.commit().map_err(|_| UpdateError::Operation)
    }

    fn read_cached_policy(&self) -> Result<Option<ReleasePolicy>, UpdateError> {
        let path = self.policy_cache_path();
        if !path.exists() {
            return Ok(None);
        }
        let raw = std::fs::read_to_string(path).map_err(|_| UpdateError::Operation)?;
        parse_policy(&raw).map(Some)
    }
}

pub fn updater_plugin<R: Runtime>() -> tauri::plugin::TauriPlugin<R, tauri_plugin_updater::Config> {
    let builder = tauri_plugin_updater::Builder::new();
    if let Some(public_key) = option_env!("DOFLOW_UPDATER_PUBLIC_KEY") {
        builder.pubkey(public_key).build()
    } else {
        builder.build()
    }
}

fn parse_policy(raw: &str) -> Result<ReleasePolicy, UpdateError> {
    if raw.len() > 16_384 {
        return Err(UpdateError::InvalidMetadata);
    }
    let policy: ReleasePolicy =
        serde_json::from_str(raw).map_err(|_| UpdateError::InvalidMetadata)?;
    if policy.schema_version != 1 || policy.channel != "stable" {
        return Err(UpdateError::InvalidMetadata);
    }
    let minimum = Version::parse(&policy.minimum_supported_version)
        .map_err(|_| UpdateError::InvalidMetadata)?;
    if !minimum.pre.is_empty() || !minimum.build.is_empty() {
        return Err(UpdateError::InvalidMetadata);
    }
    Ok(policy)
}

fn parse_stable_version(raw: Option<&str>) -> Result<Option<Version>, UpdateError> {
    let version = raw
        .map(Version::parse)
        .transpose()
        .map_err(|_| UpdateError::InvalidMetadata)?;
    if version
        .as_ref()
        .is_some_and(|value| !value.pre.is_empty() || !value.build.is_empty())
    {
        return Err(UpdateError::InvalidMetadata);
    }
    Ok(version)
}

fn classify_update(
    current: &Version,
    latest: Option<&Version>,
    policy: Option<&ReleasePolicy>,
    policy_source: PolicySource,
) -> Result<DesktopUpdateState, UpdateError> {
    if latest.is_some_and(|version| !version.pre.is_empty()) {
        return Err(UpdateError::InvalidMetadata);
    }
    let minimum = policy
        .map(|value| Version::parse(&value.minimum_supported_version))
        .transpose()
        .map_err(|_| UpdateError::InvalidMetadata)?;
    let kind = if minimum.as_ref().is_some_and(|version| current < version) {
        UpdateKind::Mandatory
    } else if latest.is_some_and(|version| current < version) {
        UpdateKind::Optional
    } else {
        UpdateKind::None
    };
    let can_continue_without_update = minimum.as_ref().is_none_or(|version| current >= version);
    Ok(DesktopUpdateState {
        kind,
        current_version: current.to_string(),
        latest_version: latest.map(ToString::to_string),
        minimum_supported_version: minimum.map(|value| value.to_string()),
        message: None,
        policy_source,
        update_available: latest.is_some_and(|version| current < version),
        can_continue_without_update,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn policy(minimum: &str) -> ReleasePolicy {
        ReleasePolicy {
            schema_version: 1,
            channel: "stable".into(),
            minimum_supported_version: minimum.into(),
        }
    }

    #[test]
    fn semver_policy_classifies_none_optional_and_mandatory() {
        let current = Version::parse("1.0.0").unwrap();
        assert_eq!(
            classify_update(
                &current,
                Some(&Version::parse("1.0.0").unwrap()),
                Some(&policy("1.0.0")),
                PolicySource::Network
            )
            .unwrap()
            .kind,
            UpdateKind::None
        );
        let optional = classify_update(
            &current,
            Some(&Version::parse("1.0.1").unwrap()),
            Some(&policy("1.0.0")),
            PolicySource::Network,
        )
        .unwrap();
        assert_eq!(optional.kind, UpdateKind::Optional);
        assert_eq!(optional.current_version, "1.0.0");
        assert_eq!(optional.latest_version.as_deref(), Some("1.0.1"));
        assert_eq!(optional.minimum_supported_version.as_deref(), Some("1.0.0"));
        assert!(optional.update_available);
        assert!(optional.can_continue_without_update);

        let mandatory = classify_update(
            &current,
            Some(&Version::parse("1.2.0").unwrap()),
            Some(&policy("1.1.0")),
            PolicySource::Network,
        )
        .unwrap();
        assert_eq!(mandatory.kind, UpdateKind::Mandatory);
        assert!(!mandatory.can_continue_without_update);
    }

    #[test]
    fn prerelease_and_malformed_policy_are_rejected() {
        let current = Version::parse("1.0.0").unwrap();
        assert!(classify_update(
            &current,
            Some(&Version::parse("1.1.0-beta.1").unwrap()),
            Some(&policy("1.0.0")),
            PolicySource::Network
        )
        .is_err());
        assert!(parse_policy(
            r#"{"schemaVersion":2,"channel":"stable","minimumSupportedVersion":"1.0.0"}"#
        )
        .is_err());
        assert!(parse_policy(
            r#"{"schemaVersion":1,"channel":"stable","minimumSupportedVersion":"not-semver"}"#
        )
        .is_err());
        assert!(parse_policy(
            r#"{"schemaVersion":1,"channel":"stable","minimumSupportedVersion":"1.1.0-rc.1"}"#
        )
        .is_err());
        assert!(parse_stable_version(Some("not-semver")).is_err());
        assert!(parse_stable_version(Some("1.1.0-rc.1")).is_err());
        assert!(parse_stable_version(Some("1.1.0+local")).is_err());
        assert_eq!(
            parse_stable_version(Some("1.1.0")).unwrap(),
            Some(Version::parse("1.1.0").unwrap())
        );
    }

    #[test]
    fn unavailable_policy_never_invents_a_mandatory_update() {
        let current = Version::parse("1.0.0").unwrap();
        let state = classify_update(
            &current,
            Some(&Version::parse("1.0.1").unwrap()),
            None,
            PolicySource::None,
        )
        .unwrap();
        assert_eq!(state.kind, UpdateKind::Optional);
        assert_eq!(state.policy_source, PolicySource::None);
        assert!(state.can_continue_without_update);
    }

    #[test]
    fn newer_installs_are_never_downgraded() {
        let current = Version::parse("1.1.0").unwrap();
        let state = classify_update(
            &current,
            Some(&Version::parse("1.0.1").unwrap()),
            Some(&policy("1.0.0")),
            PolicySource::Network,
        )
        .unwrap();
        assert_eq!(state.kind, UpdateKind::None);
        assert!(!state.update_available);
        assert!(state.can_continue_without_update);
    }

    #[test]
    fn policy_cache_round_trips_only_valid_stable_metadata() {
        let temp = tempfile::TempDir::new().unwrap();
        let manager = UpdateManager::new(temp.path().to_path_buf(), "1.1.0".into());
        let raw = r#"{"schemaVersion":1,"channel":"stable","minimumSupportedVersion":"1.0.0"}"#;
        manager.cache_policy(raw).unwrap();
        assert_eq!(manager.read_cached_policy().unwrap(), Some(policy("1.0.0")));

        std::fs::write(manager.policy_cache_path(), "not-json").unwrap();
        assert!(manager.read_cached_policy().is_err());
    }

    #[test]
    fn install_guard_allows_one_attempt_and_reopens_after_failure() {
        let manager = UpdateManager::new(PathBuf::new(), "1.1.0".into());
        assert!(manager.begin_install().is_ok());
        assert!(matches!(
            manager.begin_install(),
            Err(UpdateError::AlreadyInstalling)
        ));
        manager.finish_install();
        assert!(manager.begin_install().is_ok());
        manager.finish_install();
    }
}
