// Conteúdo embutido no app: palavras em ordem de frequência e cartões de pilar.
import wordsJson from '../content/words.json';
import pillarsJson from '../content/pillars.json';
import { buildCompounds, surface, tokenize } from './text';
import type { Pillar, Sentence, Word } from './types';

export const WORDS: Word[] = (wordsJson as Word[]).slice().sort((a, b) => a.rank - b.rank);
export const PILLARS: Pillar[] = pillarsJson as Pillar[];

export const wordById = new Map(WORDS.map((w) => [w.id, w]));
export const wordByLemma = new Map(WORDS.map((w) => [w.lemma, w]));
export const pillarById = new Map(PILLARS.map((p) => [p.id, p]));

export type Item = { kind: 'word'; id: string; word: Word } | { kind: 'pillar'; id: string; pillar: Pillar };

export function getItem(id: string): Item | null {
  const w = wordById.get(id);
  if (w) return { kind: 'word', id, word: w };
  const p = pillarById.get(id);
  if (p) return { kind: 'pillar', id, pillar: p };
  return null;
}

const STARTS_WITH_VOWEL = /^[aeiouyàâäéèêëîïôöùûüœh]/i;

export function nounArticle(w: Word): string {
  if (w.article) return w.article;
  if (STARTS_WITH_VOWEL.test(w.lemma)) return "l'";
  return w.gender === 'f' ? 'la' : 'le';
}

/** Como a palavra aparece no cartão: substantivos com artigo, famílias pela lista. */
export function wordLabel(w: Word): string {
  if (w.display) return w.display;
  if (w.pos === 'substantivo') {
    const a = nounArticle(w);
    return a.endsWith("'") ? a + w.lemma : `${a} ${w.lemma}`;
  }
  return surface(w.lemma);
}

/** Texto falado pelo áudio (sem os rótulos entre parênteses). */
export function wordSpeech(w: Word): string {
  return wordLabel(w).replace(/\(.*?\)/g, '').replace(/,/g, ', ').trim();
}

export function meaning(w: Word, max = 3): string {
  return w.translations.slice(0, max).join(', ');
}

export function genderLabel(w: Word): string | null {
  if (w.pos !== 'substantivo' || !w.gender) return null;
  return w.gender === 'f' ? 'feminino' : 'masculino';
}

// Expressões compostas e índice forma → palavra base, para ligar cada token da frase à sua palavra.
const allForms = (w: Word) => [surface(w.lemma), ...w.forms.map(surface)];
export const COMPOUNDS = buildCompounds(WORDS.flatMap(allForms));

export const formIndex = new Map<string, string[]>();
for (const w of WORDS) {
  for (const f of allForms(w)) {
    const key = tokenize(f, COMPOUNDS).join(' ');
    const list = formIndex.get(key) ?? [];
    if (!list.includes(w.lemma)) list.push(w.lemma);
    formIndex.set(key, list);
  }
}

export interface SentenceToken {
  text: string;
  word: Word | null;
  bridge: boolean;
}

/** Liga cada token da frase à palavra declarada em `lemmas`, para mostrar a tradução ao tocar. */
export function sentenceTokens(s: Sentence): SentenceToken[] {
  return tokenize(s.fr, COMPOUNDS).map((t) => {
    const cands = formIndex.get(t) ?? [];
    const lemma = cands.find((c) => s.lemmas.includes(c)) ?? cands[0];
    const word = lemma ? (wordByLemma.get(lemma) ?? null) : null;
    return { text: t, word, bridge: !!lemma && s.bridge.includes(lemma) };
  });
}

/** Palavras-ponte da frase com a tradução, para mostrar embaixo dela. */
export function bridgeGloss(s: Sentence): { fr: string; pt: string }[] {
  return s.bridge
    .map((l) => wordByLemma.get(l))
    .filter((w): w is Word => !!w)
    .map((w) => ({ fr: wordLabel(w), pt: meaning(w, 2) }));
}
