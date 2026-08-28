use crate::models::{ProfileRegistry, SavedProfile, PROFILE_REGISTRY_VERSION};
use atomic_write_file::AtomicWriteFile;
use std::{
    collections::HashSet,
    fs,
    io::Write,
    path::{Path, PathBuf},
};
use thiserror::Error;
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use uuid::{Uuid, Variant, Version};

#[derive(Debug, Error)]
pub enum RegistryError {
    #[error("profile registry I/O error")]
    Io(#[from] std::io::Error),
    #[error("profile registry serialization error")]
    Json(#[from] serde_json::Error),
    #[error("profile registry is invalid: {0}")]
    Invalid(&'static str),
    #[error("profile path is outside the Doflow app data boundary")]
    Boundary,
}

#[derive(Clone, Debug)]
pub struct ProfileRegistryStore {
    app_data_dir: PathBuf,
}

impl ProfileRegistryStore {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self { app_data_dir }
    }

    pub fn registry_path(&self) -> PathBuf {
        self.app_data_dir.join("profiles.json")
    }

    pub fn profiles_root(&self) -> PathBuf {
        self.app_data_dir.join("profiles")
    }

    pub fn load(&self) -> Result<ProfileRegistry, RegistryError> {
        fs::create_dir_all(self.profiles_root())?;
        let path = self.registry_path();
        if !path.exists() {
            let registry = ProfileRegistry::default();
            self.save(&registry)?;
            return Ok(registry);
        }

        let raw = fs::read_to_string(&path)?;
        match serde_json::from_str::<ProfileRegistry>(&raw)
            .map_err(RegistryError::from)
            .and_then(|registry| {
                validate_registry(&registry)?;
                Ok(registry)
            }) {
            Ok(registry) => Ok(registry),
            Err(_) => {
                self.quarantine_corrupt_registry()?;
                let registry = ProfileRegistry {
                    recovered_from_corruption: true,
                    ..ProfileRegistry::default()
                };
                self.save(&registry)?;
                Ok(registry)
            }
        }
    }

    pub fn save(&self, registry: &ProfileRegistry) -> Result<(), RegistryError> {
        validate_registry(registry)?;
        fs::create_dir_all(&self.app_data_dir)?;
        let payload = serde_json::to_vec_pretty(registry)?;
        let mut file = AtomicWriteFile::open(self.registry_path())?;
        file.write_all(&payload)?;
        file.write_all(b"\n")?;
        file.sync_all()?;
        file.commit()?;
        Ok(())
    }

    pub fn profile_dir(&self, profile_id: &str) -> Result<PathBuf, RegistryError> {
        validate_opaque_id(profile_id)?;
        let root = self.profiles_root();
        fs::create_dir_all(&root)?;
        let target = root.join(profile_id);
        if target.parent() != Some(root.as_path()) {
            return Err(RegistryError::Boundary);
        }
        Ok(target)
    }

    pub fn webview_dir(&self, profile_id: &str) -> Result<PathBuf, RegistryError> {
        Ok(self.profile_dir(profile_id)?.join("webview"))
    }

    pub fn upsert_profile(&self, profile: SavedProfile) -> Result<ProfileRegistry, RegistryError> {
        validate_profile(&profile)?;
        let profile_id = profile.id.clone();
        let mut registry = self.load()?;
        if let Some(current) = registry
            .profiles
            .iter_mut()
            .find(|item| item.id == profile.id)
        {
            let created_at = current.created_at.clone();
            *current = SavedProfile {
                created_at,
                ..profile
            };
        } else {
            registry.profiles.push(profile);
        }
        registry.last_used_profile_id = Some(profile_id);
        self.save(&registry)?;
        Ok(registry)
    }

    pub fn mark_last_used(&self, profile_id: &str) -> Result<ProfileRegistry, RegistryError> {
        validate_opaque_id(profile_id)?;
        let mut registry = self.load()?;
        let profile = registry
            .profiles
            .iter_mut()
            .find(|profile| profile.id == profile_id)
            .ok_or(RegistryError::Invalid("profile does not exist"))?;
        profile.last_used_at = now_rfc3339();
        registry.last_used_profile_id = Some(profile_id.to_owned());
        self.save(&registry)?;
        Ok(registry)
    }

    pub fn remove_profile_metadata(
        &self,
        profile_id: &str,
    ) -> Result<ProfileRegistry, RegistryError> {
        validate_opaque_id(profile_id)?;
        let mut registry = self.load()?;
        registry.profiles.retain(|profile| profile.id != profile_id);
        if registry.last_used_profile_id.as_deref() == Some(profile_id) {
            registry.last_used_profile_id = registry
                .profiles
                .iter()
                .max_by(|left, right| left.last_used_at.cmp(&right.last_used_at))
                .map(|profile| profile.id.clone());
        }
        self.save(&registry)?;
        Ok(registry)
    }

    pub fn remove_profile_directory(&self, profile_id: &str) -> Result<(), RegistryError> {
        let root = self.profiles_root();
        let target = self.profile_dir(profile_id)?;
        if !target.exists() {
            return Ok(());
        }
        let root_canonical = fs::canonicalize(&root)?;
        let target_metadata = fs::symlink_metadata(&target)?;
        if target_metadata.file_type().is_symlink() {
            return Err(RegistryError::Boundary);
        }
        let target_canonical = fs::canonicalize(&target)?;
        if target_canonical.parent() != Some(root_canonical.as_path()) {
            return Err(RegistryError::Boundary);
        }
        fs::remove_dir_all(target_canonical)?;
        Ok(())
    }

    fn quarantine_corrupt_registry(&self) -> Result<(), RegistryError> {
        let source = self.registry_path();
        if !source.exists() {
            return Ok(());
        }
        let stamp = OffsetDateTime::now_utc().unix_timestamp_nanos();
        let quarantine = self
            .app_data_dir
            .join(format!("profiles.corrupt.{stamp}.json"));
        fs::rename(source, quarantine)?;
        Ok(())
    }
}

pub fn now_rfc3339() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .expect("RFC3339 formatting cannot fail")
}

pub fn validate_opaque_id(value: &str) -> Result<Uuid, RegistryError> {
    if value.len() != 36 || value.contains("..") || Path::new(value).is_absolute() {
        return Err(RegistryError::Invalid("profile id must be an opaque UUID"));
    }
    let uuid = Uuid::parse_str(value)
        .map_err(|_| RegistryError::Invalid("profile id must be an opaque UUID"))?;
    if uuid.get_version() != Some(Version::Random) || uuid.get_variant() != Variant::RFC4122 {
        return Err(RegistryError::Invalid("profile id must be a UUID v4"));
    }
    Ok(uuid)
}

fn validate_registry(registry: &ProfileRegistry) -> Result<(), RegistryError> {
    if registry.version != PROFILE_REGISTRY_VERSION {
        return Err(RegistryError::Invalid("unsupported schema version"));
    }
    if registry.profiles.len() > 50 {
        return Err(RegistryError::Invalid("too many profiles"));
    }
    let mut ids = HashSet::new();
    for profile in &registry.profiles {
        validate_profile(profile)?;
        if !ids.insert(&profile.id) {
            return Err(RegistryError::Invalid("duplicate profile id"));
        }
    }
    if let Some(last) = &registry.last_used_profile_id {
        validate_opaque_id(last)?;
        if !ids.contains(last) {
            return Err(RegistryError::Invalid("last used profile does not exist"));
        }
    }
    Ok(())
}

fn validate_profile(profile: &SavedProfile) -> Result<(), RegistryError> {
    validate_opaque_id(&profile.id)?;
    validate_opaque_id(&profile.webview_context_id)?;
    if profile.id != profile.webview_context_id {
        return Err(RegistryError::Invalid(
            "webview context must match profile id",
        ));
    }
    validate_bounded(&profile.user_id, 1, 128, "invalid user id")?;
    validate_bounded(&profile.name, 1, 160, "invalid name")?;
    validate_email(&profile.email)?;
    if let Some(value) = &profile.tenant_id {
        validate_slug(value, "invalid tenant id")?;
    }
    if let Some(value) = &profile.tenant_slug {
        validate_slug(value, "invalid tenant slug")?;
    }
    if let Some(value) = &profile.avatar_url {
        if value.len() > 2048 || !value.starts_with("https://") {
            return Err(RegistryError::Invalid("invalid avatar URL"));
        }
    }
    if let Some(value) = &profile.initials {
        if value.is_empty() || value.chars().count() > 4 {
            return Err(RegistryError::Invalid("invalid initials"));
        }
    }
    OffsetDateTime::parse(&profile.created_at, &Rfc3339)
        .map_err(|_| RegistryError::Invalid("invalid created timestamp"))?;
    OffsetDateTime::parse(&profile.last_used_at, &Rfc3339)
        .map_err(|_| RegistryError::Invalid("invalid last used timestamp"))?;
    Ok(())
}

fn validate_email(value: &str) -> Result<(), RegistryError> {
    if value.len() > 254
        || value.chars().any(char::is_whitespace)
        || value.split_once('@').is_none()
        || !value
            .rsplit_once('.')
            .is_some_and(|(left, right)| left.contains('@') && !right.is_empty())
    {
        return Err(RegistryError::Invalid("invalid email"));
    }
    Ok(())
}

fn validate_slug(value: &str, message: &'static str) -> Result<(), RegistryError> {
    if value.is_empty()
        || value.len() > 64
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
    {
        return Err(RegistryError::Invalid(message));
    }
    Ok(())
}

fn validate_bounded(
    value: &str,
    minimum: usize,
    maximum: usize,
    message: &'static str,
) -> Result<(), RegistryError> {
    let length = value.trim().chars().count();
    if length < minimum || length > maximum || value.contains('\0') {
        return Err(RegistryError::Invalid(message));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn profile(id: Uuid, name: &str) -> SavedProfile {
        SavedProfile {
            id: id.to_string(),
            user_id: Uuid::new_v4().to_string(),
            tenant_id: Some("doflow".into()),
            tenant_slug: Some("doflow".into()),
            name: name.into(),
            email: format!("{}@example.test", name.to_lowercase()),
            avatar_url: None,
            initials: Some(name.chars().take(2).collect()),
            created_at: now_rfc3339(),
            last_used_at: now_rfc3339(),
            webview_context_id: id.to_string(),
        }
    }

    #[test]
    fn reads_and_writes_schema_version_atomically() {
        let temp = TempDir::new().unwrap();
        let store = ProfileRegistryStore::new(temp.path().join("doflow"));
        let id = Uuid::new_v4();
        let saved = store.upsert_profile(profile(id, "Oliver")).unwrap();
        assert_eq!(saved.version, 1);
        assert_eq!(store.load().unwrap().profiles[0].id, id.to_string());
        assert!(!store.registry_path().with_extension("tmp").exists());
    }

    #[test]
    fn quarantines_invalid_json_without_deleting_webview_directories() {
        let temp = TempDir::new().unwrap();
        let store = ProfileRegistryStore::new(temp.path().join("doflow"));
        fs::create_dir_all(store.webview_dir(&Uuid::new_v4().to_string()).unwrap()).unwrap();
        fs::create_dir_all(store.registry_path().parent().unwrap()).unwrap();
        fs::write(store.registry_path(), "{not-json").unwrap();
        let loaded = store.load().unwrap();
        assert!(loaded.recovered_from_corruption);
        assert_eq!(fs::read_dir(store.profiles_root()).unwrap().count(), 1);
        assert!(fs::read_dir(store.registry_path().parent().unwrap())
            .unwrap()
            .any(|entry| entry
                .unwrap()
                .file_name()
                .to_string_lossy()
                .starts_with("profiles.corrupt.")));
    }

    #[test]
    fn rejects_malformed_duplicate_and_traversal_ids() {
        assert!(validate_opaque_id("../outside").is_err());
        assert!(validate_opaque_id("C:\\outside").is_err());
        let id = Uuid::new_v4();
        let duplicated = ProfileRegistry {
            version: 1,
            last_used_profile_id: Some(id.to_string()),
            profiles: vec![profile(id, "A"), profile(id, "B")],
            recovered_from_corruption: false,
        };
        assert!(validate_registry(&duplicated).is_err());
    }

    #[test]
    fn removing_selected_profile_updates_last_used_and_preserves_other_directory() {
        let temp = TempDir::new().unwrap();
        let store = ProfileRegistryStore::new(temp.path().join("doflow"));
        let first = Uuid::new_v4();
        let second = Uuid::new_v4();
        store.upsert_profile(profile(first, "First")).unwrap();
        store.upsert_profile(profile(second, "Second")).unwrap();
        fs::create_dir_all(store.webview_dir(&first.to_string()).unwrap()).unwrap();
        fs::create_dir_all(store.webview_dir(&second.to_string()).unwrap()).unwrap();
        let registry = store.remove_profile_metadata(&second.to_string()).unwrap();
        store.remove_profile_directory(&second.to_string()).unwrap();
        assert_eq!(
            registry.last_used_profile_id.as_deref(),
            Some(first.to_string().as_str())
        );
        assert!(store.profile_dir(&first.to_string()).unwrap().exists());
        assert!(!store.profile_dir(&second.to_string()).unwrap().exists());
    }

    #[test]
    fn missing_profile_directory_is_safe_and_context_paths_are_distinct() {
        let temp = TempDir::new().unwrap();
        let store = ProfileRegistryStore::new(temp.path().join("doflow"));
        let first = Uuid::new_v4().to_string();
        let second = Uuid::new_v4().to_string();
        assert_ne!(
            store.webview_dir(&first).unwrap(),
            store.webview_dir(&second).unwrap()
        );
        assert!(store.remove_profile_directory(&first).is_ok());
    }
}
