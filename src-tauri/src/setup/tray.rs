use std::sync::Arc;

use tauri::menu::{MenuBuilder, MenuItem, Submenu};
use tauri::tray::{TrayIconBuilder, TrayIconId};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_store::StoreExt;
use tokio::sync::Mutex;

use crate::workflow::executor::WorkflowExecutor;

const TRAY_ID: &str = "deskpipe-tray";
const STORE_NAME: &str = "app_state.json";
const RECENT_KEY: &str = "recent_workflows";
const MAX_RECENT: usize = 5;

pub fn create_tray(app: &AppHandle, executor: Arc<Mutex<WorkflowExecutor>>, status_ready: Arc<tokio::sync::Notify>) {
    let menu = build_tray_menu(app, &executor);

    let executor_for_handler = executor.clone();
    let _ = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("DeskPipe")
        .icon(app.default_window_icon().cloned().unwrap())
        .menu(&menu)
        .on_menu_event(move |app, event| {
            handle_menu_event(app, event, &executor_for_handler, &status_ready);
        })
        .build(app);
}

/// Rebuild the tray menu to reflect current workflows.
/// Call this after saving or deleting a workflow.
pub fn refresh_tray(app: &AppHandle, executor: &Arc<Mutex<WorkflowExecutor>>) {
    let app = app.clone();
    let executor = executor.clone();
    // Must run on main thread to avoid blocking_lock panic in async context
    std::thread::spawn(move || {
        let tray_id = TrayIconId::new(TRAY_ID);
        if let Some(tray) = app.tray_by_id(&tray_id) {
            let menu = build_tray_menu(&app, &executor);
            let _ = tray.set_menu(Some(menu));
        }
    });
}

/// Save a workflow to the recent list in the store.
pub fn save_recent_workflow(app: &AppHandle, workflow_id: &str, workflow_name: &str) {
    if let Ok(store) = app.store(STORE_NAME) {
        let mut recents: Vec<(String, String)> = store
            .get(RECENT_KEY)
            .and_then(|v| serde_json::from_value(v).ok())
            .unwrap_or_default();

        // Remove existing entry for same workflow id
        recents.retain(|(id, _)| id != workflow_id);

        // Prepend new entry
        recents.insert(0, (workflow_id.to_string(), workflow_name.to_string()));

        // Limit to MAX_RECENT
        recents.truncate(MAX_RECENT);

        store.set(RECENT_KEY, serde_json::json!(recents));
        let _ = store.save();
    }
}

/// Update the tray menu with recent workflows.
pub fn update_recent_workflows(app: &AppHandle, workflows: Vec<(String, String)>) {
    if let Ok(store) = app.store(STORE_NAME) {
        let mut recents = workflows;
        recents.truncate(MAX_RECENT);
        store.set(RECENT_KEY, serde_json::json!(recents));
        let _ = store.save();
    }
}

fn get_recent_workflows(app: &AppHandle) -> Vec<(String, String)> {
    if let Ok(store) = app.store(STORE_NAME) {
        store
            .get(RECENT_KEY)
            .and_then(|v| serde_json::from_value(v).ok())
            .unwrap_or_default()
    } else {
        Vec::new()
    }
}

fn handle_menu_event(
    app: &AppHandle,
    event: tauri::menu::MenuEvent,
    executor: &Arc<Mutex<WorkflowExecutor>>,
    status_ready: &Arc<tokio::sync::Notify>,
) {
    let id = event.id().as_ref();
    match id {
        "open" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        "open_settings" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.emit("navigate", "settings");
            }
        }
        "show_status" => {
            let _ = crate::window::open_status_window(app);
        }
        "quit" => {
            app.exit(0);
        }
        _ if id.starts_with("run:") => {
            let workflow_id = id.strip_prefix("run:").unwrap().to_string();
            let exec = executor.clone();
            let app_clone = app.app_handle().clone();
            let is_new = crate::window::open_status_window(app.app_handle())
                .map(|v| v.is_some())
                .unwrap_or(false);
            let notify = status_ready.clone();
            tauri::async_runtime::spawn(async move {
                if is_new {
                    let _ = tokio::time::timeout(
                        std::time::Duration::from_secs(5),
                        notify.notified(),
                    ).await;
                }
                let guard = exec.lock().await;
                if let Err(e) = guard.run(&workflow_id, app_clone).await {
                    log::error!("Tray workflow execution failed: {}", e);
                }
            });
        }
        _ if id.starts_with("recent:") => {
            let workflow_id = id.strip_prefix("recent:").unwrap().to_string();
            let exec = executor.clone();
            let app_clone = app.app_handle().clone();
            let is_new = crate::window::open_status_window(app.app_handle())
                .map(|v| v.is_some())
                .unwrap_or(false);
            let notify = status_ready.clone();
            tauri::async_runtime::spawn(async move {
                if is_new {
                    let _ = tokio::time::timeout(
                        std::time::Duration::from_secs(5),
                        notify.notified(),
                    ).await;
                }
                let guard = exec.lock().await;
                if let Err(e) = guard.run(&workflow_id, app_clone).await {
                    log::error!("Tray recent workflow execution failed: {}", e);
                }
            });
        }
        _ => {}
    }
}

fn build_tray_menu(
    app: &AppHandle,
    executor: &Arc<Mutex<WorkflowExecutor>>,
) -> tauri::menu::Menu<tauri::Wry> {
    let mut builder = MenuBuilder::new(app);

    // Header
    let header =
        MenuItem::with_id(app, "header", "DeskPipe", false, None::<&str>).unwrap();
    builder = builder.item(&header);
    builder = builder.separator();

    // Recent workflows submenu
    let recents = get_recent_workflows(app);
    let recent_submenu = Submenu::with_id(app, "recent_submenu", "最近运行", true).unwrap();
    if recents.is_empty() {
        let empty_item =
            MenuItem::with_id(app, "recent_empty", "暂无记录", false, None::<&str>).unwrap();
        let _ = recent_submenu.append(&empty_item);
    } else {
        for (wf_id, wf_name) in &recents {
            let item_id = format!("recent:{}", wf_id);
            let item =
                MenuItem::with_id(app, item_id.as_str(), wf_name.as_str(), true, None::<&str>)
                    .unwrap();
            let _ = recent_submenu.append(&item);
        }
    }
    builder = builder.item(&recent_submenu);
    builder = builder.separator();

    // Workflow items
    let executor_guard = executor.blocking_lock();
    if let Ok(workflows) = executor_guard.storage().list() {
        if workflows.is_empty() {
            let empty =
                MenuItem::with_id(app, "empty", "暂无工作流", false, None::<&str>).unwrap();
            builder = builder.item(&empty);
        } else {
            for wf in &workflows {
                let label = format!("▶ {}", wf.name);
                let item_id = format!("run:{}", wf.id);
                let item =
                    MenuItem::with_id(app, item_id.as_str(), label, true, None::<&str>).unwrap();
                builder = builder.item(&item);
            }
        }
    }
    drop(executor_guard);

    builder = builder.separator();

    let status_item =
        MenuItem::with_id(app, "show_status", "显示状态窗口", true, None::<&str>).unwrap();
    builder = builder.item(&status_item);

    let settings_item =
        MenuItem::with_id(app, "open_settings", "打开设置", true, None::<&str>).unwrap();
    builder = builder.item(&settings_item);

    let open_item =
        MenuItem::with_id(app, "open", "打开 DeskPipe", true, None::<&str>).unwrap();
    builder = builder.item(&open_item);

    builder = builder.separator();

    let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>).unwrap();
    builder = builder.item(&quit_item);

    builder.build().unwrap()
}
