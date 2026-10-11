// Planejamento da sessão diária: revisões vencidas + palavras novas, estimativa de
// minutos, teto de tempo e limite de revisões.
import { WORDS, getItem, pillarById } from './content';
import { type CardRow, type LogRow, type Settings, endOfDay, localDate } from './db';
import { retrievability } from './srs';

export type StepKind = 'review' | 'pillar' | 'learn' | 'quiz' | 'retry';

export interface Step {
  kind: StepKind;
  itemId: string;
}

export interface SessionPlan {
  date: string;
  startedAt: number;
  steps: Step[];
  pos: number;
  finished: boolean;
}

export interface Pace {
  reviewSec: number;
  newSec: number;
  quizSec: number;
  /** true quando já usa a média real do usuário (7 dias ou mais de histórico). */
  personal: boolean;
}

export const DEFAULT_PACE: Pace = { reviewSec: 10, newSec: 40, quizSec: 90, personal: false };

export interface DayPreview {
  reviews: string[];
  dueTotal: number;
  newWords: string[];
  pillars: string[];
  seconds: number;
  /** Explicação quando o app reduziu as novas ou adiou revisões. */
  notes: string[];
}

/** Ritmo do usuário: depois de 7 dias com estudo, usa a média real de tempo. */
export function computePace(logs: LogRow[]): Pace {
  const days = new Set(logs.map((l) => l.day));
  if (days.size < 7) return DEFAULT_PACE;
  const sum = (kinds: string[]) =>
    logs.filter((l) => kinds.includes(l.kind)).reduce((s, l) => s + Math.min(l.duration_ms, 120_000), 0) / 1000;
  const reviews = logs.filter((l) => l.kind === 'review').length;
  const learned = logs.filter((l) => l.kind === 'learn' || l.kind === 'pillar').length;
  return {
    reviewSec: reviews ? sum(['review']) / reviews : DEFAULT_PACE.reviewSec,
    // Na média pessoal, o tempo do quiz e das repetições já entra no tempo por palavra nova.
    newSec: learned ? sum(['learn', 'pillar', 'quiz', 'retry']) / learned : DEFAULT_PACE.newSec,
    quizSec: 0,
    personal: true,
  };
}

export function estimateSeconds(nReviews: number, nNew: number, pace: Pace): number {
  return nReviews * pace.reviewSec + nNew * pace.newSec + (nNew > 0 ? pace.quizSec : 0);
}

/** Próximas palavras ainda não vistas, em ordem de frequência. */
export function nextNewWords(cards: Map<string, CardRow>, count: number, exclude: Set<string> = new Set()): string[] {
  const out: string[] = [];
  for (const w of WORDS) {
    if (out.length >= count) break;
    if (!cards.has(w.id) && !exclude.has(w.id)) out.push(w.id);
  }
  return out;
}

/** Pilares que precisam vir antes destas palavras (ainda não vistos). */
export function pillarsFor(wordIds: string[], cards: Map<string, CardRow>, already: Set<string> = new Set()): Map<string, string> {
  const out = new Map<string, string>();
  for (const id of wordIds) {
    const item = getItem(id);
    const p = item?.kind === 'word' ? item.word.pillar : null;
    if (p && pillarById.has(p) && !cards.has(p) && !already.has(p) && ![...out.values()].includes(p)) out.set(id, p);
  }
  return out;
}

export function previewDay(cardList: CardRow[], settings: Settings, pace: Pace, now = Date.now()): DayPreview {
  const cards = new Map(cardList.map((c) => [c.item_id, c]));
  const limit = endOfDay(now);
  const notes: string[] = [];

  const due = cardList
    .filter((c) => !c.known && c.due <= limit && getItem(c.item_id))
    .map((c) => ({ id: c.item_id, r: retrievability(c, now, settings.retention) }))
    .sort((a, b) => a.r - b.r);
  const reviews = due.slice(0, settings.max_reviews).map((d) => d.id);
  if (due.length > reviews.length) {
    notes.push(`${due.length - reviews.length} revisões ficam para amanhã (limite de ${settings.max_reviews} por sessão).`);
  }

  let newWords = nextNewWords(cards, settings.new_per_day);
  const cap = settings.cap_minutes * 60;
  const total = (ids: string[]) => ids.length + pillarsFor(ids, cards).size;
  const wanted = newWords.length;
  while (newWords.length > 0 && estimateSeconds(reviews.length, total(newWords), pace) > cap) {
    newWords = newWords.slice(0, -1);
  }
  if (newWords.length < wanted) {
    notes.push(
      newWords.length === 0
        ? `Hoje só revisões: elas já ocupam o teto de ${settings.cap_minutes} min.`
        : `Palavras novas reduzidas para ${newWords.length} para caber em ${settings.cap_minutes} min.`,
    );
  }
  const pillars = [...pillarsFor(newWords, cards).values()];
  return {
    reviews,
    dueTotal: due.length,
    newWords,
    pillars,
    seconds: estimateSeconds(reviews.length, newWords.length + pillars.length, pace),
    notes,
  };
}

export function buildPlan(preview: DayPreview, cardList: CardRow[], now = Date.now()): SessionPlan {
  const cards = new Map(cardList.map((c) => [c.item_id, c]));
  const pillarBefore = pillarsFor(preview.newWords, cards);
  const steps: Step[] = preview.reviews.map((id) => ({ kind: 'review' as const, itemId: id }));
  const quiz: Step[] = [];
  for (const id of preview.newWords) {
    const p = pillarBefore.get(id);
    if (p) {
      steps.push({ kind: 'pillar', itemId: p });
      quiz.push({ kind: 'quiz', itemId: p });
    }
    steps.push({ kind: 'learn', itemId: id });
    quiz.push({ kind: 'quiz', itemId: id });
  }
  steps.push(...shuffle(quiz));
  return { date: localDate(now), startedAt: now, steps, pos: 0, finished: steps.length === 0 };
}

/**
 * "Já conheço": tira a palavra do quiz e puxa a próxima da lista
 * (com o pilar dela, se for o caso), logo depois do passo atual.
 */
export function replaceKnown(plan: SessionPlan, itemId: string, cards: Map<string, CardRow>): SessionPlan {
  const steps = plan.steps.filter((s, i) => !(i > plan.pos && s.itemId === itemId && s.kind === 'quiz'));
  const inPlan = new Set(steps.map((s) => s.itemId));
  const [next] = nextNewWords(cards, 1, inPlan);
  if (next) {
    const insert: Step[] = [];
    const p = pillarsFor([next], cards, inPlan).get(next);
    if (p) insert.push({ kind: 'pillar', itemId: p });
    insert.push({ kind: 'learn', itemId: next });
    steps.splice(plan.pos + 1, 0, ...insert);
    const lastQuiz = steps.map((s) => s.kind).lastIndexOf('quiz');
    const quizSteps: Step[] = [...(p ? [{ kind: 'quiz' as const, itemId: p }] : []), { kind: 'quiz', itemId: next }];
    steps.splice(lastQuiz >= 0 ? lastQuiz + 1 : steps.length, 0, ...quizSteps);
  }
  return { ...plan, steps };
}

export function shuffle<T>(arr: T[], rnd: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
