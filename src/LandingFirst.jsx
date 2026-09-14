import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { GLOBAL_STYLE } from './styles/global-style.js';
import { dismissOnboardingLanding } from './utils/landing-gate.js';
import BrandLogo from './components/BrandLogo.jsx';

const OnboardingLanding = lazy(() => import('./components/OnboardingLanding.jsx'));
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

function BootScreen({ label = 'A carregar…' }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      background: '#0e0c14',
      color: '#8a8696',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 14,
    }}>
      <style>{GLOBAL_STYLE}</style>
      <BrandLogo height={28} />
      <span>{label}</span>
    </div>
  );
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
    setPhase('studio');
  }, []);

  if (phase === 'studio') {
    return (
      <Suspense fallback={<BootScreen label="A abrir o studio…" />}>
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
        />
      </Suspense>
    </div>
  );
}
