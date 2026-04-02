mod commands;
mod settings;
mod setup;
mod window;
mod workflow;

use std::sync::Arc;

use commands::AppState;
use tauri::Manager;
use tokio::sync::Mutex;
use workflow::executor::WorkflowExecutor;
use workflow::history::HistoryStorage;
use workflow::storage::WorkflowStorage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            // Hide dock icon on macOS — app lives in the system tray
            #[cfg(target_os = "macos")]
            {
                use tauri::ActivationPolicy;
                app.handle().set_activation_policy(ActivationPolicy::Accessory).ok();
            }

            let handle = app.handle();

            let app_data_dir = app
                .path()
                .app_local_data_dir()
                .expect("Failed to get app data dir");

            let workflows_dir = app_data_dir.join("workflows");
            let history_dir = app_data_dir.join("history");

            let storage = WorkflowStorage::new(workflows_dir);
            let history = HistoryStorage::new(history_dir);
            let executor = WorkflowExecutor::new(storage, history);
            let executor_arc = Arc::new(Mutex::new(executor));

            let status_ready = Arc::new(tokio::sync::Notify::new());

            setup::shortcuts::register_workflow_shortcuts(app.handle(), executor_arc.clone(), status_ready.clone());
            setup::tray::create_tray(app.handle(), executor_arc.clone(), status_ready.clone());
            setup::cron::start_cron_scheduler(app.handle(), executor_arc.clone());

            app.manage(AppState {
                executor: executor_arc,
                debug_tx: Arc::new(Mutex::new(None)),
                status_ready,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::save_workflow,
            commands::load_workflow,
            commands::list_workflows,
            commands::delete_workflow,
            commands::execute_workflow,
            commands::list_execution_history,
            commands::get_execution_record,
            commands::bind_workflow_shortcut,
            commands::unbind_workflow_shortcut,
            commands::set_workflow_cron,
            commands::list_workflow_versions,
            commands::restore_workflow_version,
            commands::get_ai_settings,
            commands::save_ai_settings,
            commands::screenshot_region_complete,
            commands::screenshot_region_complete_with_image,
            commands::get_ai_providers,
            commands::import_workflow_from_url,
            commands::test_run_node,
            commands::search_execution_history,
            commands::resume_workflow,
            commands::open_preview_window,
            commands::open_dialog_window,
            commands::open_status_window,
            commands::status_window_ready,
            commands::close_child_window,
            commands::debug_workflow,
            commands::debug_action,
            commands::get_env_variables,
            commands::save_env_variables,
            commands::approval_action,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
