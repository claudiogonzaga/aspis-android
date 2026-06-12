// Renderização da nota Markdown — port BYTE-A-BYTE do obsidian.py:_render_note.
// O desktop e o Android escrevem o MESMO formato na MESMA pasta (Drive:/Aspis),
// então qualquer divergência aqui quebra a sincronização. Não "melhorar" nada.

import { MOC_NAME_NENHUM } from '../constants/defaults';
import type { Pillar, VideoRecord } from '../types';
import { noteBasename } from '../utils/sanitize';

export function mocNameFor(pillarId: string, pillars: Pillar[]): string {
  if (pillarId === 'nenhum') return MOC_NAME_NENHUM;
  const p = pillars.find((x) => x.id === pillarId);
  return p?.mocName || p?.nome || MOC_NAME_NENHUM;
}

export function noteFilename(v: VideoRecord): string {
  return `${noteBasename(v.neutral_title, v.video_id)}.md`;
}

export function renderNote(v: VideoRecord, pillars: Pillar[]): string {
  const pillarName = mocNameFor(v.pillar, pillars);
  const data =
    (v.published_at || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  const autor = (v.channel || '').replace(/"/g, "'");

  const lines: string[] = [
    '---',
    'fonte: youtube',
    `autor: "${autor}"`,
    `pilar: ${v.pillar}`,
    `data: ${data}`,
    `url: ${v.url || ''}`,
    `score: ${v.score ?? 0}`,
    `tags: [${v.pillar}, aspis]`,
    '---',
    '',
    `# ${v.neutral_title}`,
    '',
    '## Resumo',
    v.resumo || '_(sem resumo)_',
    '',
  ];
  const pontos = v.pontos_chave || [];
  if (pontos.length) {
    lines.push('## Pontos-chave');
    for (const p of pontos) lines.push(`- ${p}`);
    lines.push('');
  }
  const citacoes = v.citacoes || [];
  if (citacoes.length) {
    lines.push('## Citações');
    for (const c of citacoes) {
      const ts = c.timestamp || '';
      lines.push(`> ${c.texto || ''}` + (ts ? ` — ${ts}` : ''));
    }
    lines.push('');
  }
  lines.push(`[[${pillarName} - MOC]]`);
  lines.push('');
  return lines.join('\n');
}

// Texto completo da síntese para a ação "Copiar" da tela de análise.
export function synthesisAsText(v: VideoRecord): string {
  const parts: string[] = [v.neutral_title, ''];
  parts.push(`${v.channel} · ${v.duration} · score ${v.score}`);
  parts.push('');
  if (v.resumo) {
    parts.push(v.resumo);
    parts.push('');
  }
  if (v.pontos_chave?.length) {
    parts.push('Pontos-chave:');
    for (const p of v.pontos_chave) parts.push(`- ${p}`);
    parts.push('');
  }
  if (v.fatos?.length) {
    parts.push('Fatos para memorizar:');
    for (const f of v.fatos) {
      if (f.tipo === 'basic') parts.push(`- ${f.frente} → ${f.verso}`);
      else parts.push(`- ${f.texto}`);
    }
    parts.push('');
  }
  if (v.citacoes?.length) {
    parts.push('Citações:');
    for (const c of v.citacoes)
      parts.push(`> ${c.texto}${c.timestamp ? ` — ${c.timestamp}` : ''}`);
    parts.push('');
  }
  parts.push(v.url);
  return parts.join('\n');
}
