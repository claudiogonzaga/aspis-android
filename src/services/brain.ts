// brain.ts — o coração. UMA chamada de LLM por vídeo produz o objeto
// estruturado (pilar, score, título neutro, resumo, pontos-chave, fatos,
// citações). Port fiel do brain.py do desktop: mesmo prompt (verbatim),
// mesmos parâmetros (JSON estrito, temperature 0.3, 4096 tokens) e mesmo
// parser tolerante. A diferença: aqui a chamada é REST direto na API Gemini
// com a chave do usuário, e há a camada extra de "assistir" o vídeo via
// fileUri (a API Gemini aceita URLs públicas do YouTube).

import {
  ASK_MAX_TOKENS,
  ASK_TRANSCRIPT_CHARS,
  MAX_OUTPUT_TOKENS,
  MAX_TRANSCRIPT_CHARS,
  TEMPERATURE,
} from '../constants/defaults';
import { ASK_SYSTEM, DEFAULT_PILLAR_ENUM, SYSTEM_RULES } from '../constants/prompt';
import type {
  Analysis,
  ContentSource,
  Pillar,
  QAItem,
  Transcript,
  VideoMeta,
  VideoRecord,
} from '../types';
import { fetchTranscript } from './captions';

export class NoGeminiKeyError extends Error {
  constructor() {
    super(
      'Chave do Gemini não configurada. Cole a sua chave em Configurações para o Aspis poder analisar vídeos.',
    );
    this.name = 'NoGeminiKeyError';
  }
}

export class GeminiError extends Error {
  isKeyError: boolean;
  constructor(message: string, isKeyError = false) {
    super(message);
    this.name = 'GeminiError';
    this.isKeyError = isKeyError;
  }
}

// --- prompt -----------------------------------------------------------------

function pillarsBlock(pillars: Pillar[]): string {
  const linhas = ['Pilares do usuário:'];
  for (const p of pillars) {
    linhas.push(
      `- ${p.id} (${p.nome || ''}): ${p.descricao || ''}\n` +
        `    quero: ${(p.quero || []).join(', ')}\n` +
        `    não quero: ${(p.nao_quero || []).join(', ')}`,
    );
  }
  return linhas.join('\n');
}

export function buildSystemText(pillars: Pillar[], rules: string): string {
  const regrasFmt = (rules || '')
    .split('\n')
    .map((ln) => ln.trim())
    .filter(Boolean)
    .map((ln) => '- ' + ln)
    .join('\n');
  let head = SYSTEM_RULES.replace('{regras_usuario}', regrasFmt);
  // pilares editáveis: o enum do schema acompanha os pilares atuais
  const enumStr = [...pillars.map((p) => p.id), 'nenhum'].join(' | ');
  head = head.replace(DEFAULT_PILLAR_ENUM, enumStr);
  return head + '\n\n' + pillarsBlock(pillars);
}

function buildUserMessage(
  video: VideoMeta,
  transcript: Transcript | null,
  videoAttached: boolean,
): string {
  const parts = [
    `Título original: ${video.title || ''}`,
    `Canal: ${video.channel || ''}`,
    `Duração: ${video.duration || ''}`,
    `Descrição:\n${(video.description || '').slice(0, 2000)}`,
  ];
  if (transcript?.available && transcript.text) {
    const text = transcript.text.slice(0, MAX_TRANSCRIPT_CHARS);
    parts.push(`\nTranscrição (pode estar truncada):\n${text}`);
    const marks = transcript.segments.slice(0, 40).map((s) => `${s.ts}: ${s.text}`);
    if (marks.length) {
      parts.push('\nReferências de timestamp (início da transcrição):\n' + marks.join('\n'));
    }
  } else if (videoAttached) {
    parts.push(
      '\n[O VÍDEO COMPLETO está anexado a esta mensagem — use o conteúdo dele ' +
        '(fala e imagem) como fonte da verdade, como se fosse a transcrição, ' +
        'inclusive para os timestamps das citações.]',
    );
  } else {
    parts.push('\n[Sem transcrição disponível — avalie por título e descrição.]');
  }
  return parts.join('\n');
}

