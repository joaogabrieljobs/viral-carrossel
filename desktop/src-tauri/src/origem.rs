//! Origem do produto e regras puras de navegação e download. Sem Tauri aqui:
//! é o que `cargo test` cobre (`cargo test` em `desktop/src-tauri`).

use std::path::{Path, PathBuf};
use url::Url;

/// A janela carrega o host canônico de produção. Mudar aqui = mudar no teste e
/// em `scripts/build-desktop.sh`, que conferem o literal.
pub const ORIGEM: &str = "https://moont.ai";

/// Único host que deve permanecer dentro do webview. Os aliases do produto
/// redirecionam para ele antes de abrir o aplicativo.
pub const HOSTS_DO_PRODUTO: [&str; 1] = ["moont.ai"];

/// Nome usado quando nem a página nem a URL dão um nome de arquivo.
pub const NOME_PADRAO: &str = "moont-download";

pub fn inicial() -> Url {
    Url::parse(&format!("{ORIGEM}/")).expect("ORIGEM é uma URL válida")
}

/// `https` num host do produto (com ou sem `www`).
pub fn e_do_produto(url: &Url) -> bool {
    if url.scheme() != "https" {
        return false;
    }
    let Some(host) = url.host_str() else { return false };
    let host = host.strip_prefix("www.").unwrap_or(host);
    HOSTS_DO_PRODUTO.contains(&host)
}

/// O que fazer com `window.open` / `target="_blank"`.
#[derive(Debug, PartialEq, Eq)]
pub enum NovaJanela {
    /// Fica a cargo do webview (mesma origem ou `about:blank`).
    Webview,
    /// Outra origem: abre no navegador do sistema, o webview nega.
    Navegador,
    /// Esquema desconhecido (`javascript:`, `file:`…): só nega.
    Negar,
}

pub fn nova_janela(url: &Url) -> NovaJanela {
    if url.scheme() == "about" || e_do_produto(url) {
        return NovaJanela::Webview;
    }
    match url.scheme() {
        "http" | "https" | "mailto" => NovaJanela::Navegador,
        _ => NovaJanela::Negar,
    }
}

/// Nome de arquivo seguro para gravar em `~/Downloads`: usa o nome sugerido
/// pela página (`a.download`), senão o último segmento da URL, senão
/// `NOME_PADRAO`. Nunca contém separador de caminho nem vira `.`/`..`.
pub fn nome_seguro(sugerido: Option<&str>, url: &Url) -> String {
    let da_url = url
        .path_segments()
        .and_then(|mut s| s.next_back())
        .map(|s| s.to_string());
    let bruto = sugerido
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .or(da_url)
        .unwrap_or_default();
    let limpo: String = bruto
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '\0' => '-',
            c if c.is_control() => '-',
            c => c,
        })
        .collect();
    let limpo = limpo.trim().trim_matches('.').to_string();
    let limpo: String = limpo.chars().take(120).collect();
    if limpo.is_empty() {
        NOME_PADRAO.to_string()
    } else {
        limpo
    }
}

/// `pasta/nome`, e `pasta/nome (2)`, `(3)`… enquanto `existe` disser que o
/// caminho já está ocupado. Nunca sobrescreve um arquivo do usuário.
pub fn destino_unico(pasta: &Path, nome: &str, existe: impl Fn(&Path) -> bool) -> PathBuf {
    let primeiro = pasta.join(nome);
    if !existe(&primeiro) {
        return primeiro;
    }
    let (base, ext) = match nome.rsplit_once('.') {
        Some((b, e)) if !b.is_empty() => (b.to_string(), format!(".{e}")),
        _ => (nome.to_string(), String::new()),
    };
    (2..)
        .map(|n| pasta.join(format!("{base} ({n}){ext}")))
        .find(|p| !existe(p))
        .expect("algum número livre")
}

#[cfg(test)]
mod testes {
    use super::*;

    fn u(s: &str) -> Url {
        Url::parse(s).unwrap()
    }

    #[test]
    fn inicial_e_a_raiz_da_origem() {
        assert_eq!(inicial().as_str(), "https://moont.ai/");
    }

    #[test]
    fn produto_e_so_https_no_host_canonico() {
        assert!(e_do_produto(&u("https://moont.ai/dashboard")));
        assert!(e_do_produto(&u("https://www.moont.ai/studio")));
        assert!(!e_do_produto(&u("http://moont.ai/")));
        assert!(!e_do_produto(&u("https://viral-carrossel.vercel.app/")));
        assert!(!e_do_produto(&u("https://moont.ai.evil.com/")));
        assert!(!e_do_produto(&u("https://evilmoont.ai/")));
    }

    #[test]
    fn nova_janela_decide_webview_navegador_ou_nega() {
        assert_eq!(nova_janela(&u("about:blank")), NovaJanela::Webview);
        assert_eq!(nova_janela(&u("https://moont.ai/acervo")), NovaJanela::Webview);
        assert_eq!(nova_janela(&u("https://checkout.stripe.com/x")), NovaJanela::Navegador);
        assert_eq!(nova_janela(&u("http://example.com/")), NovaJanela::Navegador);
        assert_eq!(nova_janela(&u("mailto:suporte@moont.ai")), NovaJanela::Navegador);
        assert_eq!(nova_janela(&u("javascript:alert(1)")), NovaJanela::Negar);
        assert_eq!(nova_janela(&u("file:///etc/passwd")), NovaJanela::Negar);
    }

    #[test]
    fn nome_seguro_prefere_o_sugerido_e_tira_separadores() {
        let url = u("https://x.supabase.co/storage/v1/object/public/film-projects/a/b/take.mp4?token=1");
        assert_eq!(nome_seguro(Some("cena-01.mp4"), &url), "cena-01.mp4");
        assert_eq!(nome_seguro(None, &url), "take.mp4");
        // sem separador e sem ponto inicial (não vira arquivo oculto)
        assert_eq!(nome_seguro(Some("../../.ssh/authorized_keys"), &url), "-..-.ssh-authorized_keys");
        assert_eq!(nome_seguro(Some("/etc/passwd"), &url), "-etc-passwd");
        assert_eq!(nome_seguro(Some("  "), &u("blob:https://moont.ai/")), NOME_PADRAO);
    }

    #[test]
    fn nome_seguro_cai_no_padrao_quando_nao_ha_nome() {
        let blob = u("blob:https://moont.ai/3f2a");
        // `blob:` não tem segmentos de caminho (cannot-be-a-base): cai no padrão
        assert_eq!(nome_seguro(None, &blob), NOME_PADRAO);
        assert_eq!(nome_seguro(Some(".."), &u("https://moont.ai/")), NOME_PADRAO);
        assert_eq!(nome_seguro(Some("..."), &u("https://moont.ai/")), NOME_PADRAO);
    }

    #[test]
    fn destino_unico_numera_sem_sobrescrever() {
        let pasta = Path::new("/tmp/downloads");
        let ocupados = ["/tmp/downloads/take.mp4", "/tmp/downloads/take (2).mp4"];
        let existe = |p: &Path| ocupados.contains(&p.to_str().unwrap());
        assert_eq!(destino_unico(pasta, "take.mp4", existe), pasta.join("take (3).mp4"));
        assert_eq!(destino_unico(pasta, "novo.mp4", existe), pasta.join("novo.mp4"));
        assert_eq!(
            destino_unico(pasta, "semext", |p| p.to_str() == Some("/tmp/downloads/semext")),
            pasta.join("semext (2)")
        );
    }
}
