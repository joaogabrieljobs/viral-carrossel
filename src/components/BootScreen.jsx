import React from 'react';
import BrandLogo from './BrandLogo.jsx';
import { GLOBAL_STYLE } from '../styles/global-style.js';

const BOOT_STYLE = `
  .moont-boot {
    width: 100%;
    min-height: 100vh;
    min-height: 100svh;
    display: grid;
    place-items: center;
    padding: 32px 24px;
    box-sizing: border-box;
    background: #090a0f;
    color: #f3f0e7;
    font-family: var(--font-ui, system-ui, -apple-system, sans-serif);
  }
  .moont-boot__content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
    width: 100%;
    max-width: 460px;
    text-align: center;
  }
  .moont-boot__status {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    color: #aaa8b5;
    font-size: 14px;
    line-height: 1.5;
  }
  .moont-boot__spinner {
    width: 28px;
    height: 28px;
    box-sizing: border-box;
    border: 2px solid rgba(139, 128, 255, .16);
    border-top-color: #9387ff;
    border-right-color: #9387ff;
    border-radius: 50%;
    animation: moont-boot-turn 1s linear infinite;
  }
  @keyframes moont-boot-turn { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    .moont-boot__spinner { animation: none; }
  }
`;

/** Mesma assinatura durante o carregamento do app, da sessão e dos projetos. */
export default function BootScreen({ label = 'Preparando a Moont…', busy = true, children }) {
  return (
    <main className="moont-boot" aria-label="Moont">
      <style>{GLOBAL_STYLE}</style>
      <style>{BOOT_STYLE}</style>
      <div className="moont-boot__content">
        <BrandLogo height={44} style={{ color: '#f3f0e7', maxWidth: '100%' }} />
        {busy && (
          <div className="moont-boot__status" role="status" aria-live="polite" aria-atomic="true">
            <span className="moont-boot__spinner" aria-hidden="true" />
            <span>{label}</span>
          </div>
        )}
        {children}
      </div>
    </main>
  );
}
