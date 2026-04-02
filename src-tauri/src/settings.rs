use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AiProvider {
    pub id: String,
    pub name: String,
    #[serde(default = "default_provider_type")]
    pub provider_type: String, // "openai" | "claude"
    pub api_base: String,
    pub api_key: String,
    pub model: String,
    /// Backward compat: old format used `enabled`, new format uses `is_default`
    #[serde(default, alias = "enabled")]
    pub is_default: bool,
}

fn default_provider_type() -> String { "openai".to_string() }

const STORE_KEY: &str = "ai_providers";

pub fn get_providers(app: &AppHandle) -> Vec<AiProvider> {
    let store = app.store("settings.json").ok();
    if let Some(store) = store {
        if let Some(val) = store.get(STORE_KEY) {
            if let Ok(providers) = serde_json::from_value::<Vec<AiProvider>>(val) {
                return providers;
            }
        }
    }
    Vec::new()
}

pub fn save_providers(app: &AppHandle, providers: &[AiProvider]) -> Result<(), String> {
    let store = app
        .store("settings.json")
        .map_err(|e| format!("Failed to open store: {}", e))?;
    let val = serde_json::to_value(providers).map_err(|e| e.to_string())?;
    store.set(STORE_KEY, val);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_default_provider(app: &AppHandle) -> Option<AiProvider> {
    let providers = get_providers(app);
    providers.into_iter().find(|p| p.is_default && !p.api_key.is_empty())
}

pub fn get_provider_by_id(app: &AppHandle, id: &str) -> Option<AiProvider> {
    let providers = get_providers(app);
    providers.into_iter().find(|p| p.id == id)
}

// ==================== Environment Variables ====================

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct EnvVariable {
    pub key: String,
    pub value: String,
    pub var_type: String, // "string" | "number" | "secret"
    pub description: String,
}

const ENV_STORE_KEY: &str = "env_variables";

pub fn get_env_vars(app: &AppHandle) -> Vec<EnvVariable> {
    let store = app.store("settings.json").ok();
    if let Some(store) = store {
        if let Some(val) = store.get(ENV_STORE_KEY) {
            if let Ok(vars) = serde_json::from_value::<Vec<EnvVariable>>(val) {
                return vars;
            }
        }
    }
    Vec::new()
}

pub fn save_env_vars(app: &AppHandle, vars: &[EnvVariable]) -> Result<(), String> {
    let store = app.store("settings.json").map_err(|e| format!("Failed to open store: {}", e))?;
    let val = serde_json::to_value(vars).map_err(|e| e.to_string())?;
    store.set(ENV_STORE_KEY, val);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

/// Get env vars as a serde_json::Value object for injection into execution context
pub fn get_env_vars_as_value(app: &AppHandle) -> serde_json::Value {
    let vars = get_env_vars(app);
    let mut obj = serde_json::Map::new();
    for var in vars {
        obj.insert(var.key, serde_json::Value::String(var.value));
    }
    serde_json::Value::Object(obj)
}
