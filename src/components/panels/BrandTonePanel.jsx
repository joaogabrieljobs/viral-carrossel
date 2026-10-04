import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, FileImage, Fingerprint, Link2, Loader2, Sparkles, Trash2, X } from 'lucide-react';
import { brandToneIsReady, normalizeBrandTone, buildBrandToneMethod } from '../../utils/brand-tone.js';
import {
  collectSocialToneEvidence,
  normalizeSocialUrls,
  socialEvidenceHasContent,
} from '../../utils/social-tone.js';
import {
  CAROUSEL_OCR_MAX_IMAGES,
  extractCarouselImageEvidence,
  normalizeCarouselImageEvidence,
} from '../../utils/carousel-ocr.js';
import { getAIGenerationCount, startAIJob } from '../../utils/generation-control.js';

/**
 * Home → analisar tom de voz e gravar perfil.
 * O tom acompanha TODOS os modos narrativos (preferência «Falar como minha marca»).
 * Análise devolve rascunho — só grava após confirmar.
 */
export function BrandTonePanel({
  brand,
  setBrand,
  onAnalyze,
  analyzing = false,
  hasTextAI,
  hasOpenAI = false,
  onNeedKeys,
  toast,
  projectId = null,
}) {
  const tone = normalizeBrandTone(brand?.brandTone);
  const ready = brandToneIsReady(brand);
  const [openEdit, setOpenEdit] = useState(false);
  const [draft, setDraft] = useState(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [collectingSources, setCollectingSources] = useState(false);
  const [sourceFeedback, setSourceFeedback] = useState('');
  const [socialLinks, setSocialLinks] = useState(() => (
    Array.isArray(brand?.voiceSourceUrls) ? brand.voiceSourceUrls.join('\n') : ''
  ));
  const [socialSamples, setSocialSamples] = useState(() => String(brand?.voiceSampleText || ''));
  const [imageEvidence, setImageEvidence] = useState(() => (
    normalizeCarouselImageEvidence(brand?.voiceImageTexts)
  ));
  const [readingImages, setReadingImages] = useState(false);
  const [imageProgress, setImageProgress] = useState('');
  const imageInputRef = useRef(null);
  const operationRef = useRef({ version: 0, job: null });
  const projectRef = useRef(projectId);
  projectRef.current = projectId;
  const sourcePanelId = useId();
  const canAnalyzeText = hasTextAI ?? hasOpenAI;
  const busy = analyzing || collectingSources || readingImages;
  const persistSourceDraft = () => {
    setBrand?.((current) => ({
      ...(current || {}),
      voiceSourceUrls: normalizeSocialUrls(socialLinks),
      voiceSampleText: String(socialSamples || '').trim().slice(0, 18_000),
      voiceImageTexts: imageEvidence,
    }));
  };

  useEffect(() => {
    operationRef.current.job?.cancel?.();
    operationRef.current = { version: operationRef.current.version + 1, job: null };
    setCollectingSources(false);
    setReadingImages(false);
    setImageProgress('');
    setSourceFeedback('');
    setDraft(null);
    // Rascunhos locais também pertencem ao projeto. Mesmo quando A e B têm os
    // campos persistidos vazios, a troca precisa limpar texto ainda não salvo.
    setSocialLinks(Array.isArray(brand?.voiceSourceUrls) ? brand.voiceSourceUrls.join('\n') : '');
    setSocialSamples(String(brand?.voiceSampleText || ''));
    setImageEvidence(normalizeCarouselImageEvidence(brand?.voiceImageTexts));
    return () => operationRef.current.job?.cancel?.();
    // `brand` é intencionalmente lido no momento da troca; alterações no mesmo
    // projeto são sincronizadas pelo efeito específico abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, brand?.id]);

  const beginOperation = () => {
    operationRef.current.job?.cancel?.();
    const job = startAIJob();
    const operation = {
      version: operationRef.current.version + 1,
      job,
      projectId: projectRef.current,
    };
    operationRef.current = operation;
    return operation;
  };

  const operationIsCurrent = (operation) => (
    operationRef.current.version === operation.version
    && projectRef.current === operation.projectId
    && !operation.job.signal.aborted
  );
  const operationOwnsSlot = (operation) => (
    operationRef.current.version === operation.version
    && projectRef.current === operation.projectId
  );

  const readCarouselImages = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length || readingImages) return;
    if (getAIGenerationCount() > 0) {
      toast?.('Há outra operação de IA em andamento. Conclua ou cancele antes de ler as imagens.', 'info', 4800);
      return;
    }
    const remainingSlots = Math.max(0, CAROUSEL_OCR_MAX_IMAGES - imageEvidence.length);
    if (!remainingSlots) {
      toast?.(`Você já adicionou ${CAROUSEL_OCR_MAX_IMAGES} imagens. Remova uma para trocar.`, 'info', 4200);
      return;
    }
    const selected = files.slice(0, remainingSlots);
    if (files.length > selected.length) {
      toast?.(`Vou ler ${selected.length} imagem${selected.length === 1 ? '' : 'ns'} para respeitar o limite de ${CAROUSEL_OCR_MAX_IMAGES}.`, 'info', 4800);
    }
    setReadingImages(true);
    setImageProgress('Preparando imagens…');
    const operation = beginOperation();
    try {
      const result = await extractCarouselImageEvidence(selected, {
        onProgress: ({ current, total, name }) => setImageProgress(`Lendo ${current} de ${total}: ${name}`),
        signal: operation.job.signal,
      });
      if (!operationIsCurrent(operation)) return;
      const next = normalizeCarouselImageEvidence([...imageEvidence, ...result.evidence]);
      setImageEvidence(next);
      setBrand?.((current) => ({ ...(current || {}), voiceImageTexts: next }));
      if (result.evidence.length) {
        toast?.(`${result.evidence.length} imagem${result.evidence.length === 1 ? '' : 'ns'} lida${result.evidence.length === 1 ? '' : 's'}. O texto entrou na análise do DNA.`, 'success', 4200);
      }
      if (result.failures.length) {
        const firstReason = result.failures[0]?.error || 'Não foi possível ler o arquivo.';
        toast?.(
          `${result.failures.length} imagem${result.failures.length === 1 ? '' : 'ns'} não ${result.failures.length === 1 ? 'foi lida' : 'foram lidas'}. ${firstReason}`,
          'error',
          6200,
        );
      }
    } catch (error) {
      if (error?.name !== 'AbortError') toast?.(error?.message || 'Não foi possível ler as imagens.', 'error', 6000);
    } finally {
      if (operationOwnsSlot(operation)) {
        setReadingImages(false);
        setImageProgress('');
        operation.job.finish?.();
        operationRef.current.job = null;
      }
    }
  };

  const patchTone = (partial) => {
    const cur = normalizeBrandTone(brand?.brandTone) || {
      summary: '', traits: [], do: '', dont: '', ctaStyle: '', samplePhrases: [], method: '',
    };
    const merged = { ...cur, ...partial };
    const next = normalizeBrandTone({
      ...merged,
      method: buildBrandToneMethod(merged),
    });
    setBrand?.((current) => ({
      ...(current || {}),
      brandTone: next,
      useBrandVoice: current?.useBrandVoice !== false,
      ...(partial.summary != null ? { defaultTone: partial.summary } : {}),
    }));
  };

  const clearTone = () => {
    setBrand?.((current) => ({
      ...(current || {}),
      brandTone: null,
      defaultTone: '',
      useBrandVoice: false,
    }));
    setDraft(null);
  };

  const runAnalyze = async (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (busy) return;
    if (getAIGenerationCount() > 0) {
      toast?.('Há outra operação de IA em andamento. Conclua ou cancele antes de analisar o tom.', 'info', 4800);
      return;
    }
    if (!canAnalyzeText) {
      toast?.('A análise de tom precisa da IA de texto. Entre na sua conta ou configure um provedor de texto.', 'info', 5200);
      onNeedKeys?.();
      return;
    }
    if (typeof onAnalyze !== 'function') {
      toast?.('A análise de tom não está disponível nesta tela. Reabra o projeto e tente de novo.', 'error', 5200);
      return;
    }
    if (ready && !window.confirm('Isto substitui o tom atual nas próximas gerações. Continuar?')) return;
    setSourceFeedback('');
    const operation = beginOperation();
    let socialEvidence = null;
    const hasSourceInput = Boolean(
      String(socialLinks).trim()
      || String(socialSamples).trim()
      || imageEvidence.length,
    );
    // Grava inclusive o estado vazio: apagar todas as fontes é uma edição
    // válida e não pode fazer os valores antigos reaparecerem depois.
    persistSourceDraft();
    try {
      if (hasSourceInput) {
        setCollectingSources(true);
        socialEvidence = await collectSocialToneEvidence({
          urlsText: socialLinks,
          sampleText: socialSamples,
          signal: operation.job.signal,
        });
        if (!operationIsCurrent(operation)) return;
        socialEvidence.images = imageEvidence;
        const readCount = socialEvidence.sources.length;
        const failedCount = socialEvidence.failures.length;
        setSourceFeedback(
          `${readCount} fonte${readCount === 1 ? '' : 's'} lida${readCount === 1 ? '' : 's'}`
          + (imageEvidence.length ? ` · ${imageEvidence.length} imagem${imageEvidence.length === 1 ? '' : 'ns'}` : '')
          + (failedCount ? ` · ${failedCount} bloqueada${failedCount === 1 ? '' : 's'}` : ''),
        );
        if (!socialEvidenceHasContent(socialEvidence)) {
          toast?.(
            'A rede social não liberou texto para leitura. Cole de 3 a 10 legendas publicadas e tente novamente.',
            'error',
            6500,
          );
          return;
        }
      }
      if (!operationIsCurrent(operation)) return;
      // O job pai pertence ao painel. Se ele desmontar por troca de projeto,
      // modo ou aba, o sinal também cancela a inferência iniciada no App.
      const next = await onAnalyze({ socialEvidence, signal: operation.job.signal });
      if (!operationIsCurrent(operation)) return;
      if (next) setDraft(next);
      else toast?.('A IA não devolveu um tom. Tente novamente ou cole mais exemplos de publicações.', 'error', 5200);
    } catch (error) {
      if (error?.name !== 'AbortError') {
        toast?.(error?.message || 'Não foi possível analisar as publicações.', 'error', 6200);
      }
    } finally {
      if (operationOwnsSlot(operation)) {
        setCollectingSources(false);
        operation.job.finish?.();
        operationRef.current.job = null;
      }
    }
  };

  const confirmDraft = () => {
    if (!draft) return;
    setBrand?.((current) => ({
      ...(current || {}),
      brandTone: draft,
      defaultTone: draft.summary || current?.defaultTone,
      useBrandVoice: true,
    }));
    setDraft(null);
    toast?.('Tom da marca guardado. A voz acompanha qualquer modo narrativo.', 'success', 5500);
  };

  const discardDraft = () => setDraft(null);

  const preview = draft || tone;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{
          fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
          letterSpacing: '-0.011em', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Fingerprint size={14} /> Tom de voz
        </div>
        <p style={{
          margin: '4px 0 0', fontSize: 11, lineHeight: 1.45, color: 'var(--text-muted)',
        }}>
          Analisa o brief e a identidade. A voz acompanha qualquer modo narrativo — não substitui a estrutura do carrossel.
        </p>
      </div>

      <div style={{
        border: '1px solid var(--glass-border-strong)', borderRadius: 12,
        background: 'var(--bg-card)', overflow: 'hidden',
      }}>
        <button
          type="button"
          className="vc-btn vc-btn-ghost"
          aria-expanded={sourcesOpen}
          aria-controls={sourcePanelId}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setSourcesOpen((value) => !value);
          }}
          style={{
            width: '100%', minHeight: 44, border: 0, borderRadius: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 12px', color: 'var(--text-primary)',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Link2 size={14} /> Usar publicações para extrair o DNA
          </span>
          <ChevronDown size={15} style={{ transform: sourcesOpen ? 'rotate(180deg)' : 'none', transition: 'transform .16s ease' }} />
        </button>
        {sourcesOpen ? (
          <div id={sourcePanelId} style={{
            padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 10,
            borderTop: '1px solid var(--hairline)',
          }}>
            <p id={`${sourcePanelId}-help`} style={{ margin: '10px 0 0', fontSize: 11, lineHeight: 1.5, color: 'var(--text-muted)' }}>
              Cole o perfil ou até 8 posts públicos. Algumas redes, como o Instagram, podem bloquear a leitura do perfil; para um resultado confiável, cole também de 3 a 10 legendas reais.
            </p>
            <div>
              <label className="vc-label-sm" htmlFor={`${sourcePanelId}-links`}>Links do perfil e das publicações</label>
              <textarea
                id={`${sourcePanelId}-links`}
                className="vc-input vc-textarea"
                rows={3}
                value={socialLinks}
                onChange={(event) => setSocialLinks(event.target.value)}
                onBlur={persistSourceDraft}
                aria-describedby={`${sourcePanelId}-help`}
                placeholder={'https://instagram.com/suamarca\nhttps://instagram.com/p/…'}
                style={{ minHeight: 74, resize: 'vertical', lineHeight: 1.45 }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg"
                multiple
                aria-label="Imagens de carrosséis publicados"
                aria-hidden="true"
                tabIndex={-1}
                style={{
                  position: 'fixed', left: -9999, top: 0, width: 4, height: 4,
                  opacity: 0.02, overflow: 'hidden', border: 0, pointerEvents: 'auto',
                }}
                onChange={readCarouselImages}
              />
              <button
                type="button"
                className="vc-btn vc-btn-ghost"
                disabled={readingImages || imageEvidence.length >= CAROUSEL_OCR_MAX_IMAGES}
                onClick={() => imageInputRef.current?.click()}
                style={{ width: '100%', minHeight: 42 }}
              >
                {readingImages
                  ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> {imageProgress || 'Lendo imagens…'}</>
                  : <><FileImage size={14} /> Ler texto de prints/PNGs dos carrosséis</>}
              </button>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                Até 10 imagens PNG/JPG. Elas são enviadas à Z.AI apenas para leitura; os arquivos não ficam no projeto. Só o texto extraído é salvo para reanálise.
              </div>
              {imageEvidence.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} aria-label={`${imageEvidence.length} imagens lidas`}>
                  {imageEvidence.map((item, index) => (
                    <span key={`${item.name}-${index}`} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      border: '1px solid var(--glass-border-strong)', borderRadius: 9999,
                      padding: '4px 5px 4px 8px', maxWidth: '100%', fontSize: 10.5,
                      color: 'var(--text-secondary)',
                    }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{item.name}</span>
                      <button
                        type="button"
                        className="vc-icon-btn"
                        aria-label={`Remover texto extraído de ${item.name}`}
                        onClick={() => {
                          const next = imageEvidence.filter((_, itemIndex) => itemIndex !== index);
                          setImageEvidence(next);
                          setBrand?.((current) => ({ ...(current || {}), voiceImageTexts: next }));
                        }}
                        style={{ width: 28, height: 28, minHeight: 28 }}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <div>
              <label className="vc-label-sm" htmlFor={`${sourcePanelId}-samples`}>Legendas publicadas (recomendado)</label>
              <textarea
                id={`${sourcePanelId}-samples`}
                className="vc-input vc-textarea"
                rows={5}
                maxLength={18_000}
                value={socialSamples}
                onChange={(event) => setSocialSamples(event.target.value)}
                onBlur={persistSourceDraft}
                placeholder="Cole exemplos separados por uma linha em branco. A IA procura padrões de vocabulário, ritmo, postura e CTA."
                style={{ minHeight: 104, resize: 'vertical', lineHeight: 1.45 }}
              />
            </div>
            {sourceFeedback ? (
              <div role="status" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{sourceFeedback}</div>
            ) : null}
          </div>
        ) : null}
      </div>

      {draft ? (
        <div style={{
          border: '1px solid var(--accent)',
          borderRadius: 12, padding: 12,
          background: 'var(--accent-surface)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--accent)' }}>
            Confirme o tom antes de guardar
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
            {draft.summary}
          </div>
          {draft.traits?.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {draft.traits.map((t) => (
                <span key={t} style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                  textTransform: 'uppercase', padding: '4px 8px', borderRadius: 9999,
                  border: '1px solid var(--hairline)', color: 'var(--text-secondary)',
                }}>{t}</span>
              ))}
            </div>
          ) : null}
          <label className="vc-label-sm">Resumo (editável)</label>
          <input
            className="vc-input"
            value={draft.summary || ''}
            onChange={(e) => setDraft({
              ...draft,
              summary: e.target.value,
              method: buildBrandToneMethod({ ...draft, summary: e.target.value }),
            })}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="vc-btn" onClick={confirmDraft} style={{
              flex: 1, minHeight: 44, borderRadius: 9999, background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 600,
            }}>
              Guardar tom da marca
            </button>
            <button type="button" className="vc-btn vc-btn-ghost" onClick={discardDraft} style={{ minHeight: 44 }}>
              Descartar
            </button>
          </div>
        </div>
      ) : ready ? (
        <div style={{
          border: '1px solid var(--glass-border-strong)',
          borderRadius: 12, padding: 12,
          background: 'var(--bg-card)',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
            {preview.summary}
          </div>
          {preview.traits?.length ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {preview.traits.map((t) => (
                <span key={t} style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
                  textTransform: 'uppercase', padding: '4px 8px', borderRadius: 9999,
                  border: '1px solid var(--hairline)', color: 'var(--text-secondary)',
                }}>{t}</span>
              ))}
            </div>
          ) : null}
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: 1.4,
          }}>
            <input
              type="checkbox"
              checked={brand?.useBrandVoice !== false}
              onChange={(e) => setBrand?.((current) => ({ ...(current || {}), useBrandVoice: e.target.checked }))}
              style={{ marginTop: 2, width: 16, height: 16, accentColor: 'var(--accent)' }}
            />
            <span>Falar como minha marca (aplica a voz em qualquer modo narrativo)</span>
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="vc-btn vc-btn-ghost"
              disabled={busy}
              onClick={runAnalyze}
              style={{ minHeight: 40, flex: 1 }}
            >
              {busy ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Analisando…</> : <><Sparkles size={14} /> Reanalisar</>}
            </button>
            <button type="button" className="vc-btn vc-btn-ghost" onClick={() => setOpenEdit((v) => !v)} style={{ minHeight: 40 }}>
              {openEdit ? 'Fechar' : 'Editar'}
            </button>
            <button
              type="button"
              className="vc-btn vc-btn-ghost"
              onClick={clearTone}
              aria-label="Remover tom da marca"
              style={{ minHeight: 40, width: 40, padding: 0, color: '#f87171' }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="vc-btn"
          disabled={busy}
          onClick={runAnalyze}
          style={{
            width: '100%', minHeight: 48, borderRadius: 9999,
            background: 'var(--accent)', color: '#fff', border: 'none',
            fontWeight: 600, fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {busy
            ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Analisando publicações e contexto…</>
            : <><Sparkles size={14} /> Analisar meu tom</>}
        </button>
      )}

      {(openEdit && ready && !draft) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label className="vc-label-sm">Resumo do tom</label>
            <input className="vc-input" value={tone.summary || ''} onChange={(e) => patchTone({ summary: e.target.value })} placeholder="Ex.: direto, editorial, sem motivacional" />
          </div>
          <div>
            <label className="vc-label-sm">Traços (separados por vírgula)</label>
            <input className="vc-input" value={(tone.traits || []).join(', ')} onChange={(e) => patchTone({ traits: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
          </div>
          <div>
            <label className="vc-label-sm">Fazer</label>
            <textarea className="vc-input vc-textarea" rows={3} value={tone.do || ''} onChange={(e) => patchTone({ do: e.target.value })} style={{ resize: 'vertical', minHeight: 64 }} />
          </div>
          <div>
            <label className="vc-label-sm">Evitar</label>
            <textarea className="vc-input vc-textarea" rows={3} value={tone.dont || ''} onChange={(e) => patchTone({ dont: e.target.value })} style={{ resize: 'vertical', minHeight: 64 }} />
          </div>
          <div>
            <label className="vc-label-sm">Estilo de CTA</label>
            <textarea className="vc-input vc-textarea" rows={3} value={tone.ctaStyle || ''} onChange={(e) => patchTone({ ctaStyle: e.target.value })} placeholder="Ex.: convite direto, pergunta curta, salvar pela utilidade — sem urgência artificial." style={{ resize: 'vertical', minHeight: 64 }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
