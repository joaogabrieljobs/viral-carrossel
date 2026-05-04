import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../ViralCarrossel.jsx';

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

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('index.html sem #root');
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>,
);
