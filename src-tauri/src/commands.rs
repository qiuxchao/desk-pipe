use std::sync::Arc;

use tauri::AppHandle;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tokio::sync::Mutex;

use crate::workflow::executor::WorkflowExecutor;
use crate::workflow::types::Workflow;

pub struct AppState {
    pub executor: Arc<Mutex<WorkflowExecutor>>,
    pub debug_tx: Arc<Mutex<Option<tokio::sync::mpsc::Sender<String>>>>,
    pub status_ready: Arc<tokio::sync::Notify>,
}

// ==================== Workflow CRUD ====================

#[tauri::command]
pub async fn save_workflow(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    workflow_json: String,
) -> Result<String, String> {
    let workflow: Workflow = serde_json::from_str(&workflow_json).map_err(|e| e.to_string())?;
    let id = workflow.id.clone();
    let executor = state.executor.lock().await;
    executor.storage().save(&workflow)?;
    drop(executor);
    crate::setup::tray::refresh_tray(&app, &state.executor);
    Ok(id)
}

#[tauri::command]
pub async fn load_workflow(
    state: tauri::State<'_, AppState>,
    workflow_id: String,
) -> Result<String, String> {
    let executor = state.executor.lock().await;
    let workflow = executor.storage().load(&workflow_id)?;
    serde_json::to_string(&workflow).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_workflows(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let executor = state.executor.lock().await;
    let workflows = executor.storage().list()?;
    serde_json::to_string(&workflows).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_workflow(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    workflow_id: String,
) -> Result<(), String> {
    let executor = state.executor.lock().await;
    executor.storage().delete(&workflow_id)?;
    drop(executor);
    crate::setup::tray::refresh_tray(&app, &state.executor);
    Ok(())
}

// ==================== Workflow Execution ====================

#[tauri::command]
pub async fn execute_workflow(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    workflow_id: String,
) -> Result<(), String> {
    // Save to recent workflows list
    {
        let executor = state.executor.lock().await;
        if let Ok(wf) = executor.storage().load(&workflow_id) {
            crate::setup::tray::save_recent_workflow(&app, &workflow_id, &wf.name);
        }
    }

    // Refresh tray to show updated recent list
    crate::setup::tray::refresh_tray(&app, &state.executor);

    let executor = state.executor.clone();
    let app_clone = app.clone();
    let wf_id = workflow_id.clone();

    // Open status window and wait for frontend to be ready
    let is_new_window = crate::window::open_status_window(&app)
        .map(|v| v.is_some())
        .unwrap_or(false);
    let status_ready = state.status_ready.clone();

    tauri::async_runtime::spawn(async move {
        // Only wait if this is a freshly created window
        if is_new_window {
            let _ = tokio::time::timeout(
                std::time::Duration::from_secs(5),
                status_ready.notified(),
            ).await;
        }
        let exec = executor.lock().await;
        if let Err(e) = exec.run(&wf_id, app_clone).await {
            log::error!("Workflow execution failed: {}", e);
        }
    });

    Ok(())
}

// ==================== Debug Execution ====================

#[tauri::command]
pub async fn debug_workflow(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    workflow_id: String,
    breakpoints: Vec<String>,
) -> Result<(), String> {
    let (tx, rx) = tokio::sync::mpsc::channel::<String>(1);
    *state.debug_tx.lock().await = Some(tx);

    let executor = state.executor.clone();
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        let exec = executor.lock().await;
        if let Err(e) = exec.run_debug(&workflow_id, app_clone, breakpoints, rx).await {
            log::error!("Debug execution failed: {}", e);
        }
    });
    Ok(())
}

#[tauri::command]
pub async fn debug_action(
    state: tauri::State<'_, AppState>,
    action: String,
) -> Result<(), String> {
    let tx = state.debug_tx.lock().await;
    if let Some(sender) = tx.as_ref() {
        sender.send(action).await.map_err(|e| format!("发送调试指令失败: {}", e))?;
    } else {
        return Err("当前没有活跃的调试会话".into());
    }
    Ok(())
}

// ==================== Execution History ====================

