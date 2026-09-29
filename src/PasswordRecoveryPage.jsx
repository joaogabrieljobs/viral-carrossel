import React, { useState } from 'react';
import { GLOBAL_STYLE } from './styles/global-style.js';
import PasswordField from './components/PasswordField.jsx';
import LoginModal from './components/LoginModal.jsx';
import { requestPasswordReset, submitPasswordReset } from './lib/password-recovery.js';

// Consumido antes de montar React: StrictMode não deve apagar o token do segundo render.
const incomingToken = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);

export default function PasswordRecoveryPage() {
  const [token, setToken] = useState(incomingToken);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [notice, setNotice] = useState('');
  const [done, setDone] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  async function submit(event) {
    event.preventDefault(); setError('');
    if (token && password !== confirmation) { setError('As senhas não coincidem.'); return; }
    setLoading(true);
    try {
      if (token) {
        await submitPasswordReset(token, password, confirmation);
        setToken(''); setPassword(''); setConfirmation(''); setDone(true);
      } else {
        const response = await requestPasswordReset(email);
        setNotice(response.message);
      }
    } catch (e) {
      setError(e.message);
      setInvalid(e.code === 'invalid_reset_link');
    } finally { setLoading(false); }
  }

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 20, background: '#0e0c14' }}>
      <style>{GLOBAL_STYLE}</style>
      <section style={{ width: 'min(420px, 100%)', padding: 24, borderRadius: 24, background: '#211d2b', border: '1px solid #514a5d', display: 'grid', gap: 18 }}>
        <p style={{ margin: 0, fontSize: 13, color: '#ff87bb' }}>VIRAL CARROSSEL STUDIO</p>
        <h1 style={{ margin: 0, fontSize: 25 }}>{done ? 'Senha alterada' : token ? 'Defina sua nova senha' : 'Recuperar minha senha'}</h1>
        <p style={{ margin: 0, fontSize: 14, color: '#d3cedb', lineHeight: 1.5 }}>
          {done ? 'Tudo pronto. Entre com sua nova senha para continuar. As sessões anteriores foram encerradas.'
            : token ? 'Use de 8 a 128 caracteres e confirme a senha abaixo.' : 'Informe o e-mail da sua conta para receber um novo link.'}
        </p>
        {error && <p role="alert" style={{ margin: 0, color: '#ff96ad', fontSize: 14 }}>{error}</p>}
        {notice && <p role="status" style={{ margin: 0, color: '#a4e8c0', fontSize: 14 }}>{notice}</p>}
        {!done && !invalid && !notice && <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
          {token ? <>
            <PasswordField label="Nova senha" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" disabled={loading} />
            <PasswordField label="Confirmar nova senha" value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="new-password" disabled={loading} />
          </> : <label style={{ display: 'grid', gap: 8 }}>E-mail
            <input className="vc-input" type="email" autoComplete="email" required maxLength={254} disabled={loading} value={email} onChange={e => setEmail(e.target.value)} />
          </label>}
          <button className="vc-btn" disabled={loading} type="submit" style={{ minHeight: 46, background: '#ff2d8d', color: '#150910', fontWeight: 700 }}>
            {loading ? 'Aguarde…' : token ? 'Salvar nova senha' : 'Enviar link de recuperação'}
          </button>
        </form>}
        {invalid && <button className="vc-btn" type="button" onClick={() => { setToken(''); setInvalid(false); setError(''); setPassword(''); setConfirmation(''); }}>Solicitar novo link</button>}
        {done ? <button className="vc-btn" type="button" onClick={() => setLoginOpen(true)}>Entrar com a nova senha</button>
          : <a href="/?landing=1" style={{ color: '#ede5f5', textAlign: 'center', fontSize: 14 }}>Voltar ao início</a>}
      </section>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </main>
  );
}
