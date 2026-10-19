import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { shouldShowOnboardingLanding } from './utils/landing-gate.js';
import BootScreen from './components/BootScreen.jsx';

const CHUNK_RELOAD_KEY = 'vc_chunk_reload';

function isStaleChunkError(err) {
  const msg = String(err?.message || err || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|dynamically imported module/i.test(msg);
}

function reloadPage() {
  window.location.reload();
}

/** Limpa o aviso de recarga só depois que a versão nova ficou de pé. */
function ChunkBootMarker() {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      try { sessionStorage.removeItem(CHUNK_RELOAD_KEY); } catch { /* sessão privada */ }
    }, 8000);
    return () => clearTimeout(timer);
  }, []);
  return null;
}

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
    if (!isStaleChunkError(err)) return;
    try {
      if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return;
      sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
    } catch {
      return;
    }
    reloadPage();
  }

  render() {
    const { err } = this.state;
    if (err) {
      const msg = err?.message || String(err);
      const stale = isStaleChunkError(err);
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
            {stale ? 'A Moont atualizou' : 'Erro ao carregar a Moont'}
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
            {stale
              ? 'Recarregue a página para abrir a versão nova. Projetos e marcas continuam neste navegador.'
              : 'Recarregue a página. Projetos e marcas continuam salvos neste navegador.'}
          </p>
          <button
            type="button"
            onClick={reloadPage}
            style={{
              marginTop: 16,
              height: 40,
              padding: '0 18px',
              borderRadius: 999,
              border: 0,
              background: '#fff',
              color: '#111',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Recarregar
          </button>
        </div>
      );
    }
    return (
      <>
        <ChunkBootMarker />
        {this.props.children}
      </>
    );
  }
}

// Landing first paint sem o monólito do studio; quem já passou pela intro
// vai direto ao editor principal.
const path = window.location.pathname.replace(/\/+$/, '') || '/';
const App = lazy(() => (
  path === '/redefinir-senha'
    ? import('./PasswordRecoveryPage.jsx')
    : path === '/privacidade' || path === '/termos'
    ? import('./LegalPage.jsx')
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
