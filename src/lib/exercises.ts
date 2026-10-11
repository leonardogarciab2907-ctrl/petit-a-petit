// Monta o exercício de cada passo conforme o nível da escada.
// Nível 1 reconhecer · 2 lembrar · 3 produzir (o exercício de falar entra na fase 2).
import { WORDS, getItem, meaning, wordLabel } from './content';
import { chunks, normApos, surface } from './text';
import { shuffle } from './session';
import type { Pillar, PillarDrill, Sentence, Word } from './types';

export type ExerciseType =
  | 'reveal'
  | 'listen'
  | 'choose-pt'
  | 'mc-fr'
  | 'cloze'
  | 'type'
  | 'build'
  | 'pillar-reveal'
  | 'pillar-cloze'
  | 'pillar-build';

export interface Choice {
  options: string[];
  answer: number;
}

export type Exercise =
  | { type: 'reveal'; word: Word; sentence: Sentence | null }
  | ({ type: 'listen' | 'choose-pt' | 'mc-fr'; word: Word } & Choice)
  | ({ type: 'cloze'; word: Word; sentence: Sentence; before: string; after: string } & Choice)
  | { type: 'type'; word: Word }
  | { type: 'build'; word: Word | null; pillar: Pillar | null; fr: string; pt: string; pieces: string[]; answers: string[] }
  | { type: 'pillar-reveal'; pillar: Pillar; example: { fr: string; pt: string } }
  | ({ type: 'pillar-cloze'; pillar: Pillar; drill: PillarDrill } & Choice);

export interface ExerciseContext {
  /** Itens já vistos pelo usuário (para preferir distratores conhecidos). */
  seen: Set<string>;
  tts: boolean;
  rnd?: () => number;
}

const pick = <T>(arr: T[], rnd: () => number): T => arr[Math.floor(rnd() * arr.length)];

/** Exercício para o item no nível dado. `quiz` = mini quiz de reconhecimento das novas. */
export function makeExercise(itemId: string, level: number, ctx: ExerciseContext, quiz = false): Exercise | null {
  const rnd = ctx.rnd ?? Math.random;
  const item = getItem(itemId);
  if (!item) return null;
  if (item.kind === 'pillar') return pillarExercise(item.pillar, quiz ? 1 : level, ctx, rnd);
  const w = item.word;
  if (quiz) return choice(w, ctx.tts && rnd() < 0.5 ? 'listen' : 'choose-pt', ctx, rnd);

  const lvl = Math.min(3, Math.max(1, level));
  const options: (() => Exercise | null)[] =
    lvl === 1
      ? [() => ({ type: 'reveal', word: w, sentence: w.sentences[0] ?? null }), () => choice(w, ctx.tts ? 'listen' : 'choose-pt', ctx, rnd)]
      : lvl === 2
        ? [() => choice(w, 'mc-fr', ctx, rnd), () => cloze(w, ctx, rnd)]
        : [() => ({ type: 'type', word: w }), () => build(w, ctx, rnd)];
  for (const make of shuffle(options, rnd)) {
    const ex = make();
    if (ex) return ex;
  }
  return { type: 'reveal', word: w, sentence: w.sentences[0] ?? null };
}

/** Outras palavras para as opções: mesma classe, de preferência já vistas, sem repetir sentido. */
function distractors(w: Word, n: number, ctx: ExerciseContext, rnd: () => number): Word[] {
  const ok = (o: Word) => o.id !== w.id && meaning(o, 1) !== meaning(w, 1) && wordLabel(o) !== wordLabel(w);
  const samePos = WORDS.filter((o) => ok(o) && o.pos === w.pos);
  const seen = shuffle(samePos.filter((o) => ctx.seen.has(o.id)), rnd);
  const near = samePos.filter((o) => !ctx.seen.has(o.id)).sort((a, b) => Math.abs(a.rank - w.rank) - Math.abs(b.rank - w.rank));
  const any = shuffle(WORDS.filter((o) => ok(o) && o.rank <= Math.max(60, w.rank + 30)), rnd);
  const out: Word[] = [];
  for (const o of [...seen, ...near.slice(0, 10), ...any]) {
    if (out.length >= n) break;
    if (!out.includes(o) && !out.some((x) => meaning(x, 1) === meaning(o, 1))) out.push(o);
  }
  return out;
}

function choice(w: Word, type: 'listen' | 'choose-pt' | 'mc-fr', ctx: ExerciseContext, rnd: () => number): Exercise | null {
  const others = distractors(w, 3, ctx, rnd);
  if (others.length < 2) return null;
  const all = shuffle([w, ...others], rnd);
  const label = type === 'mc-fr' ? wordLabel : (o: Word) => meaning(o, 2);
  return { type, word: w, options: all.map(label), answer: all.indexOf(w) };
}

