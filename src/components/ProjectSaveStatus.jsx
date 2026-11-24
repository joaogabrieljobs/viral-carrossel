import React, { useEffect, useState } from 'react';
import { Check, CloudUpload, Loader2, Smartphone } from 'lucide-react';

/**
 * `deviceOnly`: plano grátis. O projeto vive só neste aparelho, então não há
 * envio à conta pendente nem botão de tentar de novo — só a hora da gravação
 * local e, se o chamador quiser, um caminho para guardar na conta (assinatura).
 */
export function ProjectSaveStatus({ localSavedAt, cloudSavedAt, busy, error, onRetry, deviceOnly = false, onUpgrade }) {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  if (deviceOnly) {
    const hora = localSavedAt ? new Date(localSavedAt).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }) : '';
    // UX-11: no topo do celular sobram uns 130 px. O aviso fica em uma linha
    // (versão curta abaixo de 768 px, em global-style.js) e o botão desce
    // inteiro para a linha de baixo em vez de ser cortado.
    return (
      <span data-vc-save-device-only className="vc-save-device-only">
        <span className="vc-save-device-only-text">
          <Smartphone size={13} aria-hidden style={{ flexShrink:0 }} />
          <span role="status">
            <span className="vc-save-device-only-long">{hora ? `Salvo só neste aparelho às ${hora}` : 'Salvo só neste aparelho'}</span>
            <span className="vc-save-device-only-short">Só neste aparelho</span>
          </span>
        </span>
        {onUpgrade && <button type="button" className="vc-btn vc-btn-ghost" style={{ minHeight:44, padding:'0 8px', fontSize:11, flexShrink:0, whiteSpace:'nowrap' }} onClick={onUpgrade} aria-label="Guardar na conta: ver planos">Guardar na conta</button>}
      </span>
    );
  }
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
