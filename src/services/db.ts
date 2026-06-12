// Estado e cache em SQLite — espelha as colunas principais da tabela `videos`
// do store.py do desktop. Idempotência: vídeo já analisado não é reprocessado.
import * as SQLite from 'expo-sqlite';

import type { Analysis, ContentSource, QAItem, VideoRecord } from '../types';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS videos (
    video_id TEXT PRIMARY KEY,
    channel TEXT, channel_id TEXT,
    original_title TEXT, neutral_title TEXT,
    url TEXT, published_at TEXT, duration TEXT,
    pillar TEXT, score INTEGER, is_clickbait INTEGER,
    resumo TEXT, pontos_chave TEXT, fatos TEXT, citacoes TEXT,
    transcript_available INTEGER,
    content_source TEXT,
    fetched_at TEXT,
    read INTEGER DEFAULT 0,
    saved_drive INTEGER DEFAULT 0,
    transcript_text TEXT,
    channel_thumb TEXT
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS qa (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_qa_video ON qa(video_id, id);
`;

const JSON_FIELDS = ['pontos_chave', 'fatos', 'citacoes'] as const;
const FLAGS = ['read', 'saved_drive'] as const;
export type Flag = (typeof FLAGS)[number];

let db: SQLite.SQLiteDatabase | null = null;

function conn(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('aspis.db');
    db.execSync(SCHEMA);
  }
  return db;
}

export function init(): void {
  conn();
}

export function nowIso(): string {
  return new Date().toISOString();
}

function rowToRecord(row: Record<string, unknown>): VideoRecord {
  const d = { ...row } as Record<string, unknown>;
  for (const f of JSON_FIELDS) {
    const raw = d[f];
    try {
      d[f] = raw ? JSON.parse(String(raw)) : [];
    } catch {
      d[f] = [];
    }
  }
  return d as unknown as VideoRecord;
}

export function hasVideo(videoId: string): boolean {
  const row = conn().getFirstSync<{ n: number }>(
    'SELECT 1 AS n FROM videos WHERE video_id = ?',
    [videoId],
  );
  return row != null;
}

export function getVideo(videoId: string): VideoRecord | null {
  const row = conn().getFirstSync<Record<string, unknown>>(
    'SELECT * FROM videos WHERE video_id = ?',
    [videoId],
  );
  return row ? rowToRecord(row) : null;
}

export interface UpsertInput extends Analysis {
  video_id: string;
  channel: string;
  channel_id: string;
  original_title: string;
  url: string;
  published_at: string;
  duration: string;
  transcript_available: 0 | 1;
  content_source: ContentSource;
  transcript_text?: string | null;
  channel_thumb?: string;
}

export function upsertVideo(v: UpsertInput): void {
  const cols = [
    'video_id', 'channel', 'channel_id', 'original_title', 'neutral_title',
    'url', 'published_at', 'duration', 'pillar', 'score', 'is_clickbait',
    'resumo', 'pontos_chave', 'fatos', 'citacoes', 'transcript_available',
    'content_source', 'fetched_at', 'transcript_text', 'channel_thumb',
  ];
  const record: Record<string, unknown> = {
    ...v,
    pontos_chave: JSON.stringify(v.pontos_chave ?? []),
    fatos: JSON.stringify(v.fatos ?? []),
    citacoes: JSON.stringify(v.citacoes ?? []),
    fetched_at: nowIso(),
    transcript_text: v.transcript_text ?? null,
    channel_thumb: v.channel_thumb ?? '',
  };
  const placeholders = cols.map(() => '?').join(', ');
  const updates = cols
    .filter((c) => c !== 'video_id')
    .map((c) => `${c}=excluded.${c}`)
    .join(', ');
  conn().runSync(
    `INSERT INTO videos (${cols.join(', ')}) VALUES (${placeholders}) ` +
      `ON CONFLICT(video_id) DO UPDATE SET ${updates}`,
    cols.map((c) => (record[c] ?? null) as SQLite.SQLiteBindValue),
  );
}

export interface VideoQuery {
  pillar?: string | null;
  minScore?: number;
  sinceIso?: string | null;
  includeRead?: boolean;
}

export function getVideos(q: VideoQuery = {}): VideoRecord[] {
  let sql = 'SELECT * FROM videos WHERE score >= ?';
  const args: SQLite.SQLiteBindValue[] = [q.minScore ?? 0];
  if (!q.includeRead) sql += ' AND COALESCE(read, 0) = 0';
  if (q.pillar) {
    sql += ' AND pillar = ?';
    args.push(q.pillar);
  }
  if (q.sinceIso) {
    sql += ' AND published_at >= ?';
    args.push(q.sinceIso);
  }
  sql += ' ORDER BY score DESC, published_at DESC';
  return conn()
    .getAllSync<Record<string, unknown>>(sql, args)
    .map(rowToRecord);
}

export function countBelow(minScore: number, sinceIso?: string | null): number {
  let sql = 'SELECT COUNT(*) AS n FROM videos WHERE score < ?';
  const args: SQLite.SQLiteBindValue[] = [minScore];
  if (sinceIso) {
    sql += ' AND published_at >= ?';
    args.push(sinceIso);
  }
  return conn().getFirstSync<{ n: number }>(sql, args)?.n ?? 0;
}

export function setFlag(videoId: string, field: Flag, value: 0 | 1): void {
  if (!FLAGS.includes(field)) throw new Error(`campo não permitido: ${field}`);
  conn().runSync(`UPDATE videos SET ${field} = ? WHERE video_id = ?`, [value, videoId]);
}

export function deleteVideo(videoId: string): void {
  conn().runSync('DELETE FROM videos WHERE video_id = ?', [videoId]);
  conn().runSync('DELETE FROM qa WHERE video_id = ?', [videoId]);
}

export function setTranscriptText(videoId: string, text: string): void {
  conn().runSync('UPDATE videos SET transcript_text = ? WHERE video_id = ?', [text, videoId]);
}

// --- Q&A por vídeo (estilo NotebookLM, como no desktop) ---------------------
export function addQa(videoId: string, question: string, answer: string): number {
  const res = conn().runSync(
    'INSERT INTO qa (video_id, question, answer, created_at) VALUES (?,?,?,?)',
    [videoId, question, answer, nowIso()],
  );
  return res.lastInsertRowId;
}

export function getQa(videoId: string): QAItem[] {
  return conn().getAllSync<QAItem>(
    'SELECT id, question, answer, created_at FROM qa WHERE video_id = ? ORDER BY id',
    [videoId],
  );
}

// --- meta (chave/valor) ------------------------------------------------------
export function getMeta(key: string): string | null {
  const row = conn().getFirstSync<{ value: string }>(
    'SELECT value FROM meta WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

export function setMeta(key: string, value: string): void {
  conn().runSync(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}
