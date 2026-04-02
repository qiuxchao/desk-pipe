use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::Arc;

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};

/// Decrement in-degree and enqueue when all predecessors are done (Kahn's algorithm).
fn enqueue_target(target_id: &str, remaining: &mut HashMap<String, usize>, queue: &mut VecDeque<String>) {
    let deg = remaining.entry(target_id.to_string()).or_insert(0);
    if *deg > 0 { *deg -= 1; }
    if *deg == 0 {
        queue.push_back(target_id.to_string());
    }
}

use crate::workflow::history::{ExecutionRecord, HistoryStorage};
use crate::workflow::nodes::{
    ai_chat::AiChatNode, clipboard_read::ClipboardReadNode,
    clipboard_write::ClipboardWriteNode, condition::ConditionNode,
    data_process::DataProcessNode, delay::DelayNode, file_copy::FileCopyNode,
    file_move::FileMoveNode, file_read::FileReadNode, file_write::FileWriteNode,
    http_request::HttpRequestNode, image_preview::ImagePreviewNode,
    json_process::JsonProcessNode, loop_node::LoopNode, notification::NotificationNode,
    screenshot_full::ScreenshotFullNode, screenshot_region::ScreenshotRegionNode,
    shell::ShellNode, sub_workflow::SubWorkflowNode,
    text_process::TextProcessNode, regex_extract::RegexExtractNode,
    email_send::EmailSendNode, code_node::CodeNode,
    applescript::AppleScriptNode, open_app::OpenAppNode,
    keyboard_type::KeyboardTypeNode, user_input::UserInputNode,
    file_watch::FileWatchNode,
    comment::CommentNode, variable_set::VariableSetNode, variable_get::VariableGetNode,
    database::DatabaseNode, sql_query::SqlQueryNode, merge::MergeNode,
    batch_process::BatchProcessNode, image_generate::ImageGenerateNode,
    tts::TtsNode, stt::SttNode, intent_recognition::IntentRecognitionNode,
    knowledge_write::KnowledgeWriteNode, knowledge_search::KnowledgeSearchNode,
    webhook_trigger::WebhookTriggerNode,
    result_dialog::ResultDialogNode,
    agent::AgentNode,
    list_operator::ListOperatorNode, template_render::TemplateRenderNode,
    document_extractor::DocumentExtractorNode, parameter_extractor::ParameterExtractorNode,
    human_review::HumanReviewNode, parallel::ParallelNode,
    INode,
};
use crate::workflow::storage::WorkflowStorage;
use crate::workflow::template;
use crate::workflow::types::{Workflow, WorkflowEvent};

pub struct WorkflowExecutor {
    storage: WorkflowStorage,
    history: HistoryStorage,
    nodes: HashMap<String, Arc<dyn INode>>,
}

impl WorkflowExecutor {
    pub fn new(storage: WorkflowStorage, history: HistoryStorage) -> Self {
        let mut nodes: HashMap<String, Arc<dyn INode>> = HashMap::new();
        nodes.insert("shell".into(), Arc::new(ShellNode));
        nodes.insert("delay".into(), Arc::new(DelayNode));
        nodes.insert("notification".into(), Arc::new(NotificationNode));
        nodes.insert("clipboard_read".into(), Arc::new(ClipboardReadNode));
        nodes.insert("clipboard_write".into(), Arc::new(ClipboardWriteNode));
        nodes.insert("file_read".into(), Arc::new(FileReadNode));
        nodes.insert("file_write".into(), Arc::new(FileWriteNode));
        nodes.insert("file_copy".into(), Arc::new(FileCopyNode));
        nodes.insert("file_move".into(), Arc::new(FileMoveNode));
        nodes.insert("http_request".into(), Arc::new(HttpRequestNode));
        nodes.insert("condition".into(), Arc::new(ConditionNode));
        nodes.insert("loop".into(), Arc::new(LoopNode));
        nodes.insert("sub_workflow".into(), Arc::new(SubWorkflowNode));
        nodes.insert("screenshot_full".into(), Arc::new(ScreenshotFullNode));
        nodes.insert("screenshot_region".into(), Arc::new(ScreenshotRegionNode));
        nodes.insert("ai_chat".into(), Arc::new(AiChatNode));
        nodes.insert("image_preview".into(), Arc::new(ImagePreviewNode));
        nodes.insert("text_process".into(), Arc::new(TextProcessNode));
        nodes.insert("json_process".into(), Arc::new(JsonProcessNode));
        nodes.insert("data_process".into(), Arc::new(DataProcessNode));
        nodes.insert("regex_extract".into(), Arc::new(RegexExtractNode));
        nodes.insert("email_send".into(), Arc::new(EmailSendNode));
        nodes.insert("code".into(), Arc::new(CodeNode));
        nodes.insert("applescript".into(), Arc::new(AppleScriptNode));
        nodes.insert("open_app".into(), Arc::new(OpenAppNode));
        nodes.insert("keyboard_type".into(), Arc::new(KeyboardTypeNode));
        nodes.insert("user_input".into(), Arc::new(UserInputNode));
        nodes.insert("file_watch".into(), Arc::new(FileWatchNode));
        nodes.insert("variable_set".into(), Arc::new(VariableSetNode));
        nodes.insert("variable_get".into(), Arc::new(VariableGetNode));
        nodes.insert("comment".into(), Arc::new(CommentNode));
        nodes.insert("merge".into(), Arc::new(MergeNode));
        nodes.insert("database".into(), Arc::new(DatabaseNode));
        nodes.insert("sql_query".into(), Arc::new(SqlQueryNode));
        nodes.insert("batch_process".into(), Arc::new(BatchProcessNode));
        nodes.insert("image_generate".into(), Arc::new(ImageGenerateNode));
        nodes.insert("tts".into(), Arc::new(TtsNode));
        nodes.insert("stt".into(), Arc::new(SttNode));
        nodes.insert("intent_recognition".into(), Arc::new(IntentRecognitionNode));
        nodes.insert("knowledge_write".into(), Arc::new(KnowledgeWriteNode));
        nodes.insert("knowledge_search".into(), Arc::new(KnowledgeSearchNode));
        nodes.insert("webhook_trigger".into(), Arc::new(WebhookTriggerNode));
        nodes.insert("result_dialog".into(), Arc::new(ResultDialogNode));
        nodes.insert("agent".into(), Arc::new(AgentNode));
        nodes.insert("list_operator".into(), Arc::new(ListOperatorNode));
        nodes.insert("template_render".into(), Arc::new(TemplateRenderNode));
        nodes.insert("document_extractor".into(), Arc::new(DocumentExtractorNode));
        nodes.insert("parameter_extractor".into(), Arc::new(ParameterExtractorNode));
        nodes.insert("human_review".into(), Arc::new(HumanReviewNode));
        nodes.insert("parallel".into(), Arc::new(ParallelNode));

        Self {
            storage,
            history,
            nodes,
        }
    }

    pub fn storage(&self) -> &WorkflowStorage {
        &self.storage
    }

    pub fn history(&self) -> &HistoryStorage {
        &self.history
    }

    pub fn nodes_ref(&self) -> &HashMap<String, Arc<dyn INode>> {
        &self.nodes
    }

    fn emit_event(app: &AppHandle, event: &WorkflowEvent) {
        let _ = app.emit("workflow_event", event);
    }

