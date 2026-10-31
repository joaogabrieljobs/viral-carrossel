import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import PasswordField from './PasswordField.jsx';
import { requestPasswordReset } from '../lib/password-recovery.js';
import GoogleSignInButton from './GoogleSignInButton.jsx';
import BrandLogo from './BrandLogo.jsx';
import { loginWithPassword, registerWithPassword } from '../lib/billing.js';
import { dismissOnboardingLanding } from '../utils/landing-gate.js';
import './LoginModal.css';

/**
 * Login / criar conta — e-mail+senha + Google opcional.
 * Entrar só com e-mail (sem senha) NÃO autentica.
 */
export default function LoginModal({
  open,
  onClose,
  initialEmail = '',
  initialMode = 'login',
  hint = '',
  onLoggedIn,
}) {
  const [mode, setMode] = useState('login'); // login | register | forgot
  const [email, setEmail] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [checkoutReady, setCheckoutReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(hint || '');

  useEffect(() => {
    if (!open) return;
    setError(hint || '');
    setEmail(initialEmail || '');
    setPassword('');
    setNotice('');
    setCheckoutReady(false);
    setMode(initialMode === 'register' ? 'register' : 'login');
  }, [open, hint, initialEmail, initialMode]);

  if (!open) return null;

  const changeMode = next => {
    setMode(next); setError(''); setNotice(''); setCheckoutReady(false); setPassword('');
  };

  const submit = async (event) => {
    event?.preventDefault?.();
    setError('');
    setLoading(true);
    try {
      if (mode === 'forgot') {
        const data = await requestPasswordReset(email);
        setNotice(data.message);
        return;
      }
      const data = mode === 'register'
        ? await registerWithPassword(email, password)
        : await loginWithPassword(email, password);

      if (data.needCheckout) {
        setEmail(data.email || email);
        setNotice(data.message || 'Conta confirmada. Escolha um plano para continuar.');
        setCheckoutReady(true);
        return;
      }
      if (data.active) {
        dismissOnboardingLanding();
        onClose?.();
        if (typeof onLoggedIn === 'function') {
          onLoggedIn(data);
          return;
        }
        // Fallback: reload no studio (app=1 salta a landing lazy).
        window.location.href = '/?app=1&billing=restored&login=password';
        return;
      }
      setError('Resposta inesperada do servidor.');
    } catch (err) {
      setError(err?.message || 'Não foi possível autenticar.');
    } finally {
      setLoading(false);
    }
  };

  const heading = mode === 'forgot' ? 'Recupere seu acesso' : mode === 'register' ? 'Crie sua conta' : 'Entre no Moont';
  const intro = mode === 'forgot'
    ? 'Informe o e-mail da conta. Enviaremos um link seguro para definir uma nova senha.'
    : mode === 'register'
      ? 'Crie, organize e aprimore seus conteúdos em um só lugar.'
      : 'Continue de onde parou e acesse seus projetos, marcas e apresentações.';

  return (
    <div className="moont-auth" role="presentation" onClick={onClose}>
      <div className="moont-auth__brand" aria-label="Moont">
        <BrandLogo height={31} alt="Moont" />
      </div>
      <a className="moont-auth__help" href="mailto:contato@moont.ai">Precisa de ajuda?</a>
      <span className="moont-auth__legal">© 2026 Moont · Elevessy</span>

      <main className="moont-auth__panel" role="dialog" aria-modal="true"
        aria-label={mode === 'forgot' ? 'Esqueci minha senha' : mode === 'register' ? 'Criar conta' : 'Entrar no studio'}
        onClick={(event) => event.stopPropagation()}>
        <div className="moont-auth__top">
          <button type="button" onClick={onClose} className="moont-auth__close" aria-label="Fechar"><X size={17} /></button>
        </div>

        {mode !== 'forgot' && <div className="moont-auth__tabs" role="group" aria-label="Acesso à conta">
          {[{ id: 'register', label: 'Criar conta' }, { id: 'login', label: 'Entrar' }].map((tab) => (
            <button key={tab.id} type="button" aria-pressed={mode === tab.id}
              disabled={loading} onClick={() => changeMode(tab.id)}
              className={`moont-auth__tab ${mode === tab.id ? 'is-active' : ''}`}>{tab.label}</button>
          ))}
        </div>}

        <p className="moont-auth__eyebrow">{mode === 'forgot' ? 'Recuperar acesso' : 'Sua criação continua aqui'}</p>
        <h2 id="login-title">{heading}</h2>
        <p className="moont-auth__intro">{intro}</p>

        <div className="moont-auth__body" role="tabpanel" aria-live="polite">
          {error && <p role="alert" className="moont-auth__alert">{error}</p>}
          {notice && <p role="status" className="moont-auth__notice">{notice}</p>}
          {checkoutReady && <button type="button" className="moont-auth__submit" onClick={() => {
            dismissOnboardingLanding();
            window.location.assign('/?app=1&login=no_subscription');
          }}>Escolher plano</button>}

          {!notice && <form onSubmit={submit} className="moont-auth__form">
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="vc-label">E-mail</span>
              <input type="email" required disabled={loading} maxLength={254} autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com"
                className="vc-input" />
            </label>
            {mode !== 'forgot' && <PasswordField key={mode} value={password} onChange={e => setPassword(e.target.value)}
              disabled={loading} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />}
            {mode === 'login' && <button type="button" disabled={loading} onClick={() => changeMode('forgot')}
              className="moont-auth__forgot">Esqueci minha senha</button>}
            <button type="submit" disabled={loading} className="moont-auth__submit"
              aria-label={mode === 'forgot' ? 'Enviar link de recuperação' : mode === 'register' ? 'Criar conta' : 'Entrar'}>
              {loading && <Loader2 size={16} className="spin" />}
              {mode === 'forgot' ? 'Enviar link de recuperação' : mode === 'register' ? 'Criar minha conta' : 'Entrar no Moont'}
            </button>
          </form>}

          {mode === 'forgot' && <button type="button" disabled={loading} onClick={() => changeMode('login')}
            className="moont-auth__submit">Voltar para entrar</button>}

          {mode !== 'forgot' && <>
            <div className="moont-auth__divider">ou continue com</div>
            <GoogleSignInButton fullWidth label="Continuar com Google" />
            <p className="moont-auth__terms">
              Ao continuar, você aceita os <a href="/termos">Termos de Uso</a> e reconhece nossa <a href="/privacidade">Política de Privacidade</a>.
            </p>
          </>}
        </div>
      </main>
    </div>
  );
}
