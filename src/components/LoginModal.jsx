import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import PasswordField from './PasswordField.jsx';
import { requestPasswordReset } from '../lib/password-recovery.js';
import GoogleSignInButton from './GoogleSignInButton.jsx';
import { loginWithPassword, registerWithPassword } from '../lib/billing.js';
import { dismissOnboardingLanding } from '../utils/landing-gate.js';

/**
 * Login / criar conta — e-mail+senha + Google opcional.
 * Entrar só com e-mail (sem senha) NÃO autentica.
 */
export default function LoginModal({
  open,
  onClose,
  initialEmail = '',
  hint = '',
  onLoggedIn,
}) {
  const [mode, setMode] = useState('login'); // login | register | forgot
  const [email, setEmail] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(hint || '');

  useEffect(() => {
    if (!open) return;
    setError(hint || '');
    setEmail(initialEmail || '');
    setPassword('');
    setNotice('');
    setMode('login');
  }, [open, hint, initialEmail]);

  if (!open) return null;

  const changeMode = next => {
    setMode(next); setError(''); setNotice(''); setPassword('');
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
        setError(data.message || 'Conta ok — escolha um plano para continuar.');
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

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="presentation"
      style={{ zIndex: 12000 }}
    >
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        onClick={(event) => event.stopPropagation()}
        style={{
          maxWidth: 420,
          width: 'min(420px, calc(100vw - 24px))',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        <header style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          padding: '20px 20px 0',
        }}>
          <div>
            <p className="vc-eyebrow" style={{ margin: '0 0 6px' }}>
              {mode === 'forgot' ? 'Recuperar acesso' : mode === 'register' ? 'Nova conta' : 'Já tem conta'}
            </p>
            <h2 id="login-title" style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: '-0.022em',
              lineHeight: 1.2,
            }}>
              {mode === 'forgot' ? 'Esqueci minha senha' : mode === 'register' ? 'Criar conta' : 'Entrar no studio'}
            </h2>
            <p style={{
              margin: '8px 0 0',
              fontSize: 13,
              lineHeight: 1.45,
              color: 'var(--text-muted)',
            }}>
              {mode === 'forgot' ? 'Informe o e-mail da sua conta para receber o link de recuperação.' : mode === 'register'
                ? 'Cria com e-mail e senha. Se já assinou com este e-mail, entra directo.'
                : 'Usa o e-mail da assinatura + senha, ou Google.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="vc-icon-btn" aria-label="Fechar">
            <X size={17} />
          </button>
        </header>

        <div style={{ padding: 20, display: 'grid', gap: 14 }}>
          {mode !== 'forgot' && <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 6,
            padding: 4,
            borderRadius: 12,
            background: 'var(--bg-pearl, #f1f1f1)',
          }}>
            {[
              { id: 'login', label: 'Entrar' },
              { id: 'register', label: 'Criar conta' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                disabled={loading}
                onClick={() => changeMode(tab.id)}
                style={{
                  height: 36,
                  borderRadius: 10,
                  border: 'none',
                  background: mode === tab.id ? 'var(--bg-base, #fff)' : 'transparent',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  boxShadow: mode === tab.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>}

          {error && (
            <p role="alert" style={{ margin: 0, fontSize: 12, color: '#ff6b8a', lineHeight: 1.4 }}>{error}</p>
          )}
          {notice && <p role="status" style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: '#a4e8c0' }}>{notice}</p>}

          {!notice && <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span className="vc-label">E-mail</span>
              <input
                type="email"
                required
                disabled={loading}
                maxLength={254}
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com"
                className="vc-input"
                style={{ height: 44, borderRadius: 9999, padding: '0 16px' }}
              />
            </label>

            {mode !== 'forgot' && <PasswordField key={mode} value={password} onChange={e => setPassword(e.target.value)}
              disabled={loading} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />}
            {mode === 'login' && <button type="button" disabled={loading} onClick={() => changeMode('forgot')}
              style={{ justifySelf: 'end', background: 'transparent', border: 0, padding: '6px 0', color: '#ff87bb', textDecoration: 'underline', fontSize: 13, cursor: 'pointer' }}>
              Esqueci minha senha
            </button>}

            <button
              type="submit"
              disabled={loading}
              className="vc-btn"
              style={{
                height: 48,
                borderRadius: 9999,
                border: 'none',
                background: '#000',
                color: '#fff',
                fontWeight: 600,
                fontSize: 15,
                cursor: loading ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {loading && <Loader2 size={16} className="spin" />}
              {mode === 'forgot' ? 'Enviar link de recuperação' : mode === 'register' ? 'Criar conta' : 'Entrar'}
            </button>
          </form>}

          {mode === 'forgot' && <button type="button" disabled={loading} onClick={() => changeMode('login')}
            className="vc-btn" style={{ minHeight: 44 }}>Voltar para entrar</button>}

          {mode !== 'forgot' && <><div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: 10,
          }}>
            <span style={{ height: 1, background: 'var(--hairline, #e6e6e6)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>ou</span>
            <span style={{ height: 1, background: 'var(--hairline, #e6e6e6)' }} />
          </div>

          <GoogleSignInButton fullWidth label="Continuar com Google" />

          <p style={{
            margin: 0,
            fontSize: 11,
            lineHeight: 1.45,
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}>
            Novo e ainda sem plano? Cria a conta e depois escolhe o plano em{' '}
            <strong style={{ color: 'var(--text-secondary)' }}>Começar agora</strong>.
          </p>
          </>}
        </div>
      </div>
    </div>
  );
}
