//! O Moont no desktop (Tauri 2).
//!
//! Arquitetura (ver docs/DESKTOP-TAURI.md): a janela principal carrega a
//! origem de PRODUÇÃO (`https://moont.ai`, `origem::ORIGEM`). Não há
//! servidor embarcado nem export: o app é a mesma SPA Vite servida pela Vercel,
//! com APIs serverless, sessão e geração no servidor. Nenhuma API
//! do Tauri é exposta à página (`capabilities/default.json` sem permissão,
//! `withGlobalTauri: false`).
//!
//! O que a casca faz além de mostrar a página:
//! - `window.open`/`_blank` para outra origem abre no navegador do sistema;
//!   mesma origem e `about:blank` ficam no webview. Navegação na MESMA janela
//!   (Stripe Checkout e Google) fica no webview e volta sozinha.
//! - Download (`<a download>` com `blob:` ou URL do Storage) vai para
//!   `~/Downloads` sem sobrescrever, e o Finder revela o arquivo ao terminar.
//!   O WKWebView não faz isso sozinho: sem `on_download`, salvar uma mídia
//!   gerada seria um clique morto.
//! - Segunda instância só traz a janela existente para a frente.

mod origem;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

use tauri::webview::{DownloadEvent, NewWindowResponse, WebviewWindowBuilder};
use tauri::{Manager, WebviewUrl};
use tauri_plugin_opener::OpenerExt;

/// URL do download → destino escolhido no `Requested`. No macOS o `Finished`
/// chega sem caminho (limitação da API), então guardamos o nosso.
struct Downloads(Mutex<HashMap<String, PathBuf>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Precisa ser o primeiro plugin registrado (documentação do plugin).
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(janela) = app.get_webview_window("main") {
                let _ = janela.unminimize();
                let _ = janela.set_focus();
            }
        }))
        // A página remota não recebe IPC. Deixe o WKWebView entregar _blank ao
        // on_new_window abaixo, que decide com segurança o que abre fora.
        .plugin(tauri_plugin_opener::Builder::new().open_js_links_on_click(false).build())
        .manage(Downloads(Mutex::new(HashMap::new())))
        .setup(|app| {
            let abre_fora = app.handle().clone();
            let baixa = app.handle().clone();
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(origem::inicial()))
                .title("Moont")
                .inner_size(1440.0, 900.0)
                .min_inner_size(1024.0, 640.0)
                .zoom_hotkeys_enabled(true)
                .on_new_window(move |url, _features| match origem::nova_janela(&url) {
                    origem::NovaJanela::Webview => NewWindowResponse::Allow,
                    origem::NovaJanela::Navegador => {
                        let _ = abre_fora.opener().open_url(url.as_str(), None::<&str>);
                        NewWindowResponse::Deny
                    }
                    origem::NovaJanela::Negar => NewWindowResponse::Deny,
                })
                .on_download(move |_webview, evento| {
                    match evento {
                        DownloadEvent::Requested { url, destination } => {
                            let pasta = baixa
                                .path()
                                .download_dir()
                                .unwrap_or_else(|_| std::env::temp_dir());
                            let sugerido = destination
                                .file_name()
                                .and_then(|s| s.to_str())
                                .map(str::to_string);
                            let nome = origem::nome_seguro(sugerido.as_deref(), &url);
                            let alvo = origem::destino_unico(&pasta, &nome, |p| p.exists());
                            if let Ok(mut mapa) = baixa.state::<Downloads>().0.lock() {
                                mapa.insert(url.to_string(), alvo.clone());
                            }
                            eprintln!("[moont] download → {}", alvo.display());
                            *destination = alvo;
                        }
                        DownloadEvent::Finished { url, path, success } => {
                            let guardado = baixa
                                .state::<Downloads>()
                                .0
                                .lock()
                                .ok()
                                .and_then(|mut m| m.remove(&url.to_string()));
                            match (success, path.or(guardado)) {
                                (true, Some(p)) => {
                                    let _ = baixa.opener().reveal_item_in_dir(&p);
                                }
                                (true, None) => eprintln!("[moont] download concluído sem caminho"),
                                (false, _) => eprintln!("[moont] download falhou: {url}"),
                            }
                        }
                        _ => {}
                    }
                    true
                })
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o Moont desktop");
}
