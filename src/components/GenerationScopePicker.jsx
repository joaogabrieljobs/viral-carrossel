import React, { useId } from 'react';

export function GenerationScopePicker({ value, onChange, disabled = false, hasImages = false, remix = false }) {
  const name = useId();
  return (
    <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <legend style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>O que você quer gerar?</legend>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[['text', 'Só texto'], ['text_images', 'Texto e imagens']].map(([id, label]) => (
          <label key={id} style={{ padding: 12, minHeight: 44, borderRadius: 10, border: `1px solid ${value === id ? 'var(--accent)' : 'var(--glass-border-strong)'}`, background: value === id ? 'var(--accent-surface)' : 'var(--bg-card)', fontSize: 12, cursor: disabled || (id === 'text_images' && !hasImages) ? 'not-allowed' : 'pointer' }}>
            <input type="radio" name={name} value={id} checked={value === id} disabled={id === 'text_images' && !hasImages} onChange={() => onChange(id)} style={{ accentColor: 'var(--accent)', marginRight: 6 }} />
            {label}
          </label>
        ))}
      </div>
      <p style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--text-muted)', margin: '8px 0 0' }}>
        {value === 'text' ? (remix ? 'Mantém as imagens, fontes, cores e composição atuais.' : 'Gera os textos. Você pode adicionar imagens depois.') : 'Gera novas imagens com o estilo e as referências do projeto. Usa créditos de imagem.'}
        {!hasImages && ' Para gerar imagens, é necessário saldo no plano ou uma chave própria configurada.'}
      </p>
    </fieldset>
  );
}
