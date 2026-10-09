import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { shouldShowOnboardingLanding } from './utils/landing-gate.js';
import { GLOBAL_STYLE } from './styles/global-style.js';

/** Mostra o erro em vez de página em branco quando o render falha (ex.: dados corruptos). */
class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }

  static getDerivedStateFromError(err) {
    return { err };
  }

  componentDidCatch(err, info) {
    console.error('[Moont]', err, info?.componentStack);
  }

  render() {
    const { err } = this.state;
    if (err) {
      const msg = err?.message || String(err);
      return (
        <div style={{
          padding: 24,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          maxWidth: 560,
          margin: '48px auto',
          lineHeight: 1.47,
          color: '#f3f0e7',
          background: '#11131b',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 20,
        }}>
          <h1 style={{ fontSize: 17, fontWeight: 600, marginBottom: 12 }}>
            Erro ao carregar a Moont
          </h1>
          <pre style={{
            whiteSpace: 'pre-wrap',
            background: '#181b25',
            padding: 16,
            borderRadius: 11,
            fontSize: 13,
            border: '1px solid rgba(255,255,255,0.12)',
          }}>{msg}</pre>
          <p style={{ fontSize: 15, color: '#bbb9c7', marginTop: 16 }}>
            Tenta: janela anónima, outro navegador, ou em DevTools → Application → Local Storage
            apaga as chaves que começam por <code style={{ fontFamily: 'monospace' }}>vc_</code> e recarrega.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

function BootScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="A carregar"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        background: '#090a0f',
        color: '#bbb9c7',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 14,
      }}
    >
      <style>{GLOBAL_STYLE}</style>
      <img
        src="/moont-mark.svg"
        alt=""
        width={56}
        height={56}
        decoding="async"
        style={{
          display: 'block',
          width: 56,
          height: 56,
          borderRadius: 14,
          objectFit: 'contain',
          boxShadow: '0 0 28px rgba(91, 83, 232, 0.28)',
        }}
      />
      <div
        aria-hidden
        style={{
          width: 120,
          height: 3,
          borderRadius: 99,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: '40%',
            height: '100%',
            borderRadius: 99,
            background: 'rgba(91, 83, 232, 0.92)',
            animation: 'vc-boot-bar 1.1s ease-in-out infinite',
          }}
        />
      </div>
      <style>{`@keyframes vc-boot-bar { 0% { transform: translateX(-120%); } 100% { transform: translateX(320%); } }`}</style>
      <span style={{ letterSpacing: '-0.011em' }}>A carregar…</span>
    </div>
  );
}

// Landing first paint sem o monólito do studio; quem já passou pela intro
// vai direto ao editor principal.
const App = lazy(() => (
  window.location.pathname === '/redefinir-senha'
    ? import('./PasswordRecoveryPage.jsx')
    : shouldShowOnboardingLanding()
    ? import('./LandingFirst.jsx')
    : import('../ViralCarrossel.jsx')
));

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('index.html sem #root');
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <Suspense fallback={<BootScreen />}>
        <App />
      </Suspense>
    </RootErrorBoundary>
  </React.StrictMode>,
);
