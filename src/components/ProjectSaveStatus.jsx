import React, { useEffect, useState } from 'react';
import { Check, CloudUpload, Loader2 } from 'lucide-react';

export function ProjectSaveStatus({ localSavedAt, cloudSavedAt, busy, error, onRetry }) {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  const confirmed = cloudSavedAt && !error;
  const label = busy ? 'Salvando na conta…'
    : confirmed ? `Salvo na conta às ${new Date(cloudSavedAt).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}`
      : !online ? 'Sem conexão · sincronização pendente'
        : error ? 'Sincronização pendente'
          : localSavedAt ? 'Salvo no aparelho · pendente na conta' : 'Aguardando salvamento';
  const Icon = busy ? Loader2 : confirmed ? Check : CloudUpload;
  return (
    // Não encolhe: ao lado de um nome de projeto longo, este aviso cedia
    // largura até o texto quebrar em quatro linhas e o botão sair da tela no
    // celular. Quem cede é o nome, que já corta com reticências.
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, lineHeight:1.35, color:'var(--text-secondary)', maxWidth:'min(210px, 56vw)', flexShrink:0 }}>
      <Icon size={13} aria-hidden style={{ flexShrink:0 }} />
      <span role="status" style={{ minWidth:0 }}>{label}</span>
      {!busy && !confirmed && onRetry && <button type="button" className="vc-btn vc-btn-ghost" style={{ minHeight:32, padding:'0 6px', fontSize:11, flexShrink:0, whiteSpace:'nowrap' }} onClick={onRetry} aria-label="Tentar salvar na conta">Salvar</button>}
    </span>
  );
}