#[tauri::command]
pub async fn list_execution_history(
    state: tauri::State<'_, AppState>,
    workflow_id: Option<String>,
) -> Result<String, String> {
    let executor = state.executor.lock().await;
    let records = executor.history().list(workflow_id.as_deref())?;
    serde_json::to_string(&records).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_execution_record(
    state: tauri::State<'_, AppState>,
    record_id: String,
) -> Result<String, String> {
    let executor = state.executor.lock().await;
    let record = executor.history().get(&record_id)?;
    serde_json::to_string(&record).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_execution_history(
    state: tauri::State<'_, AppState>,
    query: Option<String>,
    status: Option<String>,
    date_from: Option<String>,
    date_to: Option<String>,
    limit: Option<usize>,
) -> Result<String, String> {
    let executor = state.executor.lock().await;
    let records = executor.history().search(
        query.as_deref(),
        status.as_deref(),
        date_from.as_deref(),
        date_to.as_deref(),
        limit.unwrap_or(100),
    )?;
    serde_json::to_string(&records).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn resume_workflow(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    record_id: String,
) -> Result<(), String> {
    let executor = state.executor.clone();
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        let exec = executor.lock().await;
        if let Err(e) = exec.resume(&record_id, app_clone).await {
            log::error!("Resume workflow failed: {}", e);
        }
    });
    Ok(())
}

// ==================== Shortcut Binding ====================

#[tauri::command]
pub async fn bind_workflow_shortcut(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    workflow_id: String,
    shortcut: String,
) -> Result<(), String> {
    let gs = app.global_shortcut();

    // Check for conflict
    if !shortcut.is_empty() && gs.is_registered(shortcut.as_str()) {
        return Err(format!("Shortcut '{}' is already in use", shortcut));
    }

    let executor = state.executor.lock().await;

    // Load workflow, update shortcut, save
    let mut workflow = executor.storage().load(&workflow_id)?;
    let old_shortcut = workflow.shortcut.clone();
    workflow.shortcut = if shortcut.is_empty() { None } else { Some(shortcut.clone()) };
    executor.storage().save(&workflow)?;

    // Unregister old shortcut if exists
    if let Some(ref old) = old_shortcut {
        if !old.is_empty() {
            let _ = gs.unregister(old.as_str());
        }
    }

    // Register new shortcut
    if !shortcut.is_empty() {
        let exec_clone = state.executor.clone();
        let app_clone = app.clone();
        let wf_id = workflow_id.clone();
        let notify = state.status_ready.clone();

        gs.on_shortcut(shortcut.as_str(), move |_app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                let exec = exec_clone.clone();
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
                        log::error!("Shortcut execution failed: {}", e);
                    }
                });
            }
        })
        .map_err(|e| format!("Failed to register shortcut: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn unbind_workflow_shortcut(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    workflow_id: String,
) -> Result<(), String> {
    let executor = state.executor.lock().await;

    let mut workflow = executor.storage().load(&workflow_id)?;
    if let Some(ref old) = workflow.shortcut {
        if !old.is_empty() {
            let _ = app.global_shortcut().unregister(old.as_str());
        }
    }
    workflow.shortcut = None;
    executor.storage().save(&workflow)?;

    Ok(())
}

// ==================== Cron ====================

#[tauri::command]
pub async fn set_workflow_cron(
    state: tauri::State<'_, AppState>,
    workflow_id: String,
    cron_expression: Option<String>,
) -> Result<(), String> {
    let executor = state.executor.lock().await;
    let mut workflow = executor.storage().load(&workflow_id)?;
    workflow.cron = cron_expression;
    executor.storage().save(&workflow)?;
    // Note: cron scheduler restart requires app restart for now
    Ok(())
}

// ==================== Version History ====================

#[tauri::command]
pub async fn list_workflow_versions(
    state: tauri::State<'_, AppState>,
    workflow_id: String,
) -> Result<String, String> {
    let executor = state.executor.lock().await;
    let versions = executor.storage().list_versions(&workflow_id)?;
    serde_json::to_string(&versions).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn restore_workflow_version(
    state: tauri::State<'_, AppState>,
    workflow_id: String,
    timestamp: String,
) -> Result<String, String> {
    let executor = state.executor.lock().await;
    let json = executor.storage().load_version(&workflow_id, &timestamp)?;
    // Parse and re-save as the current version (this also snapshots the current file)
    let workflow: crate::workflow::types::Workflow =
        serde_json::from_str(&json).map_err(|e| e.to_string())?;
    executor.storage().save(&workflow)?;
    Ok(json)
}

// ==================== AI Settings ====================

#[tauri::command]
pub async fn get_ai_settings(app: AppHandle) -> Result<String, String> {
    let providers = crate::settings::get_providers(&app);
    serde_json::to_string(&providers).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_ai_settings(app: AppHandle, providers_json: String) -> Result<(), String> {
    let providers: Vec<crate::settings::AiProvider> =
        serde_json::from_str(&providers_json).map_err(|e| e.to_string())?;
    crate::settings::save_providers(&app, &providers)
}

// ==================== Environment Variables ====================

#[tauri::command]
pub async fn get_env_variables(app: AppHandle) -> Result<String, String> {
    let vars = crate::settings::get_env_vars(&app);
    serde_json::to_string(&vars).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_env_variables(app: AppHandle, vars_json: String) -> Result<(), String> {
    let vars: Vec<crate::settings::EnvVariable> =
        serde_json::from_str(&vars_json).map_err(|e| e.to_string())?;
    crate::settings::save_env_vars(&app, &vars)
}

// ==================== Human Review Approval ====================

#[tauri::command]
pub async fn approval_action(action: String) -> Result<(), String> {
    crate::workflow::nodes::human_review::send_approval(action)
}

// ==================== Screenshot ====================

#[tauri::command]
pub async fn screenshot_region_complete(x: u32, y: u32, width: u32, height: u32) -> Result<(), String> {
    crate::workflow::nodes::screenshot_region::complete_region(serde_json::json!({
        "x": x, "y": y, "width": width, "height": height,
    }));
    Ok(())
}

#[tauri::command]
pub async fn screenshot_region_complete_with_image(
    image_base64: String,
    width: u32,
    height: u32,
) -> Result<(), String> {
    use base64::Engine;

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&image_base64)
        .map_err(|e| format!("Base64 decode failed: {}", e))?;

    let unique_id = format!("{}_{}", std::process::id(), std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos());
    let path = std::env::temp_dir().join(format!("deskpipe_annotated_{}.png", unique_id));
    std::fs::write(&path, &bytes).map_err(|e| format!("保存标注截图失败: {}", e))?;

    crate::workflow::nodes::screenshot_region::complete_region(serde_json::json!({
        "path": path.to_string_lossy(),
        "width": width,
        "height": height,
        "has_annotations": true,
    }));
    Ok(())
}

// ==================== AI Providers (for nodes to load provider list) ====================

#[tauri::command]
pub async fn get_ai_providers(app: AppHandle) -> Result<String, String> {
    let providers = crate::settings::get_providers(&app);
    // Return providers without api_key for security (nodes only need id/name/model)
    let safe: Vec<serde_json::Value> = providers.iter().map(|p| serde_json::json!({
        "id": p.id,
        "name": p.name,
        "model": p.model,
        "provider_type": p.provider_type,
        "is_default": p.is_default,
    })).collect();
    serde_json::to_string(&safe).map_err(|e| e.to_string())
}

// ==================== Window Management ====================

#[tauri::command]
pub async fn open_preview_window(app: AppHandle, path: String, title: String) -> Result<(), String> {
    crate::window::open_preview_window(&app, &path, &title)
}

#[tauri::command]
pub async fn open_dialog_window(app: AppHandle, title: String, content: String) -> Result<(), String> {
    crate::window::open_dialog_window(&app, &title, &content)
}

#[tauri::command]
pub async fn open_status_window(app: AppHandle) -> Result<(), String> {
    crate::window::open_status_window(&app).map(|_| ())
}

#[tauri::command]
pub async fn status_window_ready(state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.status_ready.notify_one();
    Ok(())
}

#[tauri::command]
pub async fn close_child_window(app: AppHandle, label: String) -> Result<(), String> {
    crate::window::close_window(&app, &label)
}

// ==================== Import from URL ====================

#[tauri::command]
pub async fn import_workflow_from_url(
    state: tauri::State<'_, AppState>,
    url: String,
) -> Result<String, String> {
    // Validate URL scheme to prevent SSRF
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err("仅支持 http:// 或 https:// 链接".into());
    }
    // Block internal/private addresses
    let host_part = url.split("://").nth(1).unwrap_or("").split('/').next().unwrap_or("");
    let host = host_part.split(':').next().unwrap_or("");
    if host == "localhost" || host == "127.0.0.1" || host == "::1"
        || host.starts_with("10.") || host.starts_with("192.168.")
        || host.starts_with("172.") || host.ends_with(".local") || host.is_empty()
    {
        return Err("不允许访问内网地址".into());
    }

    let resp = reqwest::get(&url)
        .await
        .map_err(|e| format!("下载失败: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("下载失败: HTTP {}", resp.status()));
    }
    let text = resp
        .text()
        .await
        .map_err(|e| format!("读取失败: {}", e))?;
    let mut workflow: crate::workflow::types::Workflow =
        serde_json::from_str(&text).map_err(|e| format!("解析失败: {}", e))?;
    workflow.id = format!(
        "wf_{}",
        uuid::Uuid::new_v4().to_string().replace('-', "")[..12].to_string()
    );
    let executor = state.executor.lock().await;
    executor.storage().save(&workflow)?;
    serde_json::to_string(&workflow).map_err(|e| e.to_string())
}

// ==================== Test Run Single Node ====================

#[tauri::command]
pub async fn test_run_node(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    node_type: String,
    config_json: String,
) -> Result<String, String> {
    let config: serde_json::Value =
        serde_json::from_str(&config_json).map_err(|e| e.to_string())?;
    let input = serde_json::json!({}); // Empty input for test

    let executor = state.executor.lock().await;
    let node_impl = executor
        .nodes_ref()
        .get(&node_type)
        .ok_or_else(|| format!("Unknown node type: {}", node_type))?;

    let result = node_impl.execute(input, config, &app).await?;
    serde_json::to_string(&result).map_err(|e| e.to_string())
}