// --- chamada Gemini (REST) ---------------------------------------------------

type GeminiPart = { text: string } | { fileData: { fileUri: string } };

interface GeminiCall {
  apiKey: string;
  model: string;
  system: string;
  parts: GeminiPart[];
  json: boolean;
  maxTokens: number;
}

async function callGemini({ apiKey, model, system, parts, json, maxTokens }: GeminiCall): Promise<string> {
  if (!apiKey) throw new NoGeminiKeyError();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: TEMPERATURE,
      maxOutputTokens: maxTokens,
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    let message = `Gemini respondeu HTTP ${resp.status}`;
    try {
      const err = await resp.json();
      if (err?.error?.message) message = err.error.message;
    } catch {
      // mantém a mensagem genérica
    }
    const isKeyError =
      resp.status === 401 || resp.status === 403 || /api key/i.test(message);
    throw new GeminiError(message, isKeyError);
  }
  const data = await resp.json();
  const textParts: string[] = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text || '')
    .filter(Boolean);
  return textParts.join('');
}

// --- parsing / normalização (port do brain.py) -------------------------------

function parseJsonLoose(raw: string): Record<string, unknown> {
  let text = (raw || '').trim();
  if (!text) {
    throw new Error('resposta do LLM veio vazia (possível truncamento/bloqueio)');
  }
  if (text.startsWith('```')) {
    text = text.replace(/^`+|`+$/g, '');
    if (text.toLowerCase().startsWith('json')) text = text.slice(4);
    text = text.trim();
  }
  try {
    return JSON.parse(text);
  } catch {
    // recorta do primeiro { ao último }
  }
  const i = text.indexOf('{');
  const j = text.lastIndexOf('}');
  if (i !== -1 && j !== -1 && j > i) {
    return JSON.parse(text.slice(i, j + 1));
  }
  throw new Error('resposta do LLM não continha JSON válido');
}

function coerce(obj: Record<string, unknown>, video: VideoMeta, pillarIds: string[]): Analysis {
  let pillar = String(obj.pillar ?? 'nenhum');
  if (!pillarIds.includes(pillar) && pillar !== 'nenhum') pillar = 'nenhum';
  let score = 0;
  const rawScore = obj.score;
  if (typeof rawScore === 'number' && Number.isFinite(rawScore)) score = Math.round(rawScore);
  else if (typeof rawScore === 'string' && rawScore.trim() !== '') {
    const n = Number(rawScore);
    if (Number.isFinite(n)) score = Math.round(n);
  }
  score = Math.max(0, Math.min(100, score));
  return {
    pillar,
    score,
    is_clickbait: obj.is_clickbait ? 1 : 0,
    neutral_title: String(obj.neutral_title || video.title || '').trim(),
    resumo: String(obj.resumo || '').trim(),
    pontos_chave: Array.isArray(obj.pontos_chave) ? (obj.pontos_chave as string[]) : [],
    fatos: Array.isArray(obj.fatos_para_memorizar)
      ? (obj.fatos_para_memorizar as Analysis['fatos'])
      : [],
    citacoes: Array.isArray(obj.citacoes) ? (obj.citacoes as Analysis['citacoes']) : [],
  };
}

export interface BrainOptions {
  apiKey: string;
  model: string;
  pillars: Pillar[];
  rules: string;
}

const MAX_RETRIES = 2; // como no desktop: JSON inválido → tenta de novo

async function analyzeOnce(
  video: VideoMeta,
  parts: GeminiPart[],
  opts: BrainOptions,
): Promise<Analysis> {
  const system = buildSystemText(opts.pillars, opts.rules);
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const text = await callGemini({
      apiKey: opts.apiKey,
      model: opts.model,
      system,
      parts,
      json: true,
      maxTokens: MAX_OUTPUT_TOKENS,
    });
    try {
      const obj = parseJsonLoose(text);
      return coerce(obj, video, opts.pillars.map((p) => p.id));
    } catch (e) {
      lastErr = e; // JSON inválido → tenta de novo
    }
  }
  throw new GeminiError(`brain.analyze falhou após ${MAX_RETRIES + 1} tentativas: ${lastErr}`);
}

