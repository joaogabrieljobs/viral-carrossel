import React from 'react';
import { FileCheck } from 'lucide-react';

/** Client delivery stays separate from the editing invitation. No automatic send. */
export function ApprovalPanel({ review = {}, onChange, onExportPDF, exporting, onStatus, toast }) {
  return (
    <section aria-label="Aprovação do cliente" style={{ display:'grid', gap:10 }}>
      <p style={{ margin:0, fontSize:12, color:'var(--text-secondary)', lineHeight:1.5 }}>
        Baixe o PDF para enviar ao cliente. Ele pode revisar sem acesso de edição. Registre aqui o retorno recebido.
      </p>
      <button type="button" className="vc-btn vc-btn-primary" disabled={exporting} onClick={async () => {
        const ok = await onExportPDF();
        if (ok === true) toast?.('PDF pronto para enviar ao cliente. Marque “Em aprovação” depois do envio.', 'success', 5000);
      }}><FileCheck size={15} />Preparar PDF para aprovação</button>
      <label className="vc-label">Situação da aprovação
        <select className="vc-input" value={review.status || 'draft'} onChange={e => {
          onChange({ ...review, status:e.target.value, updatedAt:Date.now() });
          onStatus?.(e.target.value);
        }}>
          <option value="draft">Ainda não enviado</option>
          <option value="in_review">Em aprovação</option>
          <option value="changes_requested">Ajustes solicitados</option>
          <option value="approved">Aprovado</option>
        </select>
      </label>
      <label className="vc-label">Retorno do cliente
        <textarea className="vc-input vc-textarea" rows={3} value={review.feedback || ''} placeholder="Registre os comentários recebidos…" onChange={e => onChange({ ...review, feedback:e.target.value })} />
      </label>
    </section>
  );
}
