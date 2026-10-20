import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { GLOBAL_STYLE } from './styles/global-style.js';
import { dismissOnboardingLanding } from './utils/landing-gate.js';
import { fetchAccessSession } from './lib/billing.js';
import BootScreen from './components/BootScreen.jsx';

const OnboardingLandingProduct = lazy(() => import('./components/OnboardingLandingProduct.jsx'));
const LoginModal = lazy(() => import('./components/LoginModal.jsx'));
const StudioApp = lazy(() => import('../ViralCarrossel.jsx'));

export default function LandingFirst() {
  const [phase, setPhase] = useState('landing');
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginMode, setLoginMode] = useState('login');

  const enterStudio = useCallback(() => {
    dismissOnboardingLanding();
    // O preview forçado não pode reabrir a landing ao montar o editor.
    const url = new URL(window.location.href);
    for (const key of ['landing', 'intro', 'welcome']) url.searchParams.delete(key);
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    setPhase('studio');
  }, []);

  // Se já autenticado (cookie) ou URL de retorno de login → abrir studio.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const q = new URLSearchParams(window.location.search);
        const fromAuth = q.get('billing') === 'restored'
          || q.get('billing') === 'success'
          || q.get('login') === 'password'
          || q.get('login') === 'google'
          || q.get('app') === '1'
          || q.get('studio') === '1';
        const session = await fetchAccessSession();
        if (cancelled) return;
        if (session.active && fromAuth) {
          enterStudio();
        }
      } catch { /* landing continua */ }
    })();
    return () => { cancelled = true; };
  }, [enterStudio]);

  if (phase === 'studio') {
    return (
      <Suspense fallback={<BootScreen label="Abrindo seu studio…" />}>
        <StudioApp />
      </Suspense>
    );
  }

  return (
    <div
      className="vc-landing-shell"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        background: 'var(--bg-primary, #0e0c14)',
      }}
    >
      <style>{GLOBAL_STYLE}</style>
      <Suspense fallback={<BootScreen />}>
        <OnboardingLandingProduct
          onEnter={enterStudio}
          onLogin={() => { setLoginMode('login'); setLoginOpen(true); }}
          onRegister={() => { setLoginMode('register'); setLoginOpen(true); }}
        />
        <LoginModal
          open={loginOpen}
          initialMode={loginMode}
          onClose={() => setLoginOpen(false)}
          onLoggedIn={() => {
            setLoginOpen(false);
            enterStudio();
          }}
        />
      </Suspense>
    </div>
  );
}