export interface AnalyzeResult {
  analysis: Analysis;
  source: ContentSource;
  transcript: Transcript | null;
}

export type AnalyzePhase = 'video' | 'captions' | 'metadata';

// Análise em camadas (Funcionalidade 1):
//  a) Gemini "assiste" o vídeo via fileUri (caminho preferido — share target)
//  b) legendas públicas (timedtext)
//  c) só metadados (o prompt manda declarar isso no resumo)
// No feed, `tryVideoUri=false` pula a camada (a) — mesmo comportamento do
// desktop (transcrição → metadados) e custo/latência viáveis para ~25 vídeos.
export async function analyze(
  video: VideoMeta,
  opts: BrainOptions,
  tryVideoUri: boolean,
  onPhase?: (phase: AnalyzePhase) => void,
): Promise<AnalyzeResult> {
  if (!opts.apiKey) throw new NoGeminiKeyError();

  if (tryVideoUri) {
    try {
      onPhase?.('video');
      const parts: GeminiPart[] = [
        { fileData: { fileUri: video.url } },
        { text: buildUserMessage(video, null, true) },
      ];
      const analysis = await analyzeOnce(video, parts, opts);
      return { analysis, source: 'video', transcript: null };
    } catch (e) {
      // chave ruim/ausente não melhora nas camadas seguintes → propaga já
      if (e instanceof NoGeminiKeyError) throw e;
      if (e instanceof GeminiError && e.isKeyError) throw e;
      // demais erros (vídeo longo demais, não suportado…) → próxima camada
    }
  }

  onPhase?.('captions');
  let transcript: Transcript | null = null;
  try {
    transcript = await fetchTranscript(video.video_id);
  } catch {
    transcript = null;
  }

  if (transcript?.available) {
    const parts: GeminiPart[] = [{ text: buildUserMessage(video, transcript, false) }];
    const analysis = await analyzeOnce(video, parts, opts);
    return { analysis, source: 'captions', transcript };
  }

  onPhase?.('metadata');
  const parts: GeminiPart[] = [{ text: buildUserMessage(video, null, false) }];
  const analysis = await analyzeOnce(video, parts, opts);
  return { analysis, source: 'metadata', transcript: null };
}

// --- Q&A sobre um vídeo (port do brain.ask) ----------------------------------
export async function ask(
  video: VideoRecord,
  question: string,
  history: QAItem[],
  opts: Pick<BrainOptions, 'apiKey' | 'model'>,
): Promise<string> {
  const parts: string[] = [
    `VÍDEO: ${video.neutral_title || video.original_title || ''}`,
    `Canal: ${video.channel || ''}`,
  ];
  if (video.resumo) parts.push(`Resumo já gerado: ${video.resumo}`);

  const tt = (video.transcript_text || '').trim();
  const geminiParts: GeminiPart[] = [];
  if (tt) {
    parts.push('\nTRANSCRIÇÃO (fonte da verdade):\n' + tt.slice(0, ASK_TRANSCRIPT_CHARS));
  } else if (video.content_source === 'video') {
    geminiParts.push({ fileData: { fileUri: video.url } });
    parts.push('\n[O VÍDEO está anexado — use o conteúdo dele como fonte da verdade.]');
  } else {
    parts.push('\n[Sem transcrição disponível — responda só pelos metadados e diga isso.]');
  }
  if (history.length) {
    const hist = history
      .slice(-6)
      .map((h) => `P: ${h.question}\nR: ${h.answer}`)
      .join('\n');
    parts.push('\nCONVERSA ANTERIOR:\n' + hist);
  }
  parts.push(`\nPERGUNTA DO USUÁRIO:\n${question}`);
  geminiParts.push({ text: parts.join('\n') });

  const answer = await callGemini({
    apiKey: opts.apiKey,
    model: opts.model,
    system: ASK_SYSTEM,
    parts: geminiParts,
    json: false,
    maxTokens: ASK_MAX_TOKENS,
  });
  return (answer || '').trim();
}
