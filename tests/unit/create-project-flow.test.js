import { describe, expect, it } from 'vitest';
import { cloneCreationBrand, creationMaterialHasContent, NARRATIVE_CHOICES, readCreationTextFile, validCreationCount, neutralCreationIdentity, creationIdentitySummary, captureCreationVisualIdentity, applyCreationVisualChoice } from '../../src/utils/create-project-flow.js';

describe('novo projeto: escolhas e material local', () => {
  it('isola a identidade e as referências do perfil salvo', () => {
    const saved = { id:'cliente-a', name:'Cliente A', palette:{ accent:'#123456' }, styleKit:{ contextMd:'Brief da marca', refImages:[{ id:'ref-a', imageId:'img-a', name:'Referência' }] } };
    const draft = cloneCreationBrand(saved);
    draft.brand.name = 'Ajuste deste projeto';
    draft.brand.palette.accent = '#abcdef';
    draft.styleKit.contextMd = 'Contexto deste projeto';
    draft.styleKit.refImages[0].name = 'Outro nome';
    expect(saved.name).toBe('Cliente A');
    expect(saved.palette.accent).toBe('#123456');
    expect(saved.styleKit.contextMd).toBe('Brief da marca');
    expect(saved.styleKit.refImages[0].name).toBe('Referência');
  });
  it('mantém os nove modos narrativos disponíveis com exemplo e nome legível', () => {
    expect(NARRATIVE_CHOICES.map(item => item.id).sort()).toEqual(['none','editorial','deep','pain','viral','storytelling','how_to','jornalistico','sensacionalista'].sort());
    expect(new Set(NARRATIVE_CHOICES.map(item => item.id)).size).toBe(9);
    expect(NARRATIVE_CHOICES.every(item => item.label && item.desc && item.example)).toBe(true);
    expect(NARRATIVE_CHOICES.find(item => item.id === 'viral').label).toBe('Prender atenção');
  });
  it('aceita a quantidade integral do contrato e recusa limites inválidos', () => {
    expect(validCreationCount('1','carrossel')).toBe(true);
    expect(validCreationCount('24','carrossel')).toBe(true);
    expect(validCreationCount('5','apresentacao')).toBe(true);
    expect(validCreationCount('24','apresentacao')).toBe(true);
    expect(validCreationCount('4','apresentacao')).toBe(false);
    for (const value of ['', '0', '25', '5.5', 'abc', NaN]) expect(validCreationCount(value,'carrossel')).toBe(false);
  });
  it('identifica apoio real em cada campo sem exigir todos', () => {
    expect(creationMaterialHasContent({ content:'  ', sources:'\n' })).toBe(false);
    expect(creationMaterialHasContent({ content:'Notas reais' })).toBe(true);
    expect(creationMaterialHasContent({ sources:'https://exemplo.com' })).toBe(true);
    expect(creationMaterialHasContent({ context:'Apresente os serviços desta marca.' })).toBe(true);
  });
  it('importa texto completo e preserva quebras, sem simular leitura de PDF ou Word', async () => {
    const content = '# Material\n\nInformação com acento.\n\nFim.';
    const text = async () => content;
    await expect(readCreationTextFile({ name:'brief.MD', size:content.length, text })).resolves.toBe(content);
    await expect(readCreationTextFile({ name:'brief.txt', size:content.length, text })).resolves.toBe(content);
    await expect(readCreationTextFile({ name:'brief.pdf', size:content.length, text })).rejects.toThrow('.txt ou .md');
    await expect(readCreationTextFile({ name:'brief.docx', size:content.length, text })).rejects.toThrow('.txt ou .md');
  });
  it('recusa arquivo vazio, binário ou extenso sem truncar conteúdo', async () => {
    await expect(readCreationTextFile({ name:'vazio.txt', size:2, text:async () => '\n ' })).rejects.toThrow('vazio');
    await expect(readCreationTextFile({ name:'falso.txt', size:2, text:async () => '\u0000a' })).rejects.toThrow('como texto');
    await expect(readCreationTextFile({ name:'longo.txt', size:200001, text:async () => 'a'.repeat(200001) })).rejects.toThrow('nenhum trecho');
    await expect(readCreationTextFile({ name:'pesado.txt', size:3*1024*1024, text:async () => '' })).rejects.toThrow('até 2 MB');
  });
  it('começa neutro e remove identidade, voz e arquivos herdados sem mutar a origem', () => {
    const source = { name:'Outro cliente', bg:'#fafafc', titleColor:'#000000', logo:'data:image/png;base64,old', logoImageId:'old-logo', logoAssetId:'old-asset', handle:'@outro', handleAvatar:'old-avatar', bio:'Bio antiga', positioning:'Posicionamento antigo', signature:'Assinatura antiga', defaultAudience:'Público antigo', defaultTone:'Tom antigo', brandTone:{ summary:'Voz antiga', method:'Método antigo' }, links:'https://outro.example', styleKit:{ contextMd:'Brief antigo', stylePrompt:'Estilo antigo', logo:{ imageId:'old-kit-logo' }, refImages:[{ id:'old-ref', imageId:'old-ref-image' }] } };
    const neutral = neutralCreationIdentity(source);
    expect(neutral.brandId).toBe('__local__');
    for (const key of ['name','handle','bio','positioning','signature','defaultAudience','defaultTone','links']) expect(neutral.brand[key]).toBe('');
    for (const key of ['logo','logoImageId','logoAssetId','handleAvatar','brandTone']) expect(neutral.brand[key]).toBeNull();
    expect(neutral.styleKit).toMatchObject({ contextMd:'', stylePrompt:'', refImages:[] });
    expect(neutral.styleKit.logo).toBeUndefined();
    expect(neutral.brand.styleKit.contextMd).toBe('');
    expect(neutral.brand.bg).toBe('#fafafc');
    expect(source.logoImageId).toBe('old-logo');
    expect(source.styleKit.refImages[0].imageId).toBe('old-ref-image');
    expect(source.brandTone.summary).toBe('Voz antiga');
  });
  it('reutiliza uma marca completa em cópia isolada, incluindo tom e arquivos', () => {
    const source = { id:'marca-salva', logoImageId:'logo-salva', brandTone:{ summary:'Calma e próxima', traits:['acolhedora'], method:'Explique com calma' }, styleKit:{ contextMd:'Brief salvo', stylePrompt:'Luz natural', logo:{ imageId:'logo-projeto' }, refImages:[{ id:'ref-1', imageId:'ref-image', name:'Ref salva' }] } };
    const saved = cloneCreationBrand(source);
    expect(saved.brand.logoImageId).toBe('logo-salva');
    expect(saved.styleKit.logo.imageId).toBe('logo-projeto');
    expect(creationIdentitySummary(saved.brand, saved.styleKit)).toMatchObject({ logo:'Logo incluída', references:1, tone:'Calma e próxima', hasBrief:true });
    saved.brand.brandTone.traits.push('direta');
    saved.styleKit.refImages.pop();
    expect(source.brandTone.traits).toEqual(['acolhedora']);
    expect(source.styleKit.refImages).toHaveLength(1);
  });
  it('resume identidade neutra e respeita logo e tom desligados', () => {
    const neutral = neutralCreationIdentity({});
    expect(creationIdentitySummary(neutral.brand, neutral.styleKit)).toMatchObject({ logo:'Sem logo', references:0, tone:'', hasBrief:false });
    expect(creationIdentitySummary({ logoImageId:'saved', brandTone:{ summary:'Voz salva', method:'Use voz salva' }, useBrandVoice:false }, { logoOnGenerate:false })).toMatchObject({ logo:'Logo desativada', tone:'' });
  });

  it('ao remover um preset restaura os tokens da identidade, mantendo conteúdo e logo alterados', () => {
    const original = { id:'brand-a', name:'Marca A', bg:'#fafafc', titleColor:'#101010', titleFont:'"Outfit", sans-serif', customTitleFont:{ dataUrl:'data:font/woff2;base64,original', format:'woff2' }, logoImageId:'logo-original', brandTone:{ summary:'Tom original' } };
    const snapshot = captureCreationVisualIdentity(original);
    const preset = { brand:{ bg:'#112233', titleColor:'#ffeeaa', titleFont:'"Georgia", serif', footerPillText:'Uma assinatura do preset' } };
    const preview = applyCreationVisualChoice(original, snapshot, preset);
    expect(preview.bg).toBe('#112233');
    expect(preview.customTitleFont).toBeNull();
    const edited = { ...preview, titleColor:'#aabbcc', name:'Nome ajustado', logoImageId:'logo-enviada', brandTone:{ summary:'Tom novo' } };
    const restored = applyCreationVisualChoice(edited, snapshot);
    expect(restored.bg).toBe('#fafafc');
    expect(restored.titleColor).toBe('#101010');
    expect(restored.titleFont).toBe(original.titleFont);
    expect(restored.customTitleFont).toEqual(original.customTitleFont);
    expect(restored.footerPillText).toBeUndefined();
    expect(restored.name).toBe('Nome ajustado');
    expect(restored.logoImageId).toBe('logo-enviada');
    expect(restored.brandTone.summary).toBe('Tom novo');
    expect(original.logoImageId).toBe('logo-original');
  });
  it('trocar de preset ou de produto não acumula tokens do preview anterior', () => {
    const identity = { bg:'#ffffff', accent:'#000000', titleFont:'"Outfit", sans-serif', bodyFont:'"Inter", sans-serif', styleKit:{ contextMd:'Preservar o briefing', refImages:[{ imageId:'ref-1' }] } };
    const snapshot = captureCreationVisualIdentity(identity);
    const first = applyCreationVisualChoice(identity, snapshot, { brand:{ bg:'#112233', accent:'#ffeedd', footerPillText:'Preset anterior' } });
    const second = applyCreationVisualChoice(first, snapshot, { brand:{ titleFont:'"Georgia", serif' } });
    expect(second.bg).toBe('#ffffff');
    expect(second.accent).toBe('#000000');
    expect(second.footerPillText).toBeUndefined();
    expect(second.titleFont).toBe('"Georgia", serif');
    const afterProductChange = applyCreationVisualChoice(second, snapshot);
    expect(afterProductChange.titleFont).toBe(identity.titleFont);
    expect(afterProductChange.styleKit).toEqual(identity.styleKit);
    // Manual edits to the base identity survive later visual exploration.
    const manuallyEdited = { ...afterProductChange, accent:'#335577' };
    const updatedBase = captureCreationVisualIdentity(manuallyEdited);
    const explored = applyCreationVisualChoice(manuallyEdited, updatedBase, { brand:{ accent:'#ff0000' } });
    expect(applyCreationVisualChoice(explored, updatedBase).accent).toBe('#335577');
  });

});
