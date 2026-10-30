use std::path::Path;

fn main() {
    // `bundle.resources` aponta para resources/version.json, que o portão
    // (scripts/build-desktop.sh) grava com commit/branch/data. O tauri-build
    // confere o recurso já na compilação: num clone limpo, `cargo test` ou
    // `tauri dev` sem o portão falhariam com "resource path doesn't exist".
    // Placeholder marcado como "sujo" para nunca passar por build oficial.
    let recurso = Path::new(env!("CARGO_MANIFEST_DIR")).join("resources/version.json");
    if !recurso.exists() {
        if let Some(pasta) = recurso.parent() {
            let _ = std::fs::create_dir_all(pasta);
        }
        let _ = std::fs::write(
            &recurso,
            "{\"commit\":\"dev\",\"commitCurto\":\"dev\",\"branch\":\"dev\",\"geradoEm\":\"\",\"canal\":\"desktop\",\"versao\":\"dev\",\"origem\":\"https://moont.ai\",\"sujo\":true}\n",
        );
    }
    tauri_build::build()
}
