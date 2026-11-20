import React, { lazy, Suspense, useEffect, useState } from 'react';
import { GLOBAL_STYLE } from '../styles/global-style.js';
import { adminMe } from '../lib/admin-client.js';

// O console só é baixado depois que o servidor confirma o papel.
const AdminConsole = lazy(() => import('./AdminConsole.jsx'));

const shell = { minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' };

export default function AdminEntry() {
  const [state, setState] = useState({ status: 'loading', me: null });
  useEffect(() => {
    document.title = 'Moont';
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.appendChild(robots);
    adminMe()
      .then((me) => setState({ status: 'ok', me }))
      .catch((error) => setState({ status: error.status === 404 ? 'hidden' : 'error', me: null, message: error.message }));
    return () => robots.remove();
  }, []);

  return (
    <div style={shell}>
      <style>{GLOBAL_STYLE}</style>
      {state.status === 'loading' && <p role="status" style={{ padding: 32, margin: 0, color: 'var(--text-muted)' }}>Carregando…</p>}
      {state.status === 'hidden' && (
        <main style={{ padding: '72px 24px', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, margin: '0 0 12px' }}>Página não encontrada</h1>
          <p style={{ color: 'var(--text-muted)', margin: '0 0 24px' }}>Esta página não existe.</p>
          <a href="/" className="vc-btn vc-btn-ghost" style={{ display: 'inline-flex', minHeight: 44, alignItems: 'center', textDecoration: 'none' }}>Voltar ao Moont</a>
        </main>
      )}
      {state.status === 'error' && <p role="alert" style={{ padding: 32, margin: 0 }}>{state.message}</p>}
      {state.status === 'ok' && (
        <Suspense fallback={<p role="status" style={{ padding: 32, margin: 0, color: 'var(--text-muted)' }}>Carregando…</p>}>
          <AdminConsole me={state.me} />
        </Suspense>
      )}
    </div>
  );
}
