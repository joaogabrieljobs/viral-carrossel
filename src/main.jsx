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
    console.error('[Viral Carrossel]', err, info?.componentStack);
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
          color: '#1d1d1f',
        }}>
          <h1 style={{ fontSize: 17, fontWeight: 600, marginBottom: 12 }}>
            Erro ao carregar o Viral Carrossel
          </h1>
          <pre style={{
            whiteSpace: 'pre-wrap',
            background: '#f5f5f7',
            padding: 16,
            borderRadius: 11,
            fontSize: 13,
            border: '1px solid #e0e0e0',
          }}>{msg}</pre>
          <p style={{ fontSize: 15, color: '#333', marginTop: 16 }}>
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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0e0c14',
      color: '#8a8696',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 14,
    }}>
      <style>{GLOBAL_STYLE}</style>
      A carregar…
    </div>
  );
}

// Landing first paint sem o monólito do studio; quem já passou pela intro
// vai direto ao ViralCarrossel.
const App = lazy(() => (
  shouldShowOnboardingLanding()
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
