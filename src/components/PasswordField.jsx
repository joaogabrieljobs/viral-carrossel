import React, { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function PasswordField({ label = 'Senha', value, onChange, autoComplete = 'current-password', disabled = false }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <label className="vc-label" htmlFor={id}>{label}</label>
        <button type="button" disabled={disabled} aria-controls={id} aria-pressed={visible}
          aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`}
          onClick={() => setVisible(v => !v)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '4px 10px', border: '1px solid #66616e', borderRadius: 8, background: '#211d2b', color: '#fff', cursor: 'pointer', fontSize: 12 }}>
          {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      <input id={id} type={visible ? 'text' : 'password'} value={value} onChange={onChange}
        required minLength={8} maxLength={128} autoComplete={autoComplete} disabled={disabled}
        placeholder={autoComplete === 'new-password' ? 'Mínimo de 8 caracteres' : 'Sua senha'}
        className="vc-input" style={{ height: 44, borderRadius: 9999, padding: '0 16px', width: '100%' }} />
    </div>
  );
}
