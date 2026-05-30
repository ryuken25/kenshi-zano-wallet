// Kenshi desktop (Tauri 2) entry point (§2.5).
//
// Ships the built web UI in a Tauri window. The optional local-privacy mode (§2.4)
// launches a bundled `zanod` as a sidecar and reports a sync percentage back to the
// UI via the `zanod_status` command. When no sidecar binary is configured, the UI
// simply uses the remote node list from Settings — so the EXE works either way.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;

#[derive(Serialize)]
struct NodeStatus {
    mode: String,    // "remote" | "local-sidecar"
    running: bool,
    sync_percent: f32,
}

/// Reports the local zanod sidecar status. Stub returns "remote" until a sidecar
/// binary is bundled (see tauri.conf.json `externalBin`). The UI degrades to the
/// configured remote node list when running == false.
#[tauri::command]
fn zanod_status() -> NodeStatus {
    NodeStatus {
        mode: "remote".into(),
        running: false,
        sync_percent: 0.0,
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![zanod_status])
        .run(tauri::generate_context!())
        .expect("error while running Kenshi");
}
