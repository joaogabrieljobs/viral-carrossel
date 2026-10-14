import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { GLOBAL_STYLE } from './styles/global-style.js';
import { dismissOnboardingLanding } from './utils/landing-gate.js';
import { fetchAccessSession } from './lib/billing.js';
import BootScreen from './components/BootScreen.jsx';

const OnboardingLanding = lazy(() => import('./components/OnboardingLandingProduct.jsx'));
const LoginModal = lazy(() => import('./components/LoginModal.jsx'));
const StudioApp = lazy(() => import('../ViralCarrossel.jsx'));

function useIsMobile() {
  const [mobile, setMobile] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  ));
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mobile;
}

/**
 * Primeira visita: carrega só a landing (+ LoginModal).
 * Ao entrar no studio, faz dynamic import do monólito ViralCarrossel —
 * evita puxar GSAP + editor no first paint.
 */
export default function LandingFirst() {
  const [phase, setPhase] = useState('landing');
  const [loginOpen, setLoginOpen] = useState(false);
  const isMobile = useIsMobile();

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
        <OnboardingLanding
          onEnter={enterStudio}
          onLogin={() => setLoginOpen(true)}
          isMobile={isMobile}
        />
        <LoginModal
          open={loginOpen}
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
