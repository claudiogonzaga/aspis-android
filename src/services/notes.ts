// Renderização da nota Markdown — baseada no obsidian.py:_render_note do
// desktop. O cabeçalho/frontmatter e as seções Resumo/Pontos-chave/Citações
// permanecem fiéis (mesma pasta Drive:/Aspis). O Android ACRESCENTA seções —
// Evidências, Flashcards e Perguntas & Checagens — pedidas pelo usuário; o
// desktop simplesmente não as escreve.

import { MOC_NAME_NENHUM } from '../constants/defaults';
import type { Fato, Pillar, QAItem, Veredito, VideoRecord } from '../types';
import { noteBasename } from '../utils/sanitize';

const VEREDITO_LABEL: Record<Veredito, string> = {
  apoiada: 'apoiada por evidência',
  mista: 'evidência mista',
  contestada: 'contestada pela evidência',
  sem_evidencia: 'sem evidência',
};

function fatoLine(f: Fato): string {
  return f.tipo === 'cloze' ? `- ${f.texto}` : `- ${f.frente} :: ${f.verso}`;
}

export function mocNameFor(pillarId: string, pillars: Pillar[]): string {
  if (pillarId === 'nenhum') return MOC_NAME_NENHUM;
  const p = pillars.find((x) => x.id === pillarId);
  return p?.mocName || p?.nome || MOC_NAME_NENHUM;
}

export function noteFilename(v: VideoRecord): string {
  return `${noteBasename(v.neutral_title, v.video_id)}.md`;
}

export function renderNote(
  v: VideoRecord,
  pillars: Pillar[],
  savedQa: QAItem[] = [],
): string {
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
  const evidencias = v.evidencias || [];
  if (evidencias.length) {
    lines.push('## Evidências');
    for (const e of evidencias) {
      lines.push(`- **${e.afirmacao}** — _${VEREDITO_LABEL[e.veredito]}_`);
      if (e.evidencia) lines.push(`    ${e.evidencia}`);
      if (e.fontes?.length) lines.push(`    Fontes: ${e.fontes.join('; ')}`);
    }
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
  const fatos = v.fatos || [];
  if (fatos.length) {
    lines.push('## Flashcards');
    for (const f of fatos) lines.push(fatoLine(f));
    lines.push('');
  }
  const saved = savedQa.filter((q) => q.saved_note === 1);
  if (saved.length) {
    lines.push('## Perguntas & Checagens');
    for (const q of saved) {
      const head = q.kind === 'factcheck' ? `Checagem externa — ${q.question}` : q.question;
      lines.push(`### ${head}`);
      lines.push(q.answer);
      if (q.sources?.length) {
        lines.push('');
        lines.push('Fontes:');
        for (const s of q.sources) lines.push(`- [${s.title}](${s.uri})`);
      }
      lines.push('');
    }
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
  if (v.evidencias?.length) {
    parts.push('Evidências:');
    for (const e of v.evidencias) {
      parts.push(`- ${e.afirmacao} [${VEREDITO_LABEL[e.veredito]}]`);
      if (e.evidencia) parts.push(`  ${e.evidencia}`);
      if (e.fontes?.length) parts.push(`  Fontes: ${e.fontes.join('; ')}`);
    }
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
