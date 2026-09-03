use crate::{models::SavedProfile, profile_registry::validate_opaque_id};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::{HashMap, HashSet},
    sync::{Arc, Mutex, Weak},
    time::{Duration, Instant},
};
use thiserror::Error;
use zeroize::{Zeroize, Zeroizing};

const CREDENTIAL_SERVICE: &str = "it.doflow.desktop.login.v1";
const CREDENTIAL_ACCOUNT: &str = "doflow-desktop";
const CREDENTIAL_TARGET_PREFIX: &str = "it.doflow.desktop.login.v1.";
const PENDING_CREDENTIAL_TTL: Duration = Duration::from_secs(10 * 60);
const MAX_PASSWORD_BYTES: usize = 2_048;

#[derive(Debug, Error, Clone, Copy, PartialEq, Eq)]
pub enum CredentialError {
    #[error("Windows secure credential storage is unavailable")]
    Unavailable,
    #[error("The Desktop credential request is invalid")]
    Invalid,
    #[error("The Desktop credential operation failed")]
    Operation,
}

trait CredentialStoreAdapter: Send + Sync {
    fn set_password(&self, target: &str, password: &str) -> Result<(), CredentialError>;
    fn get_password(&self, target: &str) -> Result<Option<Zeroizing<String>>, CredentialError>;
    fn delete_password(&self, target: &str) -> Result<bool, CredentialError>;
}

#[cfg(target_os = "windows")]
struct WindowsCredentialStore {
    store: Arc<windows_native_keyring_store::Store>,
}

#[cfg(target_os = "windows")]
impl WindowsCredentialStore {
    fn new() -> Result<Self, CredentialError> {
        windows_native_keyring_store::Store::new()
            .map(|store| Self { store })
            .map_err(|_| CredentialError::Unavailable)
    }

    fn entry(&self, target: &str) -> Result<keyring_core::Entry, CredentialError> {
        use keyring_core::api::CredentialStoreApi;
        let modifiers = HashMap::from([("target", target), ("persistence", "Local")]);
        self.store
            .build(CREDENTIAL_SERVICE, CREDENTIAL_ACCOUNT, Some(&modifiers))
            .map_err(map_keyring_error)
    }
}

#[cfg(target_os = "windows")]
fn map_keyring_error(error: keyring_core::Error) -> CredentialError {
    match error {
        keyring_core::Error::NoStorageAccess(_)
        | keyring_core::Error::NoDefaultStore
        | keyring_core::Error::NotSupportedByStore(_) => CredentialError::Unavailable,
        keyring_core::Error::Invalid(_, _) | keyring_core::Error::TooLong(_, _) => {
            CredentialError::Invalid
        }
        _ => CredentialError::Operation,
    }
}

#[cfg(target_os = "windows")]
impl CredentialStoreAdapter for WindowsCredentialStore {
    fn set_password(&self, target: &str, password: &str) -> Result<(), CredentialError> {
        self.entry(target)?
            .set_password(password)
            .map_err(map_keyring_error)
    }

    fn get_password(&self, target: &str) -> Result<Option<Zeroizing<String>>, CredentialError> {
        match self.entry(target)?.get_password() {
            Ok(password) => Ok(Some(Zeroizing::new(password))),
            Err(keyring_core::Error::NoEntry) => Ok(None),
            Err(error) => Err(map_keyring_error(error)),
        }
    }

    fn delete_password(&self, target: &str) -> Result<bool, CredentialError> {
        match self.entry(target)?.delete_credential() {
            Ok(()) => Ok(true),
            Err(keyring_core::Error::NoEntry) => Ok(false),
            Err(error) => Err(map_keyring_error(error)),
        }
    }
}

#[cfg(not(target_os = "windows"))]
struct UnsupportedCredentialStore;

#[cfg(not(target_os = "windows"))]
impl CredentialStoreAdapter for UnsupportedCredentialStore {
    fn set_password(&self, _target: &str, _password: &str) -> Result<(), CredentialError> {
        Err(CredentialError::Unavailable)
    }

    fn get_password(&self, _target: &str) -> Result<Option<Zeroizing<String>>, CredentialError> {
        Err(CredentialError::Unavailable)
    }

    fn delete_password(&self, _target: &str) -> Result<bool, CredentialError> {
        Err(CredentialError::Unavailable)
    }
}

