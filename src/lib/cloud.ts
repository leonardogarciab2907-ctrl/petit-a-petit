// Nuvem (Supabase): login por e-mail e sincronização do progresso.
// O aparelho grava tudo primeiro no IndexedDB; aqui só se envia o que está marcado
// como pendente (dirty) e se baixa o que mudou desde a última vez.
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from '../config';
import { type CardRow, type LogRow, type StatRow, db, getKV, getSettings, setKV } from './db';

export const cloudEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);

export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export async function currentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function sendLoginEmail(email: string): Promise<string | null> {
  if (!supabase) return 'Nuvem não configurada.';
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin, shouldCreateUser: true },
  });
  return error ? translateAuthError(error.message) : null;
}

/** Código de 6 dígitos do e-mail: necessário no iPhone, onde o link abre no Safari e não no app instalado. */
export async function verifyCode(email: string, code: string): Promise<string | null> {
  if (!supabase) return 'Nuvem não configurada.';
  const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
  return error ? translateAuthError(error.message) : null;
}

function translateAuthError(msg: string): string {
  if (/rate limit|security purposes/i.test(msg)) return 'Muitos pedidos seguidos. Espere alguns minutos e tente de novo.';
  if (/expired|invalid/i.test(msg)) return 'Código inválido ou vencido. Peça um novo e-mail.';
  if (/email/i.test(msg)) return 'Confira o e-mail digitado.';
  return msg;
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
  await Promise.all([db.cards.clear(), db.logs.clear(), db.stats.clear(), db.kv.clear()]);
}

export async function pendingCount(): Promise<number> {
  const [c, l, s] = await Promise.all([
    db.cards.where('dirty').equals(1).count(),
    db.logs.where('dirty').equals(1).count(),
    db.stats.where('dirty').equals(1).count(),
  ]);
  return c + l + s + ((await getKV('settingsDirty', false)) ? 1 : 0);
}

// ---------- conversão local ⇄ nuvem ----------

const iso = (ms: number | null) => (ms == null ? null : new Date(ms).toISOString());
const ms = (s: string | null) => (s == null ? null : new Date(s).getTime());

function cardOut(c: CardRow) {
  return {
    item_id: c.item_id,
    due: iso(c.due),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: iso(c.last_review),
    ladder_level: c.ladder_level,
    ladder_streak: c.ladder_streak,
    known: !!c.known,
    updated_at: iso(c.updated_at),
  };
}

type Remote = Record<string, unknown>;

function cardIn(r: Remote): CardRow {
  return {
    item_id: r.item_id as string,
    due: ms(r.due as string)!,
    stability: r.stability as number,
    difficulty: r.difficulty as number,
    elapsed_days: r.elapsed_days as number,
    scheduled_days: r.scheduled_days as number,
    learning_steps: r.learning_steps as number,
    reps: r.reps as number,
    lapses: r.lapses as number,
    state: r.state as number,
    last_review: ms(r.last_review as string | null),
    ladder_level: r.ladder_level as number,
    ladder_streak: r.ladder_streak as number,
    known: r.known ? 1 : 0,
    updated_at: ms(r.updated_at as string)!,
    dirty: 0,
  };
}

function logOut(l: LogRow) {
  return {
    id: l.id,
    item_id: l.item_id,
    kind: l.kind,
    rating: l.rating,
    exercise_type: l.exercise_type,
    correct: l.correct,
    duration_ms: l.duration_ms,
    reviewed_at: iso(l.reviewed_at),
    day: l.day,
  };
}

function logIn(r: Remote): LogRow {
  return {
    id: r.id as string,
    item_id: r.item_id as string,
    kind: r.kind as LogRow['kind'],
    rating: r.rating as number,
    exercise_type: r.exercise_type as string,
    correct: r.correct as boolean | null,
    duration_ms: r.duration_ms as number,
    reviewed_at: ms(r.reviewed_at as string)!,
    day: r.day as string,
    dirty: 0,
  };
}

function statOut(s: StatRow) {
  return {
    date: s.date,
    reviews: s.reviews,
    new_items: s.new_items,
    minutes: s.minutes,
    accuracy: s.accuracy,
    done: !!s.done,
    updated_at: iso(s.updated_at),
  };
}

function statIn(r: Remote): StatRow {
  return {
    date: r.date as string,
    reviews: r.reviews as number,
    new_items: r.new_items as number,
    minutes: r.minutes as number,
    accuracy: r.accuracy as number | null,
    done: r.done ? 1 : 0,
    updated_at: ms(r.updated_at as string)!,
    dirty: 0,
  };
}

// ---------- sincronização ----------

let running: Promise<SyncResult> | null = null;

export interface SyncResult {
  ok: boolean;
  message: string;
}

/** Envia a fila e baixa as mudanças. Seguro chamar várias vezes: só roda uma de cada vez. */
export function sync(): Promise<SyncResult> {
  if (!running) running = doSync().finally(() => (running = null));
  return running;
}

async function doSync(): Promise<SyncResult> {
  if (!supabase) return { ok: false, message: 'Só neste aparelho' };
  if (!navigator.onLine) return { ok: false, message: 'Sem internet: salvo no aparelho' };
  const session = await currentSession();
  if (!session) return { ok: false, message: 'Faça login para sincronizar' };
  try {
    await push(supabase);
    await pull(supabase);
    await setKV('lastSync', Date.now());
    return { ok: true, message: 'Sincronizado' };
  } catch (e) {
    console.warn('sync', e);
    return { ok: false, message: 'Falha ao sincronizar: tento de novo depois' };
  }
}

