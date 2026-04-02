use std::sync::Arc;

use tauri::AppHandle;
use tokio::sync::Mutex;
use tokio_cron_scheduler::{Job, JobScheduler};

use crate::workflow::executor::WorkflowExecutor;

pub fn start_cron_scheduler(app: &AppHandle, executor: Arc<Mutex<WorkflowExecutor>>) {
    let app_clone = app.clone();
    let executor_clone = executor.clone();

    tauri::async_runtime::spawn(async move {
        let sched = match JobScheduler::new().await {
            Ok(s) => s,
            Err(e) => {
                log::error!("Failed to create cron scheduler: {}", e);
                return;
            }
        };

        let executor_guard = executor_clone.lock().await;
        let workflows = match executor_guard.storage().list() {
            Ok(w) => w,
            Err(e) => {
                log::error!("Failed to list workflows for cron: {}", e);
                return;
            }
        };
        drop(executor_guard);

        for workflow in workflows {
            if let Some(ref cron_expr) = workflow.cron {
                if cron_expr.is_empty() {
                    continue;
                }

                let wf_id = workflow.id.clone();
                let exec = executor_clone.clone();
                let app_c = app_clone.clone();

                match Job::new_async(cron_expr.as_str(), move |_uuid, _lock| {
                    let exec = exec.clone();
                    let app_c = app_c.clone();
                    let id = wf_id.clone();
                    Box::pin(async move {
                        log::info!("Cron triggered for workflow: {}", id);
                        // Show status window for background cron executions
                        let _ = crate::window::open_status_window(&app_c);
                        let guard = exec.lock().await;
                        if let Err(e) = guard.run(&id, app_c).await {
                            log::error!("Cron workflow execution failed: {}", e);
                        }
                    })
                }) {
                    Ok(job) => {
                        if let Err(e) = sched.add(job).await {
                            log::warn!("Failed to add cron job for '{}': {}", workflow.name, e);
                        } else {
                            log::info!(
                                "Registered cron '{}' for workflow '{}'",
                                cron_expr,
                                workflow.name
                            );
                        }
                    }
                    Err(e) => {
                        log::warn!(
                            "Invalid cron expression '{}' for '{}': {}",
                            cron_expr,
                            workflow.name,
                            e
                        );
                    }
                }
            }
        }

        if let Err(e) = sched.start().await {
            log::error!("Failed to start cron scheduler: {}", e);
        }
    });
}
