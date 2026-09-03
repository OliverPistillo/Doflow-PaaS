use crate::{close_manager::is_managed_close_window, runtime::DesktopRuntime};
use atomic_write_file::AtomicWriteFile;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
    time::Duration,
};
use tauri::{AppHandle, Manager, Monitor, PhysicalPosition, PhysicalSize, Runtime, WebviewWindow};
use thiserror::Error;

const WINDOW_STATE_SCHEMA_VERSION: u8 = 1;
const SAVE_DEBOUNCE: Duration = Duration::from_millis(400);
const MIN_LOGICAL_WIDTH: f64 = 760.0;
const MIN_LOGICAL_HEIGHT: f64 = 560.0;
const MIN_VISIBLE_LOGICAL_WIDTH: f64 = 96.0;
const MIN_VISIBLE_LOGICAL_HEIGHT: f64 = 64.0;
const MAX_COORDINATE_ABS: i32 = 2_000_000;
const MAX_DIMENSION: u32 = 65_535;

#[derive(Debug, Error)]
pub enum WindowStateError {
    #[error("main window state I/O error")]
    Io(#[from] std::io::Error),
    #[error("main window state serialization error")]
    Json(#[from] serde_json::Error),
    #[error("main window state is invalid")]
    Invalid,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct WindowBounds {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct WorkArea {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PersistedMainWindowState {
    schema_version: u8,
    normal_bounds: WindowBounds,
    maximized: bool,
    scale_factor: f64,
    monitor_name: Option<String>,
    monitor_work_area: WorkArea,
}

#[derive(Clone, Debug, PartialEq)]
struct MonitorSnapshot {
    name: Option<String>,
    work_area: WorkArea,
    scale_factor: f64,
}

impl From<&Monitor> for MonitorSnapshot {
    fn from(monitor: &Monitor) -> Self {
        Self {
            name: monitor.name().cloned(),
            work_area: WorkArea {
                x: monitor.work_area().position.x,
                y: monitor.work_area().position.y,
                width: monitor.work_area().size.width,
                height: monitor.work_area().size.height,
            },
            scale_factor: monitor.scale_factor(),
        }
    }
}

#[derive(Clone, Debug)]
struct CaptureObservation {
    bounds: WindowBounds,
    maximized: bool,
    minimized: bool,
    monitor: MonitorSnapshot,
}

#[derive(Clone, Debug)]
struct WindowStateStore {
    path: PathBuf,
}

impl WindowStateStore {
    fn new(app_data_dir: &Path) -> Self {
        Self {
            path: app_data_dir.join("main-window-state.json"),
        }
    }

    fn load(&self) -> Option<PersistedMainWindowState> {
        let raw = fs::read(&self.path).ok()?;
        decode_state(&raw).ok()
    }

    fn save(&self, state: &PersistedMainWindowState) -> Result<(), WindowStateError> {
        validate_state(state)?;
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)?;
        }
        let payload = serde_json::to_vec_pretty(state)?;
        let mut file = AtomicWriteFile::open(&self.path)?;
        file.write_all(&payload)?;
        file.write_all(b"\n")?;
        file.sync_all()?;
        file.commit()?;
        Ok(())
    }
}

pub struct MainWindowStateManager {
    store: WindowStateStore,
    current: Mutex<Option<PersistedMainWindowState>>,
    save_generation: AtomicU64,
}

impl MainWindowStateManager {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let store = WindowStateStore::new(&app_data_dir);
        let current = store.load();
        Self {
            store,
            current: Mutex::new(current),
            save_generation: AtomicU64::new(0),
        }
    }

    pub fn restore_or_seed<R: Runtime>(&self, window: &WebviewWindow<R>) {
        if !is_managed_close_window(window.label()) {
            return;
        }
        let saved = self.current.lock().ok().and_then(|value| value.clone());
        if let Some(saved) = saved {
            if let Some(bounds) = resolve_restore_bounds(
                &saved,
                &monitor_snapshots(window),
                primary_monitor_snapshot(window).as_ref(),
            ) {
                let _ = window.set_size(PhysicalSize::new(bounds.width, bounds.height));
                let _ = window.set_position(PhysicalPosition::new(bounds.x, bounds.y));
                if saved.maximized {
                    let _ = window.maximize();
                }
                return;
            }
        }
        if let Some(observation) = capture_observation(window) {
            let next = merge_observation(None, observation);
            if let Ok(mut current) = self.current.lock() {
                *current = next;
            }
        }
    }

    fn capture_and_save<R: Runtime>(&self, window: &WebviewWindow<R>) {
        if !is_managed_close_window(window.label()) {
            return;
        }
        let Some(observation) = capture_observation(window) else {
            return;
        };
        let next = {
            let Ok(mut current) = self.current.lock() else {
                return;
            };
            let next = merge_observation(current.clone(), observation);
            *current = next.clone();
            next
        };
        if let Some(next) = next {
            let _ = self.store.save(&next);
        }
    }

    fn schedule_generation(&self) -> u64 {
        self.save_generation.fetch_add(1, Ordering::SeqCst) + 1
    }

    fn generation_is_current(&self, generation: u64) -> bool {
        self.save_generation.load(Ordering::SeqCst) == generation
    }

    pub fn flush<R: Runtime>(&self, window: &WebviewWindow<R>) {
        self.schedule_generation();
        self.capture_and_save(window);
    }
}

pub fn schedule_main_window_save<R: Runtime>(app: &AppHandle<R>, label: &str) {
    if !is_managed_close_window(label) {
        return;
    }
    let generation = app
        .state::<DesktopRuntime>()
        .main_window
        .schedule_generation();
    let label = label.to_owned();
    let dispatch_app = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(SAVE_DEBOUNCE).await;
        let callback_app = dispatch_app.clone();
        let _ = dispatch_app.run_on_main_thread(move || {
            let runtime = callback_app.state::<DesktopRuntime>();
            if !runtime.main_window.generation_is_current(generation) {
                return;
            }
            if let Some(window) = callback_app.get_webview_window(&label) {
                runtime.main_window.capture_and_save(&window);
            }
        });
    });
}

