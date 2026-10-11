// Repetição espaçada (FSRS via ts-fsrs). Intervalos sempre em dias: erros na mesma
// sessão são tratados pela fila da sessão, não pelo FSRS.
import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from 'ts-fsrs';
import type { CardRow } from './db';
import { nextLadder } from './ladder';

const schedulers = new Map<number, ReturnType<typeof fsrs>>();

function scheduler(retention: number) {
  let f = schedulers.get(retention);
  if (!f) {
    f = fsrs(generatorParameters({ request_retention: retention, enable_fuzz: true, enable_short_term: false }));
    schedulers.set(retention, f);
  }
  return f;
}

export function toCard(r: CardRow): Card {
  return {
    due: new Date(r.due),
    stability: r.stability,
    difficulty: r.difficulty,
    elapsed_days: r.elapsed_days,
    scheduled_days: r.scheduled_days,
    learning_steps: r.learning_steps,
    reps: r.reps,
    lapses: r.lapses,
    state: r.state,
    last_review: r.last_review ? new Date(r.last_review) : undefined,
  };
}

function fromCard(c: Card) {
  return {
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last_review ? c.last_review.getTime() : null,
  };
}

/** Cartão novo: entra na fila agora, no nível 1 da escada. */
export function newCardRow(itemId: string, now: number, known = false): CardRow {
  return {
    item_id: itemId,
    ...fromCard(createEmptyCard(new Date(now))),
    ladder_level: 1,
    ladder_streak: 0,
    known: known ? 1 : 0,
    updated_at: now,
    dirty: 1,
  };
}

/** Aplica a nota ao FSRS e à escada. */
export function review(row: CardRow, rating: Grade, now: number, retention: number): CardRow {
  const { card } = scheduler(retention).next(toCard(row), new Date(now), rating);
  const ladder = nextLadder({ level: row.ladder_level, streak: row.ladder_streak }, rating);
  return {
    ...row,
    ...fromCard(card),
    ladder_level: ladder.level,
    ladder_streak: ladder.streak,
    updated_at: now,
    dirty: 1,
  };
}

/** Chance de lembrar agora (0 a 1); cartões nunca avaliados contam como 0. */
export function retrievability(row: CardRow, now: number, retention: number): number {
  if (row.reps === 0 || !row.last_review) return 0;
  return scheduler(retention).get_retrievability(toCard(row), new Date(now), false);
}

export { Rating };
export type { Grade };