struct PendingCredential {
    profile_id: String,
    password: Zeroizing<String>,
    staged_at: Instant,
}

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum CredentialEnrollmentStatus {
    None,
    Saved,
    Unavailable,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedDesktopCredential {
    pub email: String,
    pub password: Zeroizing<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct StageDesktopPasswordInput {
    pub schema_version: u8,
    pub profile_id: String,
    pub password: String,
}

impl Drop for StageDesktopPasswordInput {
    fn drop(&mut self) {
        self.password.zeroize();
    }
}

pub struct CredentialManager {
    store: Box<dyn CredentialStoreAdapter>,
    operations: Mutex<HashMap<String, Weak<Mutex<()>>>>,
    pending: Mutex<HashMap<String, PendingCredential>>,
    claimed_profile_cycles: Mutex<HashSet<String>>,
}

impl CredentialManager {
    pub fn new() -> Self {
        #[cfg(target_os = "windows")]
        let store: Box<dyn CredentialStoreAdapter> = match WindowsCredentialStore::new() {
            Ok(store) => Box::new(store),
            Err(_) => Box::new(UnavailableCredentialStore),
        };
        #[cfg(not(target_os = "windows"))]
        let store: Box<dyn CredentialStoreAdapter> = Box::new(UnsupportedCredentialStore);
        Self::with_store(store)
    }

    fn with_store(store: Box<dyn CredentialStoreAdapter>) -> Self {
        Self {
            store,
            operations: Mutex::new(HashMap::new()),
            pending: Mutex::new(HashMap::new()),
            claimed_profile_cycles: Mutex::new(HashSet::new()),
        }
    }

    fn operation_lock(&self, profile_id: &str) -> Result<Arc<Mutex<()>>, CredentialError> {
        validate_opaque_id(profile_id).map_err(|_| CredentialError::Invalid)?;
        let mut operations = self
            .operations
            .lock()
            .map_err(|_| CredentialError::Operation)?;
        operations.retain(|_, lock| lock.strong_count() > 0);
        if let Some(lock) = operations.get(profile_id).and_then(Weak::upgrade) {
            return Ok(lock);
        }
        let lock = Arc::new(Mutex::new(()));
        operations.insert(profile_id.to_owned(), Arc::downgrade(&lock));
        Ok(lock)
    }

    pub fn begin_profile_cycle(&self, profile_id: &str) -> Result<(), CredentialError> {
        let operation = self.operation_lock(profile_id)?;
        let _guard = operation.lock().map_err(|_| CredentialError::Operation)?;
        self.claimed_profile_cycles
            .lock()
            .map_err(|_| CredentialError::Operation)?
            .remove(profile_id);
        self.pending
            .lock()
            .map_err(|_| CredentialError::Operation)?
            .remove(profile_id);
        Ok(())
    }

    pub fn stage(
        &self,
        profile_id: &str,
        password: Zeroizing<String>,
    ) -> Result<(), CredentialError> {
        validate_opaque_id(profile_id).map_err(|_| CredentialError::Invalid)?;
        if password.is_empty() || password.len() > MAX_PASSWORD_BYTES || password.contains('\0') {
            return Err(CredentialError::Invalid);
        }
        let operation = self.operation_lock(profile_id)?;
        let _guard = operation.lock().map_err(|_| CredentialError::Operation)?;
        let mut pending = self
            .pending
            .lock()
            .map_err(|_| CredentialError::Operation)?;
        pending.insert(
            profile_id.to_owned(),
            PendingCredential {
                profile_id: profile_id.to_owned(),
                password,
                staged_at: Instant::now(),
            },
        );
        Ok(())
    }

    pub fn discard_pending(&self, profile_id: &str) -> Result<(), CredentialError> {
        let operation = self.operation_lock(profile_id)?;
        let _guard = operation.lock().map_err(|_| CredentialError::Operation)?;
        self.pending
            .lock()
            .map_err(|_| CredentialError::Operation)?
            .remove(profile_id);
        Ok(())
    }

    pub fn commit_pending(
        &self,
        profile: &SavedProfile,
    ) -> Result<CredentialEnrollmentStatus, CredentialError> {
        let target = credential_target(profile)?;
        let operation = self.operation_lock(&profile.id)?;
        let _guard = operation.lock().map_err(|_| CredentialError::Operation)?;
        let pending = self
            .pending
            .lock()
            .map_err(|_| CredentialError::Operation)?
            .remove(&profile.id);
        let Some(pending) = pending else {
            return Ok(CredentialEnrollmentStatus::None);
        };
        if pending.profile_id != profile.id || pending.staged_at.elapsed() > PENDING_CREDENTIAL_TTL
        {
            return Ok(CredentialEnrollmentStatus::None);
        }
        match self.store.set_password(&target, &pending.password) {
            Ok(()) => Ok(CredentialEnrollmentStatus::Saved),
            Err(CredentialError::Unavailable) => Ok(CredentialEnrollmentStatus::Unavailable),
            Err(error) => Err(error),
        }
    }

    pub fn take_once(
        &self,
        profile: &SavedProfile,
    ) -> Result<Option<SavedDesktopCredential>, CredentialError> {
        let target = credential_target(profile)?;
        let operation = self.operation_lock(&profile.id)?;
        let _guard = operation.lock().map_err(|_| CredentialError::Operation)?;
        {
            let mut claimed = self
                .claimed_profile_cycles
                .lock()
                .map_err(|_| CredentialError::Operation)?;
            if !claimed.insert(profile.id.clone()) {
                return Ok(None);
            }
        }
        self.store.get_password(&target).map(|password| {
            password.map(|password| SavedDesktopCredential {
                email: profile.email.clone(),
                password,
            })
        })
    }

    pub fn has(&self, profile: &SavedProfile) -> Result<bool, CredentialError> {
        let target = credential_target(profile)?;
        let operation = self.operation_lock(&profile.id)?;
        let _guard = operation.lock().map_err(|_| CredentialError::Operation)?;
        Ok(self.store.get_password(&target)?.is_some())
    }

    pub fn delete(&self, profile: &SavedProfile) -> Result<bool, CredentialError> {
        let target = credential_target(profile)?;
        let operation = self.operation_lock(&profile.id)?;
        let _guard = operation.lock().map_err(|_| CredentialError::Operation)?;
        self.pending
            .lock()
            .map_err(|_| CredentialError::Operation)?
            .remove(&profile.id);
        self.claimed_profile_cycles
            .lock()
            .map_err(|_| CredentialError::Operation)?
            .remove(&profile.id);
        self.store.delete_password(&target)
    }
}

#[cfg(target_os = "windows")]
struct UnavailableCredentialStore;

#[cfg(target_os = "windows")]
impl CredentialStoreAdapter for UnavailableCredentialStore {
    fn set_password(&self, _target: &str, _password: &str) -> Result<(), CredentialError> {
        Err(CredentialError::Unavailable)
    }

    fn get_password(&self, _target: &str) -> Result<Option<Zeroizing<String>>, CredentialError> {
        Err(CredentialError::Unavailable)
    }

    fn delete_password(&self, _target: &str) -> Result<bool, CredentialError> {
        Err(CredentialError::Unavailable)
    }
}

fn credential_target(profile: &SavedProfile) -> Result<String, CredentialError> {
    validate_opaque_id(&profile.id).map_err(|_| CredentialError::Invalid)?;
    if profile.user_id.trim().is_empty()
        || profile.user_id.len() > 128
        || profile.user_id.contains('\0')
    {
        return Err(CredentialError::Invalid);
    }
    let tenant_id = profile.tenant_id.as_deref().unwrap_or("");
    let tenant_slug = profile.tenant_slug.as_deref().unwrap_or("");
    if tenant_id.is_empty() && tenant_slug.is_empty() {
        return Err(CredentialError::Invalid);
    }
    let mut hasher = Sha256::new();
    for value in ["v1", &profile.id, tenant_id, tenant_slug, &profile.user_id] {
        hasher.update((value.len() as u64).to_be_bytes());
        hasher.update(value.as_bytes());
    }
    Ok(format!("{CREDENTIAL_TARGET_PREFIX}{:x}", hasher.finalize()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::profile_registry::now_rfc3339;
    use std::{
        sync::{
            atomic::{AtomicBool, AtomicUsize, Ordering},
            Barrier,
        },
        thread,
    };
    use uuid::Uuid;

    #[derive(Default)]
    struct MemoryCredentialStore {
        entries: Mutex<HashMap<String, Zeroizing<String>>>,
        unavailable: AtomicBool,
    }

    impl CredentialStoreAdapter for Arc<MemoryCredentialStore> {
        fn set_password(&self, target: &str, password: &str) -> Result<(), CredentialError> {
            if self.unavailable.load(Ordering::SeqCst) {
                return Err(CredentialError::Unavailable);
            }
            self.entries
                .lock()
                .map_err(|_| CredentialError::Operation)?
                .insert(target.to_owned(), Zeroizing::new(password.to_owned()));
            Ok(())
        }

        fn get_password(&self, target: &str) -> Result<Option<Zeroizing<String>>, CredentialError> {
            if self.unavailable.load(Ordering::SeqCst) {
                return Err(CredentialError::Unavailable);
            }
            Ok(self
                .entries
                .lock()
                .map_err(|_| CredentialError::Operation)?
                .get(target)
                .map(|value| Zeroizing::new(value.to_string())))
        }

        fn delete_password(&self, target: &str) -> Result<bool, CredentialError> {
            if self.unavailable.load(Ordering::SeqCst) {
                return Err(CredentialError::Unavailable);
            }
            Ok(self
                .entries
                .lock()
                .map_err(|_| CredentialError::Operation)?
                .remove(target)
                .is_some())
        }
    }

    struct InstrumentedCredentialStore {
        entries: Mutex<HashMap<String, Zeroizing<String>>>,
        active_total: AtomicUsize,
        max_total: AtomicUsize,
        active_by_target: Mutex<HashMap<String, usize>>,
        max_by_target: Mutex<HashMap<String, usize>>,
    }

    impl Default for InstrumentedCredentialStore {
        fn default() -> Self {
            Self {
                entries: Mutex::new(HashMap::new()),
                active_total: AtomicUsize::new(0),
                max_total: AtomicUsize::new(0),
                active_by_target: Mutex::new(HashMap::new()),
                max_by_target: Mutex::new(HashMap::new()),
            }
        }
    }

    struct InstrumentedOperation<'a> {
        store: &'a InstrumentedCredentialStore,
        target: String,
    }

    impl Drop for InstrumentedOperation<'_> {
        fn drop(&mut self) {
            self.store.active_total.fetch_sub(1, Ordering::SeqCst);
            if let Ok(mut active) = self.store.active_by_target.lock() {
                if let Some(count) = active.get_mut(&self.target) {
                    *count = count.saturating_sub(1);
                }
            }
        }
    }

    impl InstrumentedCredentialStore {
        fn begin(&self, target: &str) -> InstrumentedOperation<'_> {
            let total = self.active_total.fetch_add(1, Ordering::SeqCst) + 1;
            self.max_total.fetch_max(total, Ordering::SeqCst);
            let target_active = {
                let mut active = self.active_by_target.lock().unwrap();
                let count = active.entry(target.to_owned()).or_default();
                *count += 1;
                *count
            };
            let mut maximum = self.max_by_target.lock().unwrap();
            let recorded = maximum.entry(target.to_owned()).or_default();
            *recorded = (*recorded).max(target_active);
            drop(maximum);
            InstrumentedOperation {
                store: self,
                target: target.to_owned(),
            }
        }

        fn delay(&self, target: &str) {
            let _operation = self.begin(target);
            thread::sleep(Duration::from_millis(120));
        }

        fn maximum_for(&self, target: &str) -> usize {
            self.max_by_target
                .lock()
                .unwrap()
                .get(target)
                .copied()
                .unwrap_or_default()
        }
    }

    impl CredentialStoreAdapter for Arc<InstrumentedCredentialStore> {
        fn set_password(&self, target: &str, password: &str) -> Result<(), CredentialError> {
            self.delay(target);
            self.entries
                .lock()
                .map_err(|_| CredentialError::Operation)?
                .insert(target.to_owned(), Zeroizing::new(password.to_owned()));
            Ok(())
        }

        fn get_password(&self, target: &str) -> Result<Option<Zeroizing<String>>, CredentialError> {
            self.delay(target);
            Ok(self
                .entries
                .lock()
                .map_err(|_| CredentialError::Operation)?
                .get(target)
                .map(|value| Zeroizing::new(value.to_string())))
        }

        fn delete_password(&self, target: &str) -> Result<bool, CredentialError> {
            self.delay(target);
            Ok(self
                .entries
                .lock()
                .map_err(|_| CredentialError::Operation)?
                .remove(target)
                .is_some())
        }
    }

    fn profile(profile_id: Uuid, tenant: &str, user_id: &str) -> SavedProfile {
        SavedProfile {
            id: profile_id.to_string(),
            user_id: user_id.to_owned(),
            tenant_id: Some(tenant.to_owned()),
            tenant_slug: Some(tenant.to_owned()),
            name: "Synthetic user".into(),
            email: "synthetic@example.test".into(),
            avatar_url: None,
            initials: Some("SU".into()),
            created_at: now_rfc3339(),
            last_used_at: now_rfc3339(),
            webview_context_id: profile_id.to_string(),
        }
    }

    #[test]
    fn namespace_separates_profiles_tenants_and_users() {
        let id = Uuid::new_v4();
        let base = profile(id, "tenant-a", "user-a");
        let other_profile = profile(Uuid::new_v4(), "tenant-a", "user-a");
        let other_tenant = profile(id, "tenant-b", "user-a");
        let other_user = profile(id, "tenant-a", "user-b");
        let targets = [
            credential_target(&base).unwrap(),
            credential_target(&other_profile).unwrap(),
            credential_target(&other_tenant).unwrap(),
            credential_target(&other_user).unwrap(),
        ];
        assert_eq!(targets.iter().collect::<HashSet<_>>().len(), targets.len());
        assert!(targets
            .iter()
            .all(|target| target.starts_with(CREDENTIAL_TARGET_PREFIX)));
        assert!(targets.iter().all(|target| !target.contains("tenant-a")));
    }

    #[test]
    fn enrollment_is_explicit_replaces_and_is_one_shot_per_cycle() {
        let store = Arc::new(MemoryCredentialStore::default());
        let manager = CredentialManager::with_store(Box::new(store.clone()));
        let saved = profile(Uuid::new_v4(), "tenant-a", "user-a");

        assert_eq!(
            manager.commit_pending(&saved).unwrap(),
            CredentialEnrollmentStatus::None
        );
        manager
            .stage(&saved.id, Zeroizing::new("first-synthetic-value".into()))
            .unwrap();
        assert_eq!(
            manager.commit_pending(&saved).unwrap(),
            CredentialEnrollmentStatus::Saved
        );
        assert_eq!(
            manager
                .take_once(&saved)
                .unwrap()
                .unwrap()
                .password
                .as_str(),
            "first-synthetic-value"
        );
        assert!(manager.take_once(&saved).unwrap().is_none());

        manager.begin_profile_cycle(&saved.id).unwrap();
        manager
            .stage(
                &saved.id,
                Zeroizing::new("replacement-synthetic-value".into()),
            )
            .unwrap();
        assert_eq!(
            manager.commit_pending(&saved).unwrap(),
            CredentialEnrollmentStatus::Saved
        );
        assert_eq!(
            manager
                .take_once(&saved)
                .unwrap()
                .unwrap()
                .password
                .as_str(),
            "replacement-synthetic-value"
        );
    }

    #[test]
    fn wrong_profile_pending_secret_is_discarded_and_delete_is_idempotent() {
        let store = Arc::new(MemoryCredentialStore::default());
        let manager = CredentialManager::with_store(Box::new(store));
        let first = profile(Uuid::new_v4(), "tenant-a", "user-a");
        let second = profile(Uuid::new_v4(), "tenant-a", "user-a");
        manager
            .stage(&first.id, Zeroizing::new("synthetic-value".into()))
            .unwrap();
        assert_eq!(
            manager.commit_pending(&second).unwrap(),
            CredentialEnrollmentStatus::None
        );
        assert!(!manager.has(&first).unwrap());
        assert!(!manager.delete(&first).unwrap());
    }

    #[test]
    fn unavailable_store_never_creates_a_plaintext_fallback() {
        let store = Arc::new(MemoryCredentialStore::default());
        store.unavailable.store(true, Ordering::SeqCst);
        let manager = CredentialManager::with_store(Box::new(store));
        let saved = profile(Uuid::new_v4(), "tenant-a", "user-a");
        manager
            .stage(&saved.id, Zeroizing::new("synthetic-value".into()))
            .unwrap();
        assert_eq!(
            manager.commit_pending(&saved).unwrap(),
            CredentialEnrollmentStatus::Unavailable
        );
        assert!(manager.take_once(&saved).is_err());
    }

    #[test]
    fn same_target_store_operations_are_strictly_serialized() {
        let store = Arc::new(InstrumentedCredentialStore::default());
        let manager = Arc::new(CredentialManager::with_store(Box::new(store.clone())));
        let saved = profile(Uuid::new_v4(), "tenant-a", "user-a");
        let target = credential_target(&saved).unwrap();
        store.entries.lock().unwrap().insert(
            target.clone(),
            Zeroizing::new("synthetic-race-value".into()),
        );
        let start = Arc::new(Barrier::new(4));
        let workers = (0..3)
            .map(|_| {
                let manager = manager.clone();
                let saved = saved.clone();
                let start = start.clone();
                thread::spawn(move || {
                    start.wait();
                    manager.has(&saved).unwrap()
                })
            })
            .collect::<Vec<_>>();
        start.wait();
        for worker in workers {
            assert!(worker.join().unwrap());
        }
        assert_eq!(store.maximum_for(&target), 1);
    }

    #[test]
    fn different_credential_targets_can_progress_independently() {
        let store = Arc::new(InstrumentedCredentialStore::default());
        let manager = Arc::new(CredentialManager::with_store(Box::new(store.clone())));
        let first = profile(Uuid::new_v4(), "tenant-a", "user-a");
        let second = profile(Uuid::new_v4(), "tenant-a", "user-b");
        for saved in [&first, &second] {
            store.entries.lock().unwrap().insert(
                credential_target(saved).unwrap(),
                Zeroizing::new("synthetic-parallel-value".into()),
            );
        }
        let start = Arc::new(Barrier::new(3));
        let workers = [first, second]
            .into_iter()
            .map(|saved| {
                let manager = manager.clone();
                let start = start.clone();
                thread::spawn(move || {
                    start.wait();
                    manager.has(&saved).unwrap()
                })
            })
            .collect::<Vec<_>>();
        start.wait();
        for worker in workers {
            assert!(worker.join().unwrap());
        }
        assert!(store.max_total.load(Ordering::SeqCst) >= 2);
    }

    #[test]
    fn stage_commit_and_delete_share_the_profile_operation_lock() {
        let store = Arc::new(MemoryCredentialStore::default());
        let manager = CredentialManager::with_store(Box::new(store));
        let saved = profile(Uuid::new_v4(), "tenant-a", "user-a");
        let first = manager.operation_lock(&saved.id).unwrap();
        let same = manager.operation_lock(&saved.id).unwrap();
        let other = manager.operation_lock(&Uuid::new_v4().to_string()).unwrap();
        assert!(Arc::ptr_eq(&first, &same));
        assert!(!Arc::ptr_eq(&first, &other));
        manager
            .stage(
                &saved.id,
                Zeroizing::new("synthetic-lifecycle-value".into()),
            )
            .unwrap();
        assert_eq!(
            manager.commit_pending(&saved).unwrap(),
            CredentialEnrollmentStatus::Saved
        );
        assert!(manager.delete(&saved).unwrap());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_credential_manager_round_trip_uses_only_a_synthetic_entry() {
        struct Cleanup<'a> {
            store: &'a WindowsCredentialStore,
            target: String,
        }
        impl Drop for Cleanup<'_> {
            fn drop(&mut self) {
                let _ = self.store.delete_password(&self.target);
            }
        }

        let store = WindowsCredentialStore::new().expect("Windows Credential Manager available");
        let target = format!("it.doflow.desktop.test.{}", Uuid::new_v4());
        let cleanup = Cleanup {
            store: &store,
            target: target.clone(),
        };
        let first = Zeroizing::new(format!("synthetic-{}", Uuid::new_v4()));
        let replacement = Zeroizing::new(format!("synthetic-{}", Uuid::new_v4()));
        store.set_password(&target, &first).unwrap();
        let attributes = store.entry(&target).unwrap().get_attributes().unwrap();
        assert_eq!(
            attributes.get("persistence").map(String::as_str),
            Some("Local")
        );
        assert!(store
            .get_password(&target)
            .unwrap()
            .as_ref()
            .is_some_and(|value| value.as_bytes() == first.as_bytes()));
        store.set_password(&target, &replacement).unwrap();
        assert!(store
            .get_password(&target)
            .unwrap()
            .as_ref()
            .is_some_and(|value| value.as_bytes() == replacement.as_bytes()));
        assert!(store.delete_password(&target).unwrap());
        assert!(store.get_password(&target).unwrap().is_none());
        drop(cleanup);
    }
}