const BATCH = 500;

async function push(sb: SupabaseClient) {
  // Revisões: só inserções; o id (UUID gerado no aparelho) evita duplicar.
  const logs = await db.logs.where('dirty').equals(1).toArray();
  for (let i = 0; i < logs.length; i += BATCH) {
    const part = logs.slice(i, i + BATCH);
    const { error } = await sb.from('review_log').upsert(part.map(logOut), { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw error;
    await db.logs.bulkUpdate(part.map((l) => ({ key: l.id, changes: { dirty: 0 as const } })));
  }

  // Estado dos cartões: no servidor fica a versão com updated_at mais recente.
  const cards = await db.cards.where('dirty').equals(1).toArray();
  for (let i = 0; i < cards.length; i += BATCH) {
    const part = cards.slice(i, i + BATCH);
    const { error } = await sb.rpc('sync_card_states', { payload: part.map(cardOut) });
    if (error) throw error;
    await markClean(db.cards, part.map((c) => [c.item_id, c.updated_at]));
  }

  const stats = await db.stats.where('dirty').equals(1).toArray();
  if (stats.length) {
    const { error } = await sb.rpc('sync_daily_stats', { payload: stats.map(statOut) });
    if (error) throw error;
    await markClean(db.stats, stats.map((s) => [s.date, s.updated_at]));
  }

  if (await getKV('settingsDirty', false)) {
    const s = await getSettings();
    const { error } = await sb.rpc('sync_settings', {
      payload: {
        new_per_day: s.new_per_day,
        retention: s.retention,
        cap_minutes: s.cap_minutes,
        max_reviews: s.max_reviews,
        audio_rate: s.audio_rate,
        updated_at: iso(s.updated_at || Date.now()),
      },
    });
    if (error) throw error;
    await setKV('settingsDirty', false);
  }
}

/** Só limpa a marca se a linha não mudou durante o envio. */
async function markClean<T extends { updated_at: number; dirty: 0 | 1 }>(
  table: import('dexie').Table<T, string>,
  keys: [string, number][],
) {
  await db.transaction('rw', table, async () => {
    for (const [key, updated] of keys) {
      const row = await table.get(key);
      if (row && row.updated_at === updated) await table.update(key, { dirty: 0 } as never);
    }
  });
}

async function fetchSince(sb: SupabaseClient, table: string, cursor: string | null): Promise<Remote[]> {
  const out: Remote[] = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select('*').order('synced_at', { ascending: true }).range(from, from + 999);
    // Margem de 1 min para não perder linhas gravadas por transações simultâneas; repetir é inofensivo.
    if (cursor) q = q.gt('synced_at', new Date(new Date(cursor).getTime() - 60_000).toISOString());
    const { data, error } = await q;
    if (error) throw error;
    out.push(...(data as Remote[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const maxCursor = (rows: Remote[], prev: string | null) =>
  rows.reduce<string | null>((m, r) => (!m || (r.synced_at as string) > m ? (r.synced_at as string) : m), prev);

async function pull(sb: SupabaseClient) {
  const cursors = await getKV<Record<string, string | null>>('cursors', {});

  const cards = await fetchSince(sb, 'card_state', cursors.card_state ?? null);
  await db.transaction('rw', db.cards, async () => {
    for (const r of cards) {
      const incoming = cardIn(r);
      const local = await db.cards.get(incoming.item_id);
      if (!local || local.updated_at < incoming.updated_at) await db.cards.put(incoming);
    }
  });

  const logs = await fetchSince(sb, 'review_log', cursors.review_log ?? null);
  await db.transaction('rw', db.logs, async () => {
    for (const r of logs) if (!(await db.logs.get(r.id as string))) await db.logs.put(logIn(r));
  });

  const stats = await fetchSince(sb, 'daily_stats', cursors.daily_stats ?? null);
  await db.transaction('rw', db.stats, async () => {
    for (const r of stats) {
      const incoming = statIn(r);
      const local = await db.stats.get(incoming.date);
      if (!local) await db.stats.put(incoming);
      else
        await db.stats.put({
          ...local,
          reviews: Math.max(local.reviews, incoming.reviews),
          new_items: Math.max(local.new_items, incoming.new_items),
          minutes: Math.max(local.minutes, incoming.minutes),
          accuracy: local.accuracy ?? incoming.accuracy,
          done: local.done || incoming.done ? 1 : 0,
        });
    }
  });

  const { data: settingsRows, error } = await sb.from('settings').select('*').limit(1);
  if (error) throw error;
  const remote = settingsRows?.[0] as Remote | undefined;
  if (remote) {
    const local = await getSettings();
    const remoteTime = ms(remote.updated_at as string) ?? 0;
    if (remoteTime > local.updated_at) {
      await setKV('settings', {
        ...local,
        new_per_day: remote.new_per_day,
        retention: remote.retention,
        cap_minutes: remote.cap_minutes,
        max_reviews: remote.max_reviews,
        audio_rate: remote.audio_rate,
        updated_at: remoteTime,
      });
    }
  }

  await setKV('cursors', {
    card_state: maxCursor(cards, cursors.card_state ?? null),
    review_log: maxCursor(logs, cursors.review_log ?? null),
    daily_stats: maxCursor(stats, cursors.daily_stats ?? null),
  });
}
