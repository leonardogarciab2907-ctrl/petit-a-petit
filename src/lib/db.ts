// Banco local (IndexedDB via Dexie): fonte da verdade no aparelho. Linhas com dirty = 1
// formam a fila do que ainda não foi enviado ao Supabase.
import Dexie, { type Table } from 'dexie';

export interface CardRow {
  item_id: string;
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: number | null;
  ladder_level: number;
  ladder_streak: number;
  known: 0 | 1;
  updated_at: number;
  dirty: 0 | 1;
}

export type LogKind = 'review' | 'quiz' | 'retry' | 'learn' | 'pillar';

export interface LogRow {
  id: string;
  item_id: string;
  kind: LogKind;
  rating: number;
  exercise_type: string;
  correct: boolean | null;
  duration_ms: number;
  reviewed_at: number;
  /** Data local (AAAA-MM-DD) da sessão em que a resposta foi dada. */
  day: string;
  dirty: 0 | 1;
}

export interface StatRow {
  date: string;
  reviews: number;
  new_items: number;
  minutes: number;
  accuracy: number | null;
  done: 0 | 1;
  updated_at: number;
  dirty: 0 | 1;
}

export interface Settings {
  new_per_day: number;
  retention: number;
  cap_minutes: number;
  max_reviews: number;
  audio_rate: number;
  voice: string | null;
  updated_at: number;
}

export const DEFAULT_SETTINGS: Settings = {
  new_per_day: 8,
  retention: 0.9,
  cap_minutes: 15,
  max_reviews: 80,
  audio_rate: 0.9,
  voice: null,
  updated_at: 0,
};

export interface KV {
  key: string;
  value: unknown;
}

class AppDB extends Dexie {
  cards!: Table<CardRow, string>;
  logs!: Table<LogRow, string>;
  stats!: Table<StatRow, string>;
  kv!: Table<KV, string>;

  constructor() {
    super('petit-a-petit');
    this.version(1).stores({
      cards: '&item_id, due, dirty',
      logs: '&id, reviewed_at, day, item_id, dirty',
      stats: '&date, dirty',
      kv: '&key',
    });
  }
}

export const db = new AppDB();

export async function getKV<T>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setKV(key: string, value: unknown): Promise<void> {
  await db.kv.put({ key, value });
}

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await getKV<Partial<Settings>>('settings', {})) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch, updated_at: Date.now() };
  await setKV('settings', next);
  await setKV('settingsDirty', true);
  return next;
}

/** Data local no formato AAAA-MM-DD. */
export function localDate(ms: number = Date.now()): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function endOfDay(ms: number = Date.now()): number {
  const d = new Date(ms);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function uuid(): string {
  return crypto.randomUUID();
}

/** Recalcula o resumo do dia a partir das respostas registradas. */
export async function refreshDayStats(day: string, markDone = false): Promise<StatRow> {
  const logs = await db.logs.where('day').equals(day).toArray();
  const firsts = logs.filter((l) => l.kind === 'review' || l.kind === 'quiz');
  const right = firsts.filter((l) => l.correct).length;
  const prev = await db.stats.get(day);
  const row: StatRow = {
    date: day,
    reviews: logs.filter((l) => l.kind === 'review').length,
    new_items: logs.filter((l) => l.kind === 'learn' && l.exercise_type === 'learn').length,
    minutes: Math.round(logs.reduce((s, l) => s + l.duration_ms, 0) / 6000) / 10,
    accuracy: firsts.length ? Math.round((right / firsts.length) * 100) / 100 : null,
    done: markDone || prev?.done ? 1 : 0,
    updated_at: Date.now(),
    dirty: 1,
  };
  // Se outro aparelho já registrou mais estudo neste dia, fica o maior valor.
  if (prev) {
    row.reviews = Math.max(row.reviews, prev.reviews);
    row.new_items = Math.max(row.new_items, prev.new_items);
    row.minutes = Math.max(row.minutes, prev.minutes);
    row.accuracy = row.accuracy ?? prev.accuracy;
  }
  await db.stats.put(row);
  return row;
}