pub fn flush_main_window<R: Runtime>(app: &AppHandle<R>, label: &str) {
    if let Some(window) = app.get_webview_window(label) {
        app.state::<DesktopRuntime>().main_window.flush(&window);
    }
}

fn capture_observation<R: Runtime>(window: &WebviewWindow<R>) -> Option<CaptureObservation> {
    let scale_factor = window.scale_factor().ok()?;
    let position = window.outer_position().ok()?;
    let size = window.inner_size().ok()?;
    let monitor = window.current_monitor().ok().flatten()?;
    Some(CaptureObservation {
        bounds: WindowBounds {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
        },
        maximized: window.is_maximized().unwrap_or(false),
        minimized: window.is_minimized().unwrap_or(false),
        monitor: MonitorSnapshot {
            scale_factor,
            ..MonitorSnapshot::from(&monitor)
        },
    })
}

fn merge_observation(
    current: Option<PersistedMainWindowState>,
    observation: CaptureObservation,
) -> Option<PersistedMainWindowState> {
    if observation.minimized {
        return current;
    }
    if observation.maximized {
        return current.map(|mut state| {
            state.maximized = true;
            state
        });
    }
    let next = PersistedMainWindowState {
        schema_version: WINDOW_STATE_SCHEMA_VERSION,
        normal_bounds: observation.bounds,
        maximized: false,
        scale_factor: observation.monitor.scale_factor,
        monitor_name: observation.monitor.name,
        monitor_work_area: observation.monitor.work_area,
    };
    validate_state(&next).ok().map(|()| next)
}

fn decode_state(raw: &[u8]) -> Result<PersistedMainWindowState, WindowStateError> {
    let state = serde_json::from_slice(raw)?;
    validate_state(&state)?;
    Ok(state)
}

fn validate_state(state: &PersistedMainWindowState) -> Result<(), WindowStateError> {
    let bounds = state.normal_bounds;
    let work = state.monitor_work_area;
    let valid = state.schema_version == WINDOW_STATE_SCHEMA_VERSION
        && bounds.x.abs() <= MAX_COORDINATE_ABS
        && bounds.y.abs() <= MAX_COORDINATE_ABS
        && bounds.width > 0
        && bounds.height > 0
        && bounds.width <= MAX_DIMENSION
        && bounds.height <= MAX_DIMENSION
        && work.x.abs() <= MAX_COORDINATE_ABS
        && work.y.abs() <= MAX_COORDINATE_ABS
        && work.width > 0
        && work.height > 0
        && work.width <= MAX_DIMENSION
        && work.height <= MAX_DIMENSION
        && state.scale_factor.is_finite()
        && (0.5..=8.0).contains(&state.scale_factor)
        && state.monitor_name.as_ref().is_none_or(|name| {
            !name.trim().is_empty() && name.len() <= 256 && !name.contains('\0')
        });
    if valid {
        Ok(())
    } else {
        Err(WindowStateError::Invalid)
    }
}

fn monitor_snapshots<R: Runtime>(window: &WebviewWindow<R>) -> Vec<MonitorSnapshot> {
    window
        .available_monitors()
        .unwrap_or_default()
        .iter()
        .map(MonitorSnapshot::from)
        .collect()
}

