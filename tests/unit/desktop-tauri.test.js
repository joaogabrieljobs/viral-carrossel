import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('casca desktop Tauri', () => {
  const rust = read('desktop/src-tauri/src/lib.rs');
  const origin = read('desktop/src-tauri/src/origem.rs');
  const config = JSON.parse(read('desktop/src-tauri/tauri.conf.json'));
  const capability = JSON.parse(read('desktop/src-tauri/capabilities/default.json'));
  const cargo = read('desktop/src-tauri/Cargo.toml');
  const gate = read('scripts/build-desktop.sh');
  const appPackage = JSON.parse(read('package.json'));

  it('carrega somente a origem canônica de produção, sem loopback', () => {
    expect(origin).toContain('pub const ORIGEM: &str = "https://moont.ai";');
    expect(origin).not.toMatch(/127\.0\.0\.1|localhost/);
    expect(rust).toContain('WebviewUrl::External(origem::inicial())');
    expect(gate).toContain('ORIGEM="https://moont.ai"');
  });

  it('não expõe IPC do Tauri à página remota', () => {
    expect(config.app.withGlobalTauri).toBe(false);
    expect(config.app.security.csp).toBeNull();
    expect(config.app.windows).toEqual([]);
    expect(capability.windows).toEqual(['main']);
    expect(capability.permissions).toEqual([]);
  });

  it('trata janela externa, download e segunda instância', () => {
    expect(rust).toContain('open_js_links_on_click(false)');
    expect(rust).toContain('.on_new_window(');
    expect(rust).toContain('NewWindowResponse::Deny');
    expect(rust).toContain('.on_download(');
    expect(rust).toContain('DownloadEvent::Requested');
    expect(rust).toContain('DownloadEvent::Finished');
    expect(rust).toMatch(/_\s*=>\s*\{\}/);
    expect(rust).toContain('tauri_plugin_single_instance::init');
    expect(cargo).toContain('tauri-plugin-single-instance = "2"');
  });

  it('mantém versão, bundle e requisito do WKDownload coerentes', () => {
    expect(config.version).toBe(appPackage.version);
    expect(config.bundle.macOS.minimumSystemVersion).toBe('11.3');
    expect(config.bundle.resources['resources/version.json']).toBe('version.json');
    expect(cargo).toContain(`version = "${appPackage.version}"`);
    expect(appPackage.version).toBe('1.0.0');
    expect(gate).toContain('VERSAO=$(node -p');
  });
});