/** Localiza a palavra (ou uma forma dela) dentro da frase, como palavra inteira. */
export function findSurface(fr: string, w: Word): { start: number; end: number } | null {
  const text = normApos(fr).toLowerCase();
  const cands = [surface(w.lemma), ...w.forms.map(surface)]
    .map((f) => normApos(f).toLowerCase())
    .sort((a, b) => b.length - a.length);
  const isLetter = (ch: string | undefined) => !!ch && /[\p{L}\p{N}]/u.test(ch);
  for (const c of cands) {
    let from = 0;
    for (;;) {
      const i = text.indexOf(c, from);
      if (i < 0) break;
      const okBefore = i === 0 || !isLetter(text[i - 1]);
      const okAfter = c.endsWith("'") || !isLetter(text[i + c.length]);
      if (okBefore && okAfter) return { start: i, end: i + c.length };
      from = i + 1;
    }
  }
  return null;
}

function cloze(w: Word, ctx: ExerciseContext, rnd: () => number): Exercise | null {
  for (const s of shuffle(w.sentences, rnd)) {
    const pos = findSurface(s.fr, w);
    if (!pos) continue;
    const shown = s.fr.slice(pos.start, pos.end);
    const wrong = clozeDistractors(w, shown, ctx, rnd);
    if (wrong.length < 2) continue;
    const capital = pos.start === 0;
    const fix = (x: string) => (capital ? x.charAt(0).toUpperCase() + x.slice(1) : x.toLowerCase());
    const opts = shuffle([shown, ...wrong.map(fix)], rnd);
    return {
      type: 'cloze',
      word: w,
      sentence: s,
      before: s.fr.slice(0, pos.start),
      after: s.fr.slice(pos.end),
      options: opts,
      answer: opts.indexOf(shown),
    };
  }
  return null;
}

function clozeDistractors(w: Word, shown: string, ctx: ExerciseContext, rnd: () => number): string[] {
  const low = normApos(shown).toLowerCase();
  const out: string[] = [];
  const add = (x: string | undefined) => {
    const v = x?.replace(/_/g, ' ');
    if (v && v.toLowerCase() !== low && !out.some((o) => o.toLowerCase() === v.toLowerCase())) out.push(v);
  };
  if (w.pos === 'verbo') {
    const idx = w.forms.map((f) => f.toLowerCase()).indexOf(low);
    const verbs = distractors(w, 6, ctx, rnd).filter((o) => o.pos === 'verbo' && o.forms.length >= 6);
    if (idx >= 0 && idx < 6) {
      for (const v of verbs.slice(0, 2)) add(v.forms[idx]);
      add(pick(w.forms.slice(0, 6).filter((f) => f.toLowerCase() !== low), rnd));
    } else {
      for (const v of verbs) add(surface(v.lemma));
    }
  } else if (w.display) {
    // Família (le, la, les): as outras formas da família são as melhores opções.
    for (const f of shuffle([surface(w.lemma), ...w.forms], rnd)) add(f);
  }
  for (const o of distractors(w, 6, ctx, rnd)) add(surface(o.lemma));
  return out.slice(0, 3);
}

function build(w: Word, ctx: ExerciseContext, rnd: () => number): Exercise | null {
  const usable = w.sentences.filter((s) => chunks(s.fr).length >= 3);
  if (!usable.length) return null;
  const s = pick(usable, rnd);
  return buildFrom(s.fr, s.pt, s.accepted, w, null, ctx, rnd);
}

function buildFrom(fr: string, pt: string, accepted: string[], w: Word | null, p: Pillar | null, ctx: ExerciseContext, rnd: () => number): Exercise {
  const pieces = chunks(fr);
  const lower = pieces.map((c, i) => (i === 0 && c !== c.toUpperCase() ? c.charAt(0).toLowerCase() + c.slice(1) : c));
  const present = new Set(lower.map((c) => c.toLowerCase()));
  // Uma peça extra de distração, tirada de frases de palavras já vistas.
  const known = WORDS.filter((o) => ctx.seen.has(o.id));
  const pool = (known.length >= 5 ? known : WORDS.slice(0, 20))
    .flatMap((o) => o.sentences)
    .flatMap((s) => chunks(s.fr).slice(1))
    .filter((c) => !present.has(c.toLowerCase()) && c.length > 1);
  const extra = pool.length ? [pick(pool, rnd).toLowerCase()] : [];
  return { type: 'build', word: w, pillar: p, fr, pt, pieces: shuffle([...lower, ...extra], rnd), answers: [fr, ...accepted] };
}

function pillarExercise(p: Pillar, level: number, ctx: ExerciseContext, rnd: () => number): Exercise {
  const sentences = [...p.examples, ...p.practice.map((d) => ({ fr: d.fr.replace('___', d.answer), pt: d.pt }))];
  if (level >= 3) {
    const long = sentences.filter((x) => chunks(x.fr).length >= 3);
    const s = pick(long.length ? long : sentences, rnd);
    return buildFrom(s.fr, s.pt, [], null, p, ctx, rnd);
  }
  if (level === 2 && p.practice.length) {
    const drill = pick(p.practice, rnd);
    const opts = shuffle([drill.answer, ...drill.options.slice(0, 3)], rnd);
    return { type: 'pillar-cloze', pillar: p, drill, options: opts, answer: opts.indexOf(drill.answer) };
  }
  return { type: 'pillar-reveal', pillar: p, example: pick(sentences, rnd) };
}
