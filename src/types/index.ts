// Tipos centrais do Aspis Android — espelham o schema do desktop (store.py /
// brain.py) para manter compatibilidade de dados e de notas.

export interface Pillar {
  id: string; // chave usada no prompt e no banco (ex.: "saude")
  nome: string;
  descricao: string;
  quero: string[];
  nao_quero: string[];
  peso: number; // 1–5, neutro = 3
  mocName: string; // nome no link [[X - MOC]] da nota (ex.: "Saúde")
}

export interface Citacao {
  texto: string;
  timestamp: string; // "mm:ss"
}

export type Fato =
  | { tipo: 'basic'; frente: string; verso: string }
  | { tipo: 'cloze'; texto: string };

// Veredito de uma afirmação do vídeo frente à evidência conhecida.
export type Veredito = 'apoiada' | 'mista' | 'contestada' | 'sem_evidencia';

// Evidência científica/empírica que sustenta (ou contesta) uma afirmação do
// vídeo. Gerada junto da síntese — sobretudo para saúde, mas também para
// investimento e demais temas.
export interface Evidencia {
  afirmacao: string; // a afirmação feita no vídeo
  veredito: Veredito;
  evidencia: string; // o que a literatura/dados disponíveis dizem
  fontes: string[]; // estudos, diretrizes, autores (texto livre)
}

// Resultado coagido da análise (mesmas chaves do brain.py após _coerce,
// + `evidencias`, exclusivo do Android).
export interface Analysis {
  pillar: string;
  score: number; // 0–100
  is_clickbait: 0 | 1;
  neutral_title: string;
  resumo: string;
  pontos_chave: string[];
  fatos: Fato[];
  citacoes: Citacao[];
  evidencias: Evidencia[];
}

// De onde veio o conteúdo analisado (camadas da Funcionalidade 1).
export type ContentSource = 'video' | 'captions' | 'metadata';

// Metadados de um vídeo antes da análise (oEmbed e/ou videos.list).
export interface VideoMeta {
  video_id: string;
  title: string;
  channel: string;
  channel_id: string;
  description: string;
  published_at: string; // ISO
  duration: string; // humanizada ("18 min")
  url: string;
  channel_thumb: string;
}

// Linha da tabela videos (espelha as colunas principais do store.py).
export interface VideoRecord extends Analysis {
  video_id: string;
  channel: string;
  channel_id: string;
  original_title: string;
  url: string;
  published_at: string;
  duration: string;
  transcript_available: 0 | 1;
  content_source: ContentSource;
  fetched_at: string;
  read: 0 | 1;
  saved_drive: 0 | 1;
  transcript_text: string | null;
  channel_thumb: string;
}

// Fonte externa retornada pelo grounding do Gemini (Google Search) na
// checagem de fatos.
export interface Source {
  title: string;
  uri: string;
}

// 'ask'      = pergunta do usuário respondida pela transcrição/vídeo;
// 'factcheck'= checagem externa (corrobora/desmente) + aprofundamento via web.
export type QAKind = 'ask' | 'factcheck';

export interface QAItem {
  id: number;
  kind: QAKind;
  question: string;
  answer: string;
  sources: Source[]; // vazio em 'ask'; preenchido na checagem externa
  saved_note: 0 | 1; // 1 = já incluído na nota do Obsidian/Drive
  created_at: string;
}

export type Period = 'day' | 'week' | 'month';

export interface Transcript {
  available: boolean;
  text: string;
  segments: { ts: string; text: string }[];
}

export interface GoogleUser {
  email: string;
  name: string;
  photo: string | null;
}
