import type { Period, Pillar } from '../types';

// Pilares default — copiados do config.yaml do Aspis desktop.
export const DEFAULT_PILLARS: Pillar[] = [
  {
    id: 'saude',
    nome: 'Saúde mental e física',
    descricao:
      'Saúde baseada em evidência: sono, treino de força, nutrição sustentável, ansiedade, foco.',
    quero: ['protocolos acionáveis', 'estudos', 'hábitos sustentáveis'],
    nao_quero: ['dietas milagrosas', 'biohacking sem evidência', 'fitspiration'],
    peso: 3,
    mocName: 'Saúde',
  },
  {
    id: 'investimento',
    nome: 'Decisões acertadas em investimento',
    descricao: 'Decisões de longo prazo, alocação, gestão de risco, sobriedade.',
    quero: ['frameworks', 'dados macro', 'análise sóbria'],
    nao_quero: ['pump de cripto', 'day-trade hype', 'FOMO', 'sinais de compra'],
    peso: 3,
    mocName: 'Investimento',
  },
  {
    id: 'paternidade',
    nome: 'Ser um bom pai',
    descricao:
      'Pai presente e melhor: desenvolvimento infantil, disciplina positiva, equilíbrio.',
    quero: ['psicologia do desenvolvimento', 'atividades', 'comunicação'],
    nao_quero: ['culpa parental', 'comparação', 'prescrições rígidas'],
    peso: 3,
    mocName: 'Paternidade',
  },
];

// Nome do MOC para vídeos sem pilar (obsidian.py: PILLAR_NAMES["nenhum"]).
export const MOC_NAME_NENHUM = 'Geral';

// Regras extras default da IA — copiadas do config.py (DEFAULT_RULES).
export const DEFAULT_RULES =
  'Penalize sensacionalismo: rage bait, isca de engajamento, promessas vazias, ' +
  'FOMO, CAPS, emojis de alarme — marque is_clickbait e reduza o score.\n' +
  'Priorize densidade de informação acionável e evidência sobre popularidade.\n' +
  'Vídeos de pura opinião/entretenimento, sem valor para os objetivos, vão para ' +
  "'nenhum' com score baixo.";

// Score → estrelas (config.py: STAR_MIN_SCORE). 5★ = score ≥ 95.
export const STAR_MIN_SCORE: Record<number, number> = { 0: 0, 1: 20, 2: 40, 3: 60, 4: 80, 5: 95 };

export function scoreToStars(score: number): number {
  const s = Math.max(0, Math.min(100, Math.round(score || 0)));
  let stars = 0;
  for (const k of [1, 2, 3, 4, 5]) {
    if (s >= STAR_MIN_SCORE[k]) stars = k;
  }
  return stars;
}

export function starsToThreshold(stars: number): number {
  return STAR_MIN_SCORE[Math.max(0, Math.min(5, stars))];
}

// Período de exibição/busca → horas de lookback (config.py: PERIODS).
export const PERIODS: Record<Period, number> = { day: 36, week: 24 * 7, month: 24 * 30 };
export const PERIOD_LABELS: Record<Period, string> = { day: 'Dia', week: 'Semana', month: 'Mês' };

// LLM — mesmos parâmetros do desktop (brain.py / config.yaml).
export const DEFAULT_MODEL = 'gemini-3.5-flash';
export const MODEL_PRESETS = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'];
export const TEMPERATURE = 0.3;
export const MAX_OUTPUT_TOKENS = 4096;
export const MAX_TRANSCRIPT_CHARS = 14000;
export const ASK_MAX_TOKENS = 1200;
export const ASK_TRANSCRIPT_CHARS = 24000;

// Pipeline do feed.
export const MAX_VIDEOS_PER_CHANNEL = 8; // config.yaml: max_videos_per_channel
export const MAX_VIDEOS_PER_RUN = 25; // limite por execução (botão Atualizar)

// Defaults de exibição.
export const DEFAULT_MIN_STARS = 3; // = threshold 60 do desktop
export const DEFAULT_PERIOD: Period = 'day';