    /// Execute a node and its full downstream chain (for loop/batch bodies).
    /// This runs a BFS starting from the given node through the subgraph.
    async fn execute_subgraph(
        &self,
        start_id: &str,
        node_map: &HashMap<String, crate::workflow::types::WorkflowNode>,
        adj: &HashMap<String, Vec<&crate::workflow::types::WorkflowEdge>>,
        context: &mut Value,
        app: &AppHandle,
    ) {
        let mut sub_queue: VecDeque<String> = VecDeque::new();
        sub_queue.push_back(start_id.to_string());
        let mut sub_visited: HashSet<String> = HashSet::new();

        while let Some(nid) = sub_queue.pop_front() {
            if sub_visited.contains(&nid) { continue; }
            sub_visited.insert(nid.clone());

            let Some(ndef) = node_map.get(&nid) else { continue; };
            if ndef.node_type == "start" || ndef.node_type == "end" || ndef.node_type == "comment" {
                if let Some(edges) = adj.get(&nid) { for e in edges { sub_queue.push_back(e.target_node_id.clone()); } }
                continue;
            }

            if let Some(nimpl) = self.nodes.get(&ndef.node_type) {
                let cfg = crate::workflow::template::interpolate_value(&ndef.data, context);
                let input = context.get("prev").cloned().unwrap_or(Value::Null);
                match nimpl.execute(input, cfg, app).await {
                    Ok(output) => {
                        context["prev"] = output.clone();
                        context["nodes"][&nid] = output;
                    }
                    Err(e) => {
                        log::warn!("Subgraph node {} failed: {}", nid, e);
                    }
                }
            }
            if let Some(edges) = adj.get(&nid) {
                for e in edges { sub_queue.push_back(e.target_node_id.clone()); }
            }
        }
    }

    /// Continue executing the downstream chain after a node that was already executed.
    async fn execute_subgraph_continue(
        &self,
        start_id: &str,
        node_map: &HashMap<String, crate::workflow::types::WorkflowNode>,
        adj: &HashMap<String, Vec<&crate::workflow::types::WorkflowEdge>>,
        context: &mut Value,
        app: &AppHandle,
    ) {
        // Execute everything downstream of start_id (but not start_id itself)
        if let Some(edges) = adj.get(start_id) {
            for e in edges {
                self.execute_subgraph(&e.target_node_id, node_map, adj, context, app).await;
            }
        }
    }

    /// Mark all nodes reachable from start_id as visited (so the main BFS skips them).
    fn mark_subgraph_visited(
        &self,
        start_id: &str,
        adj: &HashMap<String, Vec<&crate::workflow::types::WorkflowEdge>>,
        visited: &mut HashSet<String>,
        remaining_in_degree: &mut HashMap<String, usize>,
    ) {
        let mut stack = vec![start_id.to_string()];
        while let Some(nid) = stack.pop() {
            if visited.contains(&nid) { continue; }
            visited.insert(nid.clone());
            remaining_in_degree.insert(nid.clone(), 0);
            if let Some(edges) = adj.get(&nid) {
                for e in edges {
                    stack.push(e.target_node_id.clone());
                }
            }
        }
    }