fn primary_monitor_snapshot<R: Runtime>(window: &WebviewWindow<R>) -> Option<MonitorSnapshot> {
    window
        .primary_monitor()
        .ok()
        .flatten()
        .as_ref()
        .map(MonitorSnapshot::from)
}

fn resolve_restore_bounds(
    saved: &PersistedMainWindowState,
    monitors: &[MonitorSnapshot],
    primary: Option<&MonitorSnapshot>,
) -> Option<WindowBounds> {
    validate_state(saved).ok()?;
    let matched = saved.monitor_name.as_ref().and_then(|name| {
        monitors
            .iter()
            .find(|monitor| monitor.name.as_deref() == Some(name.as_str()))
    });
    let target = matched.or(primary).or_else(|| monitors.first())?;
    let ratio = target.scale_factor / saved.scale_factor;
    if !ratio.is_finite() || ratio <= 0.0 {
        return None;
    }
    let min_width = (MIN_LOGICAL_WIDTH * target.scale_factor).round() as u32;
    let min_height = (MIN_LOGICAL_HEIGHT * target.scale_factor).round() as u32;
    let width = ((f64::from(saved.normal_bounds.width) * ratio).round() as u32)
        .max(min_width)
        .min(target.work_area.width);
    let height = ((f64::from(saved.normal_bounds.height) * ratio).round() as u32)
        .max(min_height)
        .min(target.work_area.height);

    let (x, y) = if matched.is_some() {
        let relative_x = f64::from(saved.normal_bounds.x - saved.monitor_work_area.x) * ratio;
        let relative_y = f64::from(saved.normal_bounds.y - saved.monitor_work_area.y) * ratio;
        (
            target.work_area.x.saturating_add(relative_x.round() as i32),
            target.work_area.y.saturating_add(relative_y.round() as i32),
        )
    } else {
        (
            target
                .work_area
                .x
                .saturating_add((target.work_area.width.saturating_sub(width) / 2) as i32),
            target
                .work_area
                .y
                .saturating_add((target.work_area.height.saturating_sub(height) / 2) as i32),
        )
    };
    let minimum_visible_width = (MIN_VISIBLE_LOGICAL_WIDTH * target.scale_factor).round() as i32;
    let minimum_visible_height = (MIN_VISIBLE_LOGICAL_HEIGHT * target.scale_factor).round() as i32;
    let minimum_x = target
        .work_area
        .x
        .saturating_sub(width as i32)
        .saturating_add(minimum_visible_width);
    let maximum_x = target
        .work_area
        .x
        .saturating_add(target.work_area.width as i32)
        .saturating_sub(minimum_visible_width);
    let minimum_y = target.work_area.y;
    let maximum_y = target
        .work_area
        .y
        .saturating_add(target.work_area.height as i32)
        .saturating_sub(minimum_visible_height);
    Some(WindowBounds {
        x: x.clamp(minimum_x, maximum_x.max(minimum_x)),
        y: y.clamp(minimum_y, maximum_y.max(minimum_y)),
        width,
        height,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn monitor(name: &str, x: i32, y: i32, width: u32, height: u32, scale: f64) -> MonitorSnapshot {
        MonitorSnapshot {
            name: Some(name.into()),
            work_area: WorkArea {
                x,
                y,
                width,
                height,
            },
            scale_factor: scale,
        }
    }

    fn state(bounds: WindowBounds, monitor: &MonitorSnapshot) -> PersistedMainWindowState {
        PersistedMainWindowState {
            schema_version: WINDOW_STATE_SCHEMA_VERSION,
            normal_bounds: bounds,
            maximized: false,
            scale_factor: monitor.scale_factor,
            monitor_name: monitor.name.clone(),
            monitor_work_area: monitor.work_area,
        }
    }

    #[test]
    fn atomic_store_round_trips_and_ignores_corrupt_or_old_state() {
        let temp = TempDir::new().unwrap();
        let store = WindowStateStore::new(temp.path());
        let display = monitor("primary", 0, 0, 1920, 1040, 1.0);
        let expected = state(
            WindowBounds {
                x: 180,
                y: 120,
                width: 1180,
                height: 760,
            },
            &display,
        );
        store.save(&expected).unwrap();
        assert_eq!(store.load(), Some(expected));
        fs::write(&store.path, b"{not-json").unwrap();
        assert!(store.load().is_none());
        let mut old = state(
            WindowBounds {
                x: 0,
                y: 0,
                width: 1180,
                height: 760,
            },
            &display,
        );
        old.schema_version = 0;
        fs::write(&store.path, serde_json::to_vec(&old).unwrap()).unwrap();
        assert!(store.load().is_none());
    }

    #[test]
    fn restore_scales_normal_bounds_at_100_125_and_150_percent() {
        let original = monitor("display", 0, 0, 1920, 1040, 1.0);
        let saved = state(
            WindowBounds {
                x: 100,
                y: 80,
                width: 800,
                height: 600,
            },
            &original,
        );
        for (scale, expected_width) in [(1.0, 800), (1.25, 1000), (1.5, 1200)] {
            let target = monitor("display", 0, 0, 3000, 1800, scale);
            let restored =
                resolve_restore_bounds(&saved, std::slice::from_ref(&target), Some(&target))
                    .unwrap();
            assert_eq!(restored.width, expected_width);
            assert_eq!(restored.x, (100.0 * scale).round() as i32);
        }
    }

    #[test]
    fn keeps_a_visible_negative_coordinate_secondary_monitor() {
        let secondary = monitor("left", -1920, -120, 1920, 1080, 1.0);
        let saved = state(
            WindowBounds {
                x: -1780,
                y: -40,
                width: 980,
                height: 700,
            },
            &secondary,
        );
        let primary = monitor("primary", 0, 0, 1920, 1040, 1.0);
        let restored = resolve_restore_bounds(
            &saved,
            &[secondary.clone(), primary.clone()],
            Some(&primary),
        )
        .unwrap();
        assert_eq!(restored.x, -1780);
        assert_eq!(restored.y, -40);
    }

    #[test]
    fn removed_monitor_recenters_on_primary_and_impossible_sizes_are_clamped() {
        let removed = monitor("removed", 2200, 0, 1600, 900, 1.0);
        let saved = state(
            WindowBounds {
                x: 2500,
                y: 90,
                width: 20,
                height: 30,
            },
            &removed,
        );
        let primary = monitor("primary", 0, 0, 1920, 1040, 1.0);
        let restored =
            resolve_restore_bounds(&saved, std::slice::from_ref(&primary), Some(&primary)).unwrap();
        assert_eq!(restored.width, 760);
        assert_eq!(restored.height, 560);
        assert_eq!(restored.x, 580);
        assert_eq!(restored.y, 240);
    }

    #[test]
    fn minimized_never_overwrites_normal_bounds_and_maximize_round_trips() {
        let display = monitor("primary", 0, 0, 1920, 1040, 1.0);
        let original = state(
            WindowBounds {
                x: 120,
                y: 100,
                width: 1000,
                height: 700,
            },
            &display,
        );
        let minimized = CaptureObservation {
            bounds: WindowBounds {
                x: -32000,
                y: -32000,
                width: 160,
                height: 28,
            },
            maximized: false,
            minimized: true,
            monitor: display.clone(),
        };
        assert_eq!(
            merge_observation(Some(original.clone()), minimized),
            Some(original.clone())
        );
        let maximized = CaptureObservation {
            bounds: original.normal_bounds,
            maximized: true,
            minimized: false,
            monitor: display.clone(),
        };
        let maximized_state = merge_observation(Some(original.clone()), maximized).unwrap();
        assert!(maximized_state.maximized);
        assert_eq!(maximized_state.normal_bounds, original.normal_bounds);
        let normal = CaptureObservation {
            bounds: WindowBounds {
                x: 210,
                y: 140,
                width: 1100,
                height: 720,
            },
            maximized: false,
            minimized: false,
            monitor: display,
        };
        let restored = merge_observation(Some(maximized_state), normal).unwrap();
        assert!(!restored.maximized);
        assert_eq!(restored.normal_bounds.x, 210);
        assert_eq!(restored.normal_bounds.width, 1100);
    }

    #[test]
    fn debounce_generation_invalidates_stale_move_and_resize_writes() {
        let temp = TempDir::new().unwrap();
        let manager = MainWindowStateManager::new(temp.path().to_path_buf());
        let first = manager.schedule_generation();
        let second = manager.schedule_generation();
        assert!(!manager.generation_is_current(first));
        assert!(manager.generation_is_current(second));
    }

    #[test]
    fn calls_and_incoming_windows_are_never_main_window_state_targets() {
        assert!(is_managed_close_window("bootstrap"));
        assert!(is_managed_close_window(
            "remote-10000000-4000-4000-8000-000000000001"
        ));
        assert!(!is_managed_close_window(
            "incoming-10000000-4000-4000-8000-000000000001"
        ));
        assert!(!is_managed_close_window(
            "call-10000000-4000-4000-8000-000000000001"
        ));
    }
}
