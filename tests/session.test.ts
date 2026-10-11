import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { WORDS } from '../src/lib/content';
import { DEFAULT_SETTINGS, db } from '../src/lib/db';
import { answer, computePreview, getSavedPlan, learn, startSession } from '../src/lib/engine';
import { DEFAULT_PACE, estimateSeconds, previewDay } from '../src/lib/session';
import { Rating, newCardRow } from '../src/lib/srs';

beforeEach(async () => {
  await Promise.all([db.cards.clear(), db.logs.clear(), db.stats.clear(), db.kv.clear()]);
});

describe('estimativa e limites', () => {
  it('25 revisões + 8 novas ≈ 11 min', () => {
    expect(Math.round(estimateSeconds(25, 8, DEFAULT_PACE) / 60)).toBe(11);
  });
  it('reduz as novas para caber em 15 min e limita a 80 revisões', () => {
    const now = Date.now();
    const due = WORDS.slice(0, 100).map((w) => ({ ...newCardRow(w.id, now - 86400000), reps: 1, stability: 2, state: 2, last_review: now - 3 * 86400000 }));
    const p = previewDay(due, DEFAULT_SETTINGS, DEFAULT_PACE, now);
    expect(p.reviews).toHaveLength(80);
    expect(p.newWords).toHaveLength(0);
    expect(p.notes).toHaveLength(2);
    const few = previewDay(due.slice(0, 60), DEFAULT_SETTINGS, DEFAULT_PACE, now);
    expect(few.newWords.length).toBeLessThan(8);
    expect(few.seconds).toBeLessThanOrEqual(15 * 60);
  });
});

describe('sessão', () => {
  it('primeiro dia: pilares antes das palavras, 8 novas e o mini quiz', async () => {
    const plan = await startSession();
    const learns = plan.steps.filter((s) => s.kind === 'learn');
    expect(learns.map((s) => s.itemId)).toEqual(WORDS.slice(0, 8).map((w) => w.id));
    expect(plan.steps[0]).toEqual({ kind: 'pillar', itemId: 'p-pronomes' });
    const pillars = plan.steps.filter((s) => s.kind === 'pillar').length;
    expect(plan.steps.filter((s) => s.kind === 'quiz')).toHaveLength(8 + pillars);
  });

  it('uma palavra errada volta no fim, e o dia só conta quando termina', async () => {
    let plan = await startSession();
    while (plan.steps[plan.pos].kind !== 'quiz') plan = await learn(plan, false, 1000);
    const wrongId = plan.steps[plan.pos].itemId;
    plan = await answer(plan, { rating: Rating.Again, correct: false, exerciseType: 'choose-pt' }, 1000);
    expect(plan.steps.at(-1)).toEqual({ kind: 'retry', itemId: wrongId });
    while (!plan.finished) {
      plan = await answer(plan, { rating: Rating.Good, correct: true, exerciseType: 'choose-pt' }, 1000);
      expect((await db.stats.get(plan.date))?.done).toBe(plan.finished ? 1 : 0);
    }
    // Depois de terminar, o dia de hoje não oferece mais nada.
    const p = await computePreview();
    expect(p.newWords).toHaveLength(0);
    expect(p.reviews).toHaveLength(0);
  });

  it('"já conheço" puxa a próxima palavra da lista', async () => {
    let plan = await startSession();
    while (plan.steps[plan.pos].kind !== 'learn') plan = await learn(plan, false, 1000);
    const first = plan.steps[plan.pos].itemId;
    plan = await learn(plan, true, 500);
    expect(plan.steps.some((s) => s.kind === 'quiz' && s.itemId === first)).toBe(false);
    const learns = plan.steps.filter((s) => s.kind === 'learn').map((s) => s.itemId);
    expect(learns).toContain(WORDS[8].id);
    expect((await db.cards.get(first))?.known).toBe(1);
  });

  it('se o app fechar no meio, a sessão continua de onde parou', async () => {
    let plan = await startSession();
    plan = await learn(plan, false, 1000);
    plan = await learn(plan, false, 1000);
    expect((await getSavedPlan())?.pos).toBe(2);
    expect((await startSession()).pos).toBe(2);
  });
});