    /// Graph-based execution: supports branching (condition nodes).
    /// Normal nodes: follow all outgoing edges.
    /// Condition nodes: follow only the edge matching the "result" port (true/false).
    pub async fn run(&self, workflow_id: &str, app: AppHandle) -> Result<Value, String> {
        let workflow = self.storage.load(workflow_id)?;
        let now = chrono::Local::now().to_rfc3339();
        let record_id = format!("exec_{}", uuid::Uuid::new_v4());

        let mut record = ExecutionRecord {
            id: record_id.clone(),
            workflow_id: workflow.id.clone(),
            workflow_name: workflow.name.clone(),
            started_at: now,
            completed_at: None,
            status: "running".into(),
            events: Vec::new(),
            result: None,
            node_outputs: std::collections::HashMap::new(),
            saved_context: None,
            failed_node_id: None,
        };

        let started_event = WorkflowEvent {
            workflow_id: workflow.id.clone(),
            event_type: "started".into(),
            node_id: None,
            data: Some(json!({"record_id": record_id})),
            error: None,
            timestamp: Some(std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs_f64() * 1000.0),
        };
        Self::emit_event(&app, &started_event);
        record.events.push(started_event);

        // Auto-show status window if main window is not visible
        if app
            .get_webview_window("main")
            .map(|w| !w.is_visible().unwrap_or(true))
            .unwrap_or(true)
        {
            let _ = crate::window::open_status_window(&app);
        }

        // Build adjacency: node_id -> outgoing edges
        let mut adj: HashMap<String, Vec<&crate::workflow::types::WorkflowEdge>> = HashMap::new();
        let mut in_degree: HashMap<String, usize> = HashMap::new();

        for node in &workflow.nodes {
            adj.entry(node.id.clone()).or_default();
            in_degree.entry(node.id.clone()).or_insert(0);
        }
        for edge in &workflow.edges {
            adj.entry(edge.source_node_id.clone())
                .or_default()
                .push(edge);
            *in_degree.entry(edge.target_node_id.clone()).or_insert(0) += 1;
        }

        let node_map: HashMap<String, _> = workflow
            .nodes
            .iter()
            .map(|n| (n.id.clone(), n.clone()))
            .collect();

        // Context: { "prev": ..., "nodes": {}, "variables": {}, "env": {...} }
        let env_vars = crate::settings::get_env_vars_as_value(&app);
        let mut context: Value = json!({ "prev": null, "nodes": {}, "variables": {}, "env": env_vars });

        // Kahn's algorithm: track remaining in-degree for each node
        let mut remaining_in_degree = in_degree.clone();

        // BFS from root nodes (in-degree 0)
        let mut queue: VecDeque<String> = remaining_in_degree
            .iter()
            .filter(|(_, &deg)| deg == 0)
            .map(|(id, _)| id.clone())
            .collect();

        let mut visited: HashSet<String> = HashSet::new();

        while let Some(node_id) = queue.pop_front() {
            if visited.contains(&node_id) {
                continue;
            }
            visited.insert(node_id.clone());

            let Some(node_def) = node_map.get(&node_id) else {
                continue;
            };

            // Skip start/end/comment marker nodes
            if node_def.node_type == "start" || node_def.node_type == "end" || node_def.node_type == "comment" {
                // Enqueue all outgoing targets
                if let Some(edges) = adj.get(&node_id) {
                    for edge in edges {
                        enqueue_target(&edge.target_node_id, &mut remaining_in_degree, &mut queue);
                    }
                }
                continue;
            }

            // Check if node is disabled
            if let Some(disabled) = node_def.data.get("disabled").and_then(|v| v.as_bool()) {
                if disabled {
                    let skip_ev = WorkflowEvent {
                        workflow_id: workflow.id.clone(),
                        event_type: "node_skipped".into(),
                        node_id: Some(node_id.clone()),
                        data: None,
                        error: None,
                        timestamp: Some(std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs_f64() * 1000.0),
                    };
                    Self::emit_event(&app, &skip_ev);
                    record.events.push(skip_ev);

                    // Follow edges to next nodes, passing previous context forward
                    if let Some(edges) = adj.get(&node_id) {
                        for edge in edges {
                            enqueue_target(&edge.target_node_id, &mut remaining_in_degree, &mut queue);
                        }
                    }
                    continue;
                }
            }

            let Some(node_impl) = self.nodes.get(&node_def.node_type) else {
                let ev = WorkflowEvent {
                    workflow_id: workflow.id.clone(),
                    event_type: "node_failed".into(),
                    node_id: Some(node_id.clone()),
                    data: None,
                    error: Some(format!("Unknown node type: {}", node_def.node_type)),
                    timestamp: Some(std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs_f64() * 1000.0),
                };
                Self::emit_event(&app, &ev);
                record.events.push(ev);
                continue;
            };

            let node_title = node_def
                .data
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or(&node_def.node_type)
                .to_string();

            let started_ev = WorkflowEvent {
                workflow_id: workflow.id.clone(),
                event_type: "node_started".into(),
                node_id: Some(node_id.clone()),
                data: Some(json!({
                    "title": node_title,
                    "type": node_def.node_type,
                    "input": context.get("prev").cloned(),
                })),
                error: None,
                timestamp: Some(std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs_f64() * 1000.0),
            };
            Self::emit_event(&app, &started_ev);
            record.events.push(started_ev);

            // Template interpolation on node config
            let mut interpolated_config = template::interpolate_value(&node_def.data, &context);

            // Inject __node_id for any node
            interpolated_config["__node_id"] = json!(node_id);

            // For variable_get: override input with stored variable value
            let input = if node_def.node_type == "variable_get" {
                let key = interpolated_config.get("key").and_then(|v| v.as_str()).unwrap_or("");
                if !key.is_empty() {
                    context["variables"].get(key).cloned().unwrap_or(Value::Null)
                } else {
                    context.get("prev").cloned().unwrap_or(Value::Null)
                }
            } else if node_def.node_type == "merge" {
                // Collect all specified source node outputs
                let sources = interpolated_config.get("sources")
                    .and_then(|v| v.as_array())
                    .cloned()
                    .unwrap_or_default();
                if !sources.is_empty() {
                    let collected: Vec<Value> = sources.iter()
                        .filter_map(|s| s.as_str())
                        .filter_map(|s| context["nodes"].get(s).cloned())
                        .collect();
                    Value::Array(collected)
                } else {
                    context.get("prev").cloned().unwrap_or(Value::Null)
                }
            } else {
                context.get("prev").cloned().unwrap_or(Value::Null)
            };

            // Timeout: default 30s, AI/heavy nodes get 120s, human_review gets 600s
            let default_timeout = match node_def.node_type.as_str() {
                "human_review" => 600_000u64,
                "ai_chat" | "http_request" | "sub_workflow"
                | "image_generate" | "tts" | "stt" | "intent_recognition"
                | "knowledge_write" | "knowledge_search"
                | "database" | "sql_query" | "agent" | "parameter_extractor" => 120_000u64,
                _ => 30_000u64,
            };
            let timeout_ms = interpolated_config
                .get("timeout_ms")
                .and_then(|v| v.as_u64())
                .unwrap_or(default_timeout);

            // Error strategy: "stop" (default), "continue", "retry"
            let on_error = interpolated_config
                .get("on_error")
                .and_then(|v| v.as_str())
                .unwrap_or("stop")
                .to_string();
            let max_retries: u32 = if on_error == "retry" { 3 } else { 1 };

            let mut last_error = String::new();
            let mut execution_succeeded = false;
            let mut output_value = Value::Null;

            for attempt in 0..max_retries {
                if attempt > 0 {
                    log::info!("Retrying node {} (attempt {})", node_id, attempt + 1);
                }

                let exec_result = tokio::time::timeout(
                    std::time::Duration::from_millis(timeout_ms),
                    node_impl.execute(input.clone(), interpolated_config.clone(), &app),
                )
                .await;

                match exec_result {
                    Ok(Ok(output)) => {
                        output_value = output;
                        execution_succeeded = true;
                        break;
                    }
                    Ok(Err(e)) => {
                        last_error = e;
                    }
                    Err(_) => {
                        last_error = format!(
                            "Node execution timed out after {}ms",
                            timeout_ms
                        );
                    }
                }
            }

            if execution_succeeded {
                let output = output_value;
                context["prev"] = output.clone();
                context["nodes"][&node_id] = output.clone();
                record.node_outputs.insert(node_id.clone(), output.clone());

                // For variable_set: store variable in context
                if node_def.node_type == "variable_set" {
                    if let Some(key) = output.get("key").and_then(|v| v.as_str()) {
                        if let Some(value) = output.get("value") {
                            context["variables"][key] = value.clone();
                        }
                    }
                }

                let completed_ev = WorkflowEvent {
                    workflow_id: workflow.id.clone(),
                    event_type: "node_completed".into(),
                    node_id: Some(node_id.clone()),
                    data: Some(output.clone()),
                    error: None,
                    timestamp: Some(std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs_f64() * 1000.0),
                };
                Self::emit_event(&app, &completed_ev);
                record.events.push(completed_ev);

                // Determine which edges to follow
                if let Some(edges) = adj.get(&node_id) {
                    if node_def.node_type == "loop" {
                        // Loop: execute the full downstream chain for each item
                        if let Some(items) = output.get("items").and_then(|v| v.as_array()) {
                            // Collect the downstream subgraph reachable from loop edges
                            let loop_target_ids: Vec<String> = edges.iter().map(|e| e.target_node_id.clone()).collect();

                            let mut loop_results = Vec::new();
                            for (idx, item) in items.iter().enumerate() {
                                context["loop_index"] = json!(idx);
                                context["loop_item"] = item.clone();
                                context["prev"] = item.clone();

                                // Run each direct target and its downstream chain
                                for target_id in &loop_target_ids {
                                    self.execute_subgraph(target_id, &node_map, &adj, &mut context, &app).await;
                                }
                                loop_results.push(context.get("prev").cloned().unwrap_or(Value::Null));
                            }
                            context["prev"] = json!(loop_results);
                            context["nodes"][&node_id] = json!({
                                "items": items,
                                "results": context["prev"].clone(),
                                "total": items.len(),
                            });
                            // Mark loop targets as visited so main BFS skips them
                            for target_id in &loop_target_ids {
                                self.mark_subgraph_visited(target_id, &adj, &mut visited, &mut remaining_in_degree);
                            }
                        } else {
                            for edge in edges {
                                enqueue_target(&edge.target_node_id, &mut remaining_in_degree, &mut queue);
                            }
                        }
                    } else if node_def.node_type == "batch_process" {
                        if let Some(items) = output.get("items").and_then(|v| v.as_array()) {
                            let error_mode = output.get("error_mode").and_then(|v| v.as_str()).unwrap_or("terminated");
                            let batch_target_ids: Vec<String> = edges.iter().map(|e| e.target_node_id.clone()).collect();
                            let mut batch_results = Vec::new();
                            let mut had_error = false;

                            for (idx, item) in items.iter().enumerate() {
                                context["batch_index"] = json!(idx);
                                context["batch_item"] = item.clone();
                                context["prev"] = item.clone();

                                for target_id in &batch_target_ids {
                                    if let Some(target_def) = node_map.get(target_id) {
                                        if let Some(target_impl) = self.nodes.get(&target_def.node_type) {
                                            let target_config = template::interpolate_value(&target_def.data, &context);
                                            match target_impl.execute(item.clone(), target_config, &app).await {
                                                Ok(result) => {
                                                    context["prev"] = result.clone();
                                                    context["nodes"][target_id] = result.clone();
                                                    // Continue downstream chain from this target
                                                    self.execute_subgraph_continue(target_id, &node_map, &adj, &mut context, &app).await;
                                                    batch_results.push(context.get("prev").cloned().unwrap_or(Value::Null));
                                                }
                                                Err(e) => {
                                                    had_error = true;
                                                    match error_mode {
                                                        "terminated" => {
                                                            return Err(format!("批处理第 {} 项失败: {}", idx, e));
                                                        }
                                                        "continue_on_error" => {
                                                            batch_results.push(json!({"error": e, "index": idx}));
                                                        }
                                                        "remove_abnormal" => {}
                                                        _ => {
                                                            return Err(format!("批处理第 {} 项失败: {}", idx, e));
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            context["prev"] = json!(batch_results);
                            context["nodes"][&node_id] = json!({
                                "items": items,
                                "results": context["prev"].clone(),
                                "total": items.len(),
                                "had_error": had_error,
                                "error_mode": error_mode,
                            });
                            // Mark batch targets as visited
                            for target_id in &batch_target_ids {
                                self.mark_subgraph_visited(target_id, &adj, &mut visited, &mut remaining_in_degree);
                            }
                        } else {
                            for edge in edges {
                                enqueue_target(&edge.target_node_id, &mut remaining_in_degree, &mut queue);
                            }
                        }
                    } else if node_def.node_type == "human_review" {
                        let action = output.get("action").and_then(|v| v.as_str()).unwrap_or("reject");
                        for edge in edges {
                            let edge_port = edge.source_port_id.as_deref().unwrap_or("");
                            if edge_port == action || edge_port.is_empty() {
                                enqueue_target(&edge.target_node_id, &mut remaining_in_degree, &mut queue);
                            }
                        }
                    } else if node_def.node_type == "parallel" {
                        let mut handles = Vec::new();
                        for edge in edges {
                            let target_id = edge.target_node_id.clone();
                            if let Some(target_def) = node_map.get(&target_id) {
                                if let Some(target_impl) = self.nodes.get(&target_def.node_type) {
                                    let target_impl = target_impl.clone();
                                    let target_data = target_def.data.clone();
                                    let app_clone = app.clone();
                                    let context_clone = context.clone();
                                    let tid = target_id.clone();

                                    handles.push(tokio::spawn(async move {
                                        let target_config = crate::workflow::template::interpolate_value(&target_data, &context_clone);
                                        let input = context_clone.get("prev").cloned().unwrap_or(serde_json::Value::Null);
                                        let result = target_impl.execute(input, target_config, &app_clone).await;
                                        (tid, result)
                                    }));
                                }
                            }
                        }

                        let mut parallel_results = serde_json::Map::new();
                        for handle in handles {
                            if let Ok((id, result)) = handle.await {
                                match result {
                                    Ok(val) => {
                                        context["nodes"][&id] = val.clone();
                                        visited.insert(id.clone());
                                        parallel_results.insert(id, val);
                                    }
                                    Err(e) => {
                                        visited.insert(id.clone());
                                        parallel_results.insert(id, json!({"error": e}));
                                    }
                                }
                            }
                        }
                        context["prev"] = serde_json::Value::Object(parallel_results);

                        // Enqueue downstream nodes of each parallel target
                        for edge in edges {
                            if let Some(target_edges) = adj.get(&edge.target_node_id) {
                                for te in target_edges {
                                    enqueue_target(&te.target_node_id, &mut remaining_in_degree, &mut queue);
                                }
                            }
                        }
                    } else if node_def.node_type == "sub_workflow" {
                        // Sub-workflow: load and execute inline
                        if let Some(sub_id) = output.get("sub_workflow_id").and_then(|v| v.as_str()) {
                            match self.storage.load(sub_id) {
                                Ok(sub_wf) => {
                                    let mut sub_context: Value = json!({ "prev": context["prev"].clone(), "nodes": {}, "variables": context.get("variables").cloned().unwrap_or(json!({})) });
                                    let sub_node_map: std::collections::HashMap<String, _> = sub_wf.nodes.iter().map(|n| (n.id.clone(), n.clone())).collect();
                                    let mut sub_remaining: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
                                    let mut sub_adj: std::collections::HashMap<String, Vec<&crate::workflow::types::WorkflowEdge>> = std::collections::HashMap::new();
                                    for n in &sub_wf.nodes { sub_remaining.entry(n.id.clone()).or_insert(0); sub_adj.entry(n.id.clone()).or_default(); }
                                    for e in &sub_wf.edges { *sub_remaining.entry(e.target_node_id.clone()).or_insert(0) += 1; sub_adj.entry(e.source_node_id.clone()).or_default().push(e); }
                                    let mut sub_queue: VecDeque<String> = sub_remaining.iter().filter(|(_, &d)| d == 0).map(|(id, _)| id.clone()).collect();
                                    let mut sub_visited: HashSet<String> = HashSet::new();

                                    while let Some(sid) = sub_queue.pop_front() {
                                        if sub_visited.contains(&sid) { continue; }
                                        sub_visited.insert(sid.clone());
                                        let Some(sn) = sub_node_map.get(&sid) else { continue; };
                                        if sn.node_type == "start" || sn.node_type == "end" || sn.node_type == "comment" {
                                            if let Some(se) = sub_adj.get(&sid) { for e in se { enqueue_target(&e.target_node_id, &mut sub_remaining, &mut sub_queue); } }
                                            continue;
                                        }
                                        if let Some(ni) = self.nodes.get(&sn.node_type) {
                                            let sc = template::interpolate_value(&sn.data, &sub_context);
                                            let si = sub_context.get("prev").cloned().unwrap_or(Value::Null);
                                            match ni.execute(si, sc, &app).await {
                                                Ok(so) => {
                                                    sub_context["prev"] = so.clone();
                                                    sub_context["nodes"][&sid] = so;
                                                }
                                                Err(e) => {
                                                    log::warn!("Sub-workflow node {} failed: {}", sid, e);
                                                }
                                            }
                                        }
                                        if let Some(se) = sub_adj.get(&sid) { for e in se { enqueue_target(&e.target_node_id, &mut sub_remaining, &mut sub_queue); } }
                                    }

                                    let sub_result = sub_context.get("prev").cloned().unwrap_or(Value::Null);
                                    context["prev"] = sub_result.clone();
                                    context["nodes"][&node_id] = sub_result;
                                }
                                Err(e) => {
                                    context["prev"] = json!({ "error": format!("Sub-workflow load failed: {}", e) });
                                }
                            }
                        }
                        for edge in edges {
                            enqueue_target(&edge.target_node_id, &mut remaining_in_degree, &mut queue);
                        }
                    } else if node_def.node_type == "condition" {
                        let result_bool = output
                            .get("result")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false);
                        let port = if result_bool { "true" } else { "false" };
                        for edge in edges {
                            let edge_port = edge.source_port_id.as_deref().unwrap_or("");
                            if edge_port == port {
                                enqueue_target(&edge.target_node_id, &mut remaining_in_degree, &mut queue);
                            }
                        }
                    } else if node_def.node_type == "intent_recognition" {
                        let intent = output.get("intent").and_then(|v| v.as_str()).unwrap_or("default");
                        // Only fire default if no specific intent edge matches
                        let has_match = edges.iter().any(|e| {
                            e.source_port_id.as_deref().unwrap_or("") == intent
                        });
                        for edge in edges {
                            let edge_port = edge.source_port_id.as_deref().unwrap_or("");
                            if edge_port == intent || (!has_match && edge_port == "default") {
                                enqueue_target(&edge.target_node_id, &mut remaining_in_degree, &mut queue);
                            }
                        }
                    } else {
                        for edge in edges {
                            enqueue_target(&edge.target_node_id, &mut remaining_in_degree, &mut queue);
                        }
                    }
                }
            } else {
                let failed_ev = WorkflowEvent {
                    workflow_id: workflow.id.clone(),
                    event_type: "node_failed".into(),
                    node_id: Some(node_id.clone()),
                    data: None,
                    error: Some(last_error.clone()),
                    timestamp: Some(std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs_f64() * 1000.0),
                };
                Self::emit_event(&app, &failed_ev);
                record.events.push(failed_ev);

                if on_error == "continue" {
                    let error_output = json!({ "error": last_error, "failed": true });
                    context["prev"] = error_output.clone();
                    context["nodes"][&node_id] = error_output;
                    if let Some(edges) = adj.get(&node_id) {
                        for edge in edges {
                            enqueue_target(&edge.target_node_id, &mut remaining_in_degree, &mut queue);
                        }
                    }
                    continue;
                } else {
                    let wf_failed = WorkflowEvent {
                        workflow_id: workflow.id.clone(),
                        event_type: "failed".into(),
                        node_id: None,
                        data: None,
                        error: Some(last_error),
                        timestamp: Some(std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs_f64() * 1000.0),
                    };
                    Self::emit_event(&app, &wf_failed);
                    record.events.push(wf_failed);

                    record.status = "failed".into();
                    record.completed_at = Some(chrono::Local::now().to_rfc3339());
                    record.saved_context = Some(context.clone());
                    record.failed_node_id = Some(node_id.clone());
                    if let Err(e) = self.history.save(&record) {
                        eprintln!("Failed to save execution history: {}", e);
                    }
                    return Err("Workflow execution failed".into());
                }
            }
        }

        let final_result = context.get("prev").cloned().unwrap_or(Value::Null);

        let completed_ev = WorkflowEvent {
            workflow_id: workflow.id.clone(),
            event_type: "completed".into(),
            node_id: None,
            data: Some(final_result.clone()),
            error: None,
            timestamp: Some(std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs_f64() * 1000.0),
        };
        Self::emit_event(&app, &completed_ev);
        record.events.push(completed_ev);

        record.status = "completed".into();
        record.completed_at = Some(chrono::Local::now().to_rfc3339());
        record.result = Some(final_result.clone());
        if let Err(e) = self.history.save(&record) {
                        eprintln!("Failed to save execution history: {}", e);
                    }

        Ok(final_result)
    }

    fn timestamp_now() -> f64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs_f64() * 1000.0
    }

    /// Debug execution: pause at each node, inspect variables, control flow
    pub async fn run_debug(
        &self,
        workflow_id: &str,
        app: AppHandle,
        breakpoints: Vec<String>,
        mut debug_rx: tokio::sync::mpsc::Receiver<String>,
    ) -> Result<Value, String> {
        let workflow = self.storage.load(workflow_id)?;
        let now = chrono::Local::now().to_rfc3339();
        let record_id = format!("exec_{}", uuid::Uuid::new_v4());

        let mut record = ExecutionRecord {
            id: record_id.clone(),
            workflow_id: workflow.id.clone(),
            workflow_name: workflow.name.clone(),
            started_at: now,
            completed_at: None,
            status: "running".into(),
            events: Vec::new(),
            result: None,
            node_outputs: std::collections::HashMap::new(),
            saved_context: None,
            failed_node_id: None,
        };

        let started_event = WorkflowEvent {
            workflow_id: workflow.id.clone(),
            event_type: "started".into(),
            node_id: None,
            data: Some(json!({"record_id": record_id, "debug": true})),
            error: None,
            timestamp: Some(Self::timestamp_now()),
        };
        Self::emit_event(&app, &started_event);
        record.events.push(started_event);

        // Build adjacency
        let mut adj: HashMap<String, Vec<&crate::workflow::types::WorkflowEdge>> = HashMap::new();
        let mut in_degree: HashMap<String, usize> = HashMap::new();

        for node in &workflow.nodes {
            adj.entry(node.id.clone()).or_default();
            in_degree.entry(node.id.clone()).or_insert(0);
        }
        for edge in &workflow.edges {
            adj.entry(edge.source_node_id.clone())
                .or_default()
                .push(edge);
            *in_degree.entry(edge.target_node_id.clone()).or_insert(0) += 1;
        }

        let node_map: HashMap<String, _> = workflow
            .nodes
            .iter()
            .map(|n| (n.id.clone(), n.clone()))
            .collect();

        let env_vars_debug = crate::settings::get_env_vars_as_value(&app);
        let mut context: Value = json!({ "prev": null, "nodes": {}, "variables": {}, "env": env_vars_debug });

        let mut remaining_in_degree_debug = in_degree.clone();

        let mut queue: VecDeque<String> = remaining_in_degree_debug
            .iter()
            .filter(|(_, &deg)| deg == 0)
            .map(|(id, _)| id.clone())
            .collect();

        let mut visited: HashSet<String> = HashSet::new();
        let mut step_mode = true; // Start in step mode

        while let Some(node_id) = queue.pop_front() {
            if visited.contains(&node_id) {
                continue;
            }
            visited.insert(node_id.clone());

            let Some(node_def) = node_map.get(&node_id) else {
                continue;
            };

            // Skip start/end/comment marker nodes
            if node_def.node_type == "start" || node_def.node_type == "end" || node_def.node_type == "comment" {
                if let Some(edges) = adj.get(&node_id) {
                    for edge in edges {
                        enqueue_target(&edge.target_node_id, &mut remaining_in_degree_debug, &mut queue);
                    }
                }
                continue;
            }

            // Skip disabled nodes
            if let Some(disabled) = node_def.data.get("disabled").and_then(|v| v.as_bool()) {
                if disabled {
                    let skip_ev = WorkflowEvent {
                        workflow_id: workflow.id.clone(),
                        event_type: "node_skipped".into(),
                        node_id: Some(node_id.clone()),
                        data: None,
                        error: None,
                        timestamp: Some(Self::timestamp_now()),
                    };
                    Self::emit_event(&app, &skip_ev);
                    record.events.push(skip_ev);
                    if let Some(edges) = adj.get(&node_id) {
                        for edge in edges {
                            enqueue_target(&edge.target_node_id, &mut remaining_in_degree_debug, &mut queue);
                        }
                    }
                    continue;
                }
            }

            // Debug pause logic: pause if step_mode or breakpoint hit
            let should_pause = step_mode || breakpoints.contains(&node_id);

            if should_pause {
                // Emit debug_pause event
                let pause_ev = WorkflowEvent {
                    workflow_id: workflow.id.clone(),
                    event_type: "debug_pause".into(),
                    node_id: Some(node_id.clone()),
                    data: Some(json!({
                        "context": {
                            "prev": context.get("prev"),
                            "variables": context.get("variables"),
                            "node_count": visited.len(),
                        },
                        "breakpoints": &breakpoints,
                    })),
                    error: None,
                    timestamp: Some(Self::timestamp_now()),
                };
                Self::emit_event(&app, &pause_ev);
                record.events.push(pause_ev);

                // Wait for debug action
                let action = debug_rx.recv().await.ok_or("调试通道关闭")?;
                match action.as_str() {
                    "stop" => {
                        record.status = "failed".into();
                        record.completed_at = Some(chrono::Local::now().to_rfc3339());
                        let _ = self.history.save(&record);

                        let stop_ev = WorkflowEvent {
                            workflow_id: workflow.id.clone(),
                            event_type: "failed".into(),
                            node_id: None,
                            data: None,
                            error: Some("调试已停止".into()),
                            timestamp: Some(Self::timestamp_now()),
                        };
                        Self::emit_event(&app, &stop_ev);
                        return Err("调试已停止".into());
                    }
                    "skip" => {
                        if let Some(edges) = adj.get(&node_id) {
                            for edge in edges {
                                enqueue_target(&edge.target_node_id, &mut remaining_in_degree_debug, &mut queue);
                            }
                        }
                        continue;
                    }
                    "step" => {
                        step_mode = true;
                    }
                    "continue" => {
                        step_mode = false;
                    }
                    _ => {}
                }
            } else {
                // Not pausing — emit a quick debug_step event
                let step_ev = WorkflowEvent {
                    workflow_id: workflow.id.clone(),
                    event_type: "debug_pause".into(),
                    node_id: Some(node_id.clone()),
                    data: Some(json!({
                        "context": {
                            "prev": context.get("prev"),
                            "variables": context.get("variables"),
                            "node_count": visited.len(),
                        },
                        "auto_continue": true,
                    })),
                    error: None,
                    timestamp: Some(Self::timestamp_now()),
                };
                Self::emit_event(&app, &step_ev);
            }

            // --- Execute the node (same logic as run()) ---
            let Some(node_impl) = self.nodes.get(&node_def.node_type) else {
                let ev = WorkflowEvent {
                    workflow_id: workflow.id.clone(),
                    event_type: "node_failed".into(),
                    node_id: Some(node_id.clone()),
                    data: None,
                    error: Some(format!("Unknown node type: {}", node_def.node_type)),
                    timestamp: Some(Self::timestamp_now()),
                };
                Self::emit_event(&app, &ev);
                record.events.push(ev);
                continue;
            };

            let node_title = node_def
                .data
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or(&node_def.node_type)
                .to_string();

            let started_ev = WorkflowEvent {
                workflow_id: workflow.id.clone(),
                event_type: "node_started".into(),
                node_id: Some(node_id.clone()),
                data: Some(json!({
                    "title": node_title,
                    "type": node_def.node_type,
                    "input": context.get("prev").cloned(),
                })),
                error: None,
                timestamp: Some(Self::timestamp_now()),
            };
            Self::emit_event(&app, &started_ev);
            record.events.push(started_ev);

            let mut interpolated_config = template::interpolate_value(&node_def.data, &context);
            interpolated_config["__node_id"] = json!(node_id);

            let input = if node_def.node_type == "variable_get" {
                let key = interpolated_config.get("key").and_then(|v| v.as_str()).unwrap_or("");
                if !key.is_empty() {
                    context["variables"].get(key).cloned().unwrap_or(Value::Null)
                } else {
                    context.get("prev").cloned().unwrap_or(Value::Null)
                }
            } else if node_def.node_type == "merge" {
                let sources = interpolated_config.get("sources")
                    .and_then(|v| v.as_array())
                    .cloned()
                    .unwrap_or_default();
                if !sources.is_empty() {
                    let collected: Vec<Value> = sources.iter()
                        .filter_map(|s| s.as_str())
                        .filter_map(|s| context["nodes"].get(s).cloned())
                        .collect();
                    Value::Array(collected)
                } else {
                    context.get("prev").cloned().unwrap_or(Value::Null)
                }
            } else {
                context.get("prev").cloned().unwrap_or(Value::Null)
            };

            let default_timeout = match node_def.node_type.as_str() {
                "human_review" => 600_000u64,
                "ai_chat" | "http_request" | "sub_workflow"
                | "image_generate" | "tts" | "stt" | "intent_recognition"
                | "knowledge_write" | "knowledge_search"
                | "database" | "sql_query" | "agent" | "parameter_extractor" => 120_000u64,
                _ => 30_000u64,
            };
            let timeout_ms = interpolated_config
                .get("timeout_ms")
                .and_then(|v| v.as_u64())
                .unwrap_or(default_timeout);

            let on_error = interpolated_config
                .get("on_error")
                .and_then(|v| v.as_str())
                .unwrap_or("stop")
                .to_string();
            let max_retries: u32 = if on_error == "retry" { 3 } else { 1 };

            let mut last_error = String::new();
            let mut execution_succeeded = false;
            let mut output_value = Value::Null;

            for attempt in 0..max_retries {
                if attempt > 0 {
                    log::info!("Retrying node {} (attempt {})", node_id, attempt + 1);
                }

                let exec_result = tokio::time::timeout(
                    std::time::Duration::from_millis(timeout_ms),
                    node_impl.execute(input.clone(), interpolated_config.clone(), &app),
                )
                .await;

                match exec_result {
                    Ok(Ok(output)) => {
                        output_value = output;
                        execution_succeeded = true;
                        break;
                    }
                    Ok(Err(e)) => {
                        last_error = e;
                    }
                    Err(_) => {
                        last_error = format!(
                            "Node execution timed out after {}ms",
                            timeout_ms
                        );
                    }
                }
            }

            if execution_succeeded {
                let output = output_value;
                context["prev"] = output.clone();
                context["nodes"][&node_id] = output.clone();
                record.node_outputs.insert(node_id.clone(), output.clone());

                if node_def.node_type == "variable_set" {
                    if let Some(key) = output.get("key").and_then(|v| v.as_str()) {
                        if let Some(value) = output.get("value") {
                            context["variables"][key] = value.clone();
                        }
                    }
                }

                let completed_ev = WorkflowEvent {
                    workflow_id: workflow.id.clone(),
                    event_type: "node_completed".into(),
                    node_id: Some(node_id.clone()),
                    data: Some(output.clone()),
                    error: None,
                    timestamp: Some(Self::timestamp_now()),
                };
                Self::emit_event(&app, &completed_ev);
                record.events.push(completed_ev);

                // Determine which edges to follow (same logic as run())
                if let Some(edges) = adj.get(&node_id) {
                    if node_def.node_type == "loop" {
                        if let Some(items) = output.get("items").and_then(|v| v.as_array()) {
                            let loop_target_ids: Vec<String> = edges.iter().map(|e| e.target_node_id.clone()).collect();
                            let mut loop_results = Vec::new();
                            for (idx, item) in items.iter().enumerate() {
                                context["loop_index"] = json!(idx);
                                context["loop_item"] = item.clone();
                                context["prev"] = item.clone();
                                for target_id in &loop_target_ids {
                                    self.execute_subgraph(target_id, &node_map, &adj, &mut context, &app).await;
                                }
                                loop_results.push(context.get("prev").cloned().unwrap_or(Value::Null));
                            }
                            context["prev"] = json!(loop_results);
                            context["nodes"][&node_id] = json!({
                                "items": items,
                                "results": context["prev"].clone(),
                                "total": items.len(),
                            });
                            for target_id in &loop_target_ids {
                                self.mark_subgraph_visited(target_id, &adj, &mut visited, &mut remaining_in_degree_debug);
                            }
                        } else {
                            for edge in edges {
                                enqueue_target(&edge.target_node_id, &mut remaining_in_degree_debug, &mut queue);
                            }
                        }
                    } else if node_def.node_type == "batch_process" {
                        if let Some(items) = output.get("items").and_then(|v| v.as_array()) {
                            let error_mode = output.get("error_mode").and_then(|v| v.as_str()).unwrap_or("terminated");
                            let batch_target_ids: Vec<String> = edges.iter().map(|e| e.target_node_id.clone()).collect();
                            let mut batch_results = Vec::new();

                            for (idx, item) in items.iter().enumerate() {
                                context["batch_index"] = json!(idx);
                                context["batch_item"] = item.clone();
                                context["prev"] = item.clone();
                                for target_id in &batch_target_ids {
                                    if let Some(target_def) = node_map.get(target_id) {
                                        if let Some(target_impl) = self.nodes.get(&target_def.node_type) {
                                            let target_config = template::interpolate_value(&target_def.data, &context);
                                            match target_impl.execute(item.clone(), target_config, &app).await {
                                                Ok(result) => {
                                                    context["prev"] = result.clone();
                                                    context["nodes"][target_id] = result.clone();
                                                    self.execute_subgraph_continue(target_id, &node_map, &adj, &mut context, &app).await;
                                                    batch_results.push(context.get("prev").cloned().unwrap_or(Value::Null));
                                                }
                                                Err(e) => {
                                                    match error_mode {
                                                        "terminated" => return Err(format!("批处理第 {} 项失败: {}", idx, e)),
                                                        "continue_on_error" => batch_results.push(json!({"error": e, "index": idx})),
                                                        "remove_abnormal" => {}
                                                        _ => return Err(format!("批处理第 {} 项失败: {}", idx, e)),
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            context["prev"] = json!(batch_results);
                            context["nodes"][&node_id] = json!({"items": items, "results": context["prev"].clone(), "total": items.len()});
                            for target_id in &batch_target_ids {
                                self.mark_subgraph_visited(target_id, &adj, &mut visited, &mut remaining_in_degree_debug);
                            }
                        } else {
                            for edge in edges {
                                enqueue_target(&edge.target_node_id, &mut remaining_in_degree_debug, &mut queue);
                            }
                        }
                    } else if node_def.node_type == "sub_workflow" {
                        if let Some(sub_id) = output.get("sub_workflow_id").and_then(|v| v.as_str()) {
                            match self.storage.load(sub_id) {
                                Ok(sub_wf) => {
                                    let mut sub_context: Value = json!({ "prev": context["prev"].clone(), "nodes": {}, "variables": context.get("variables").cloned().unwrap_or(json!({})) });
                                    let sub_node_map: std::collections::HashMap<String, _> = sub_wf.nodes.iter().map(|n| (n.id.clone(), n.clone())).collect();
                                    let mut sub_remaining: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
                                    let mut sub_adj: std::collections::HashMap<String, Vec<&crate::workflow::types::WorkflowEdge>> = std::collections::HashMap::new();
                                    for n in &sub_wf.nodes { sub_remaining.entry(n.id.clone()).or_insert(0); sub_adj.entry(n.id.clone()).or_default(); }
                                    for e in &sub_wf.edges { *sub_remaining.entry(e.target_node_id.clone()).or_insert(0) += 1; sub_adj.entry(e.source_node_id.clone()).or_default().push(e); }
                                    let mut sub_queue: VecDeque<String> = sub_remaining.iter().filter(|(_, &d)| d == 0).map(|(id, _)| id.clone()).collect();
                                    let mut sub_visited: HashSet<String> = HashSet::new();

                                    while let Some(sid) = sub_queue.pop_front() {
                                        if sub_visited.contains(&sid) { continue; }
                                        sub_visited.insert(sid.clone());
                                        let Some(sn) = sub_node_map.get(&sid) else { continue; };
                                        if sn.node_type == "start" || sn.node_type == "end" || sn.node_type == "comment" {
                                            if let Some(se) = sub_adj.get(&sid) { for e in se { enqueue_target(&e.target_node_id, &mut sub_remaining, &mut sub_queue); } }
                                            continue;
                                        }
                                        if let Some(ni) = self.nodes.get(&sn.node_type) {
                                            let sc = template::interpolate_value(&sn.data, &sub_context);
                                            let si = sub_context.get("prev").cloned().unwrap_or(Value::Null);
                                            match ni.execute(si, sc, &app).await {
                                                Ok(so) => {
                                                    sub_context["prev"] = so.clone();
                                                    sub_context["nodes"][&sid] = so;
                                                }
                                                Err(e) => {
                                                    log::warn!("Sub-workflow node {} failed: {}", sid, e);
                                                }
                                            }
                                        }
                                        if let Some(se) = sub_adj.get(&sid) { for e in se { enqueue_target(&e.target_node_id, &mut sub_remaining, &mut sub_queue); } }
                                    }

                                    let sub_result = sub_context.get("prev").cloned().unwrap_or(Value::Null);
                                    context["prev"] = sub_result.clone();
                                    context["nodes"][&node_id] = sub_result;
                                }
                                Err(e) => {
                                    context["prev"] = json!({ "error": format!("Sub-workflow load failed: {}", e) });
                                }
                            }
                        }
                        for edge in edges {
                            enqueue_target(&edge.target_node_id, &mut remaining_in_degree_debug, &mut queue);
                        }
                    } else if node_def.node_type == "condition" {
                        let result_bool = output.get("result").and_then(|v| v.as_bool()).unwrap_or(false);
                        let port = if result_bool { "true" } else { "false" };
                        for edge in edges {
                            let edge_port = edge.source_port_id.as_deref().unwrap_or("");
                            if edge_port == port {
                                enqueue_target(&edge.target_node_id, &mut remaining_in_degree_debug, &mut queue);
                            }
                        }
                    } else if node_def.node_type == "intent_recognition" {
                        let intent = output.get("intent").and_then(|v| v.as_str()).unwrap_or("default");
                        let has_match = edges.iter().any(|e| e.source_port_id.as_deref().unwrap_or("") == intent);
                        for edge in edges {
                            let edge_port = edge.source_port_id.as_deref().unwrap_or("");
                            if edge_port == intent || (!has_match && edge_port == "default") {
                                enqueue_target(&edge.target_node_id, &mut remaining_in_degree_debug, &mut queue);
                            }
                        }
                    } else if node_def.node_type == "human_review" {
                        let action = output.get("action").and_then(|v| v.as_str()).unwrap_or("reject");
                        for edge in edges {
                            let edge_port = edge.source_port_id.as_deref().unwrap_or("");
                            if edge_port == action || edge_port.is_empty() {
                                enqueue_target(&edge.target_node_id, &mut remaining_in_degree_debug, &mut queue);
                            }
                        }
                    } else {
                        for edge in edges {
                            enqueue_target(&edge.target_node_id, &mut remaining_in_degree_debug, &mut queue);
                        }
                    }
                }
            } else {
                let failed_ev = WorkflowEvent {
                    workflow_id: workflow.id.clone(),
                    event_type: "node_failed".into(),
                    node_id: Some(node_id.clone()),
                    data: None,
                    error: Some(last_error.clone()),
                    timestamp: Some(Self::timestamp_now()),
                };
                Self::emit_event(&app, &failed_ev);
                record.events.push(failed_ev);

                if on_error == "continue" {
                    let error_output = json!({ "error": last_error, "failed": true });
                    context["prev"] = error_output.clone();
                    context["nodes"][&node_id] = error_output;
                    if let Some(edges) = adj.get(&node_id) {
                        for edge in edges {
                            enqueue_target(&edge.target_node_id, &mut remaining_in_degree_debug, &mut queue);
                        }
                    }
                    continue;
                } else {
                    let wf_failed = WorkflowEvent {
                        workflow_id: workflow.id.clone(),
                        event_type: "failed".into(),
                        node_id: None,
                        data: None,
                        error: Some(last_error),
                        timestamp: Some(Self::timestamp_now()),
                    };
                    Self::emit_event(&app, &wf_failed);
                    record.events.push(wf_failed);

                    record.status = "failed".into();
                    record.completed_at = Some(chrono::Local::now().to_rfc3339());
                    record.saved_context = Some(context.clone());
                    record.failed_node_id = Some(node_id.clone());
                    if let Err(e) = self.history.save(&record) {
                        eprintln!("Failed to save execution history: {}", e);
                    }
                    return Err("Workflow debug execution failed".into());
                }
            }
        }

        let final_result = context.get("prev").cloned().unwrap_or(Value::Null);

        let completed_ev = WorkflowEvent {
            workflow_id: workflow.id.clone(),
            event_type: "completed".into(),
            node_id: None,
            data: Some(final_result.clone()),
            error: None,
            timestamp: Some(Self::timestamp_now()),
        };
        Self::emit_event(&app, &completed_ev);
        record.events.push(completed_ev);

        record.status = "completed".into();
        record.completed_at = Some(chrono::Local::now().to_rfc3339());
        record.result = Some(final_result.clone());
        if let Err(e) = self.history.save(&record) {
            eprintln!("Failed to save execution history: {}", e);
        }

        Ok(final_result)
    }

    /// Resume a failed workflow from the failed node using saved context
    pub async fn resume(&self, record_id: &str, app: AppHandle) -> Result<Value, String> {
        let old_record = self.history.get(record_id)?;
        let saved_context = old_record.saved_context
            .ok_or("此记录没有保存的执行上下文，无法恢复")?;
        let failed_node_id = old_record.failed_node_id
            .ok_or("没有找到失败的节点 ID")?;

        // Re-run the workflow starting from the failed node
        let workflow = self.storage.load(&old_record.workflow_id)?;
        let now = chrono::Local::now().to_rfc3339();
        let new_record_id = format!("exec_{}", uuid::Uuid::new_v4());

        let mut record = ExecutionRecord {
            id: new_record_id.clone(),
            workflow_id: workflow.id.clone(),
            workflow_name: workflow.name.clone(),
            started_at: now,
            completed_at: None,
            status: "running".into(),
            events: Vec::new(),
            result: None,
            node_outputs: old_record.node_outputs.clone(),
            saved_context: None,
            failed_node_id: None,
        };

        let started_event = WorkflowEvent {
            workflow_id: workflow.id.clone(),
            event_type: "started".into(),
            node_id: None,
            data: Some(json!({"record_id": new_record_id, "resumed_from": record_id})),
            error: None,
            timestamp: Some(std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs_f64() * 1000.0),
        };
        Self::emit_event(&app, &started_event);
        record.events.push(started_event);

        // Build adjacency
        let mut adj: HashMap<String, Vec<&crate::workflow::types::WorkflowEdge>> = HashMap::new();
        for node in &workflow.nodes {
            adj.entry(node.id.clone()).or_default();
        }
        for edge in &workflow.edges {
            adj.entry(edge.source_node_id.clone()).or_default().push(edge);
        }

        let node_map: HashMap<String, _> = workflow.nodes.iter()
            .map(|n| (n.id.clone(), n.clone())).collect();

        // Restore context
        let mut context = saved_context;

        // Already-completed nodes (from saved context)
        let completed_nodes: HashSet<String> = context.get("nodes")
            .and_then(|n| n.as_object())
            .map(|obj| obj.keys().cloned().collect())
            .unwrap_or_default();

        // BFS from failed node
        let mut queue: VecDeque<String> = VecDeque::new();
        queue.push_back(failed_node_id);
        let mut visited: HashSet<String> = completed_nodes;

        while let Some(node_id) = queue.pop_front() {
            if visited.contains(&node_id) { continue; }
            visited.insert(node_id.clone());

            let Some(node_def) = node_map.get(&node_id) else { continue; };
            if node_def.node_type == "start" || node_def.node_type == "end" {
                if let Some(edges) = adj.get(&node_id) {
                    for edge in edges { queue.push_back(edge.target_node_id.clone()); }
                }
                continue;
            }

            let Some(node_impl) = self.nodes.get(&node_def.node_type) else { continue; };

            let interpolated_config = template::interpolate_value(&node_def.data, &context);
            let input = context.get("prev").cloned().unwrap_or(Value::Null);

            let default_timeout = match node_def.node_type.as_str() {
                "human_review" => 600_000u64,
                "ai_chat" | "http_request" | "sub_workflow" | "image_generate" | "tts" | "stt" |
                "intent_recognition" | "knowledge_write" | "knowledge_search" | "database" | "sql_query" | "parameter_extractor" => 120_000u64,
                _ => 30_000u64,
            };
            let timeout_ms = interpolated_config.get("timeout_ms")
                .and_then(|v| v.as_u64()).unwrap_or(default_timeout);

            let exec_result = tokio::time::timeout(
                std::time::Duration::from_millis(timeout_ms),
                node_impl.execute(input, interpolated_config, &app),
            ).await;

            match exec_result {
                Ok(Ok(output)) => {
                    context["prev"] = output.clone();
                    context["nodes"][&node_id] = output.clone();
                    record.node_outputs.insert(node_id.clone(), output.clone());

                    let ev = WorkflowEvent {
                        workflow_id: workflow.id.clone(),
                        event_type: "node_completed".into(),
                        node_id: Some(node_id.clone()),
                        data: Some(output),
                        error: None,
                        timestamp: Some(std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs_f64() * 1000.0),
                    };
                    Self::emit_event(&app, &ev);
                    record.events.push(ev);

                    if let Some(edges) = adj.get(&node_id) {
                        for edge in edges { queue.push_back(edge.target_node_id.clone()); }
                    }
                }
                Ok(Err(e)) => {
                    record.status = "failed".into();
                    record.completed_at = Some(chrono::Local::now().to_rfc3339());
                    record.saved_context = Some(context.clone());
                    record.failed_node_id = Some(node_id.clone());
                    let _ = self.history.save(&record);
                    return Err(format!("恢复执行失败: {}", e));
                }
                Err(_) => {
                    record.status = "failed".into();
                    record.completed_at = Some(chrono::Local::now().to_rfc3339());
                    record.saved_context = Some(context.clone());
                    record.failed_node_id = Some(node_id.clone());
                    let _ = self.history.save(&record);
                    return Err(format!("恢复执行超时 {}ms", timeout_ms));
                }
            }
        }

        let final_result = context.get("prev").cloned().unwrap_or(Value::Null);
        record.status = "completed".into();
        record.completed_at = Some(chrono::Local::now().to_rfc3339());
        record.result = Some(final_result.clone());
        let _ = self.history.save(&record);

        let ev = WorkflowEvent {
            workflow_id: workflow.id.clone(),
            event_type: "completed".into(),
            node_id: None,
            data: Some(final_result.clone()),
            error: None,
            timestamp: Some(std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs_f64() * 1000.0),
        };
        Self::emit_event(&app, &ev);

        Ok(final_result)
    }
}
