use std::sync::Arc;

use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tokio::sync::Mutex;

use crate::workflow::executor::WorkflowExecutor;

pub fn register_workflow_shortcuts(app: &AppHandle, executor: Arc<Mutex<WorkflowExecutor>>, status_ready: Arc<tokio::sync::Notify>) {
    let gs = app.global_shortcut();

    let executor_guard = executor.blocking_lock();
    let workflows = match executor_guard.storage().list() {
        Ok(w) => w,
        Err(e) => {
            log::error!("Failed to list workflows for shortcuts: {}", e);
            return;
        }
    };
    drop(executor_guard);

    for workflow in workflows {
        if let Some(ref shortcut_str) = workflow.shortcut {
            if shortcut_str.is_empty() {
                continue;
            }
            let wf_id = workflow.id.clone();
            let app_clone = app.clone();
            let executor_clone = executor.clone();
            let notify = status_ready.clone();

            match gs.on_shortcut(shortcut_str.as_str(), move |_app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    log::info!("Shortcut triggered for workflow: {}", wf_id);
                    let exec = executor_clone.clone();
                    let app_c = app_clone.clone();
                    let id = wf_id.clone();
                    let notify = notify.clone();
                    tauri::async_runtime::spawn(async move {
                        let is_new = crate::window::open_status_window(&app_c)
                            .map(|v| v.is_some())
                            .unwrap_or(false);
                        if is_new {
                            let _ = tokio::time::timeout(
                                std::time::Duration::from_secs(5),
                                notify.notified(),
                            ).await;
                        }
                        let guard = exec.lock().await;
                        if let Err(e) = guard.run(&id, app_c).await {
                            log::error!("Shortcut workflow execution failed: {}", e);
                        }
                    });
                }
            }) {
                Ok(_) => {
                    log::info!(
                        "Registered shortcut '{}' for workflow '{}'",
                        shortcut_str,
                        workflow.name
                    );
                }
                Err(e) => {
                    log::warn!(
                        "Failed to register shortcut '{}' for '{}': {}",
                        shortcut_str,
                        workflow.name,
                        e
                    );
                }
            }
        }
    }
}
