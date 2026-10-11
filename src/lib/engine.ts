// Execução da sessão: grava cada resposta no aparelho na hora (para continuar de onde
// parou), aplica FSRS e escada, repete os erros no fim e marca o dia como feito.
import { getItem } from './content';
import { type CardRow, type LogKind, db, getKV, getSettings, localDate, refreshDayStats, setKV, uuid } from './db';
import { type DayPreview, type SessionPlan, buildPlan, computePace, previewDay, replaceKnown } from './session';
import { type Grade, Rating, newCardRow, review } from './srs';

const SESSION_KEY = 'session';

export interface Outcome {
  rating: Grade;
  correct: boolean;
  exerciseType: string;
}

export async function allCards(): Promise<CardRow[]> {
  return db.cards.toArray();
}

/** Palavras novas aprendidas hoje (sem contar as marcadas como "já conheço"). */
async function learnedToday(day: string): Promise<number> {
  return db.logs
    .where('day')
    .equals(day)
    .filter((l) => l.kind === 'learn' && l.exercise_type === 'learn')
    .count();
}

export async function getSavedPlan(): Promise<SessionPlan | null> {
  const plan = await getKV<SessionPlan | null>(SESSION_KEY, null);
  if (!plan || plan.finished || plan.date !== localDate()) return null;
  return plan;
}

export async function savePlan(plan: SessionPlan): Promise<void> {
  await setKV(SESSION_KEY, plan);
}

/** Tamanho do dia mostrado na tela inicial (revisões vencidas + novas que ainda faltam hoje). */
export async function computePreview(): Promise<DayPreview> {
  const [cards, settings, logs] = await Promise.all([allCards(), getSettings(), db.logs.toArray()]);
  const done = await learnedToday(localDate());
  const pace = computePace(logs);
  return previewDay(cards, { ...settings, new_per_day: Math.max(0, settings.new_per_day - done) }, pace);
}

export async function startSession(): Promise<SessionPlan> {
  const saved = await getSavedPlan();
  if (saved) return saved;
  const preview = await computePreview();
  const plan = buildPlan(preview, await allCards());
  await savePlan(plan);
  return plan;
}

async function log(kind: LogKind, itemId: string, day: string, data: { rating: number; correct: boolean | null; exerciseType: string; durationMs: number }) {
  await db.logs.add({
    id: uuid(),
    item_id: itemId,
    kind,
    rating: data.rating,
    exercise_type: data.exerciseType,
    correct: data.correct,
    duration_ms: Math.min(Math.round(data.durationMs), 120_000),
    reviewed_at: Date.now(),
    day,
    dirty: 1,
  });
}

async function advance(plan: SessionPlan): Promise<SessionPlan> {
  const pos = plan.pos + 1;
  const next = { ...plan, pos, finished: pos >= plan.steps.length };
  await savePlan(next);
  await refreshDayStats(plan.date, next.finished);
  return next;
}

/** Resposta de um exercício (revisão, quiz ou repetição de erro). */
export async function answer(plan: SessionPlan, outcome: Outcome, durationMs: number): Promise<SessionPlan> {
  const step = plan.steps[plan.pos];
  const now = Date.now();
  const settings = await getSettings();
  // Só a primeira resposta do dia vai para o FSRS; a repetição do erro é só treino.
  if (step.kind === 'review' || step.kind === 'quiz') {
    const card = (await db.cards.get(step.itemId)) ?? newCardRow(step.itemId, now);
    await db.cards.put(review(card, outcome.rating, now, settings.retention));
  }
  await log(step.kind === 'retry' ? 'retry' : step.kind === 'quiz' ? 'quiz' : 'review', step.itemId, plan.date, {
    rating: outcome.rating,
    correct: outcome.correct,
    exerciseType: outcome.exerciseType,
    durationMs,
  });
  const steps = outcome.correct ? plan.steps : [...plan.steps, { kind: 'retry' as const, itemId: step.itemId }];
  return advance({ ...plan, steps });
}

/** Cartão de palavra nova ou de pilar visto. `known` = botão "já conheço". */
export async function learn(plan: SessionPlan, known: boolean, durationMs: number): Promise<SessionPlan> {
  const step = plan.steps[plan.pos];
  const now = Date.now();
  const existing = await db.cards.get(step.itemId);
  if (known || !existing) await db.cards.put(newCardRow(step.itemId, now, known));
  const isPillar = getItem(step.itemId)?.kind === 'pillar';
  await log(isPillar ? 'pillar' : 'learn', step.itemId, plan.date, {
    rating: Rating.Manual,
    correct: null,
    exerciseType: known ? 'known' : 'learn',
    durationMs,
  });
  let next = plan;
  if (known) {
    if (isPillar) {
      next = { ...plan, steps: plan.steps.filter((s, i) => !(i > plan.pos && s.itemId === step.itemId && s.kind === 'quiz')) };
    } else {
      const cards = new Map((await allCards()).map((c) => [c.item_id, c]));
      next = replaceKnown(plan, step.itemId, cards);
    }
  }
  return advance(next);
}

/** Totais da sessão para a tela final. */
export async function sessionSummary(plan: SessionPlan) {
  const logs = (await db.logs.where('day').equals(plan.date).toArray()).filter((l) => l.reviewed_at >= plan.startedAt);
  const firsts = logs.filter((l) => l.kind === 'review' || l.kind === 'quiz');
  const right = firsts.filter((l) => l.correct).length;
  return {
    answered: firsts.length,
    right,
    accuracy: firsts.length ? right / firsts.length : null,
    minutes: logs.reduce((s, l) => s + l.duration_ms, 0) / 60000,
    newWords: logs.filter((l) => l.kind === 'learn' && l.exercise_type === 'learn').length,
    reviews: logs.filter((l) => l.kind === 'review').length,
  };
}

/** Pula um passo cujo item não existe mais no conteúdo. */
export function skip(plan: SessionPlan): Promise<SessionPlan> {
  return advance(plan);
}
