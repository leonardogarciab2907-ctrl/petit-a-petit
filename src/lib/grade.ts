// Correção tolerante das respostas digitadas e dos exercícios de frase.
import { nounArticle, wordLabel } from './content';
import { chunks, normAnswer, stripAccents, surface } from './text';
import type { Word } from './types';

/** right = certo; accents = só faltaram acentos (Bom); article = artigo errado ou faltando (Difícil). */
export type Verdict = 'right' | 'accents' | 'article' | 'wrong';

const ARTICLE = /^(le|la|les|l'|un|une|des)\s?(.+)$/;

/** Respostas aceitas para "português → francês digitando". */
export function acceptedAnswers(w: Word): string[] {
  const out = new Set<string>([wordLabel(w)]);
  if (w.pos === 'substantivo') {
    if (w.gender && !w.article) out.add(`${w.gender === 'f' ? 'une' : 'un'} ${w.lemma}`);
  } else {
    out.add(surface(w.lemma));
    // Famílias (le, la, les): qualquer forma da família vale.
    if (w.display) for (const part of w.display.replace(/\(.*?\)/g, '').split(/[,/]/)) out.add(part.trim());
  }
  return [...out].filter(Boolean);
}

export function gradeTyped(input: string, w: Word): Verdict {
  const given = normAnswer(input);
  if (!given) return 'wrong';
  const expected = acceptedAnswers(w).map(normAnswer);
  if (expected.includes(given)) return 'right';
  if (expected.map(stripAccents).includes(stripAccents(given))) return 'accents';
  if (w.pos === 'substantivo') {
    const noun = normAnswer(surface(w.lemma));
    const rest = ARTICLE.exec(given)?.[2] ?? given;
    if (stripAccents(rest) === stripAccents(noun)) return 'article';
  }
  return 'wrong';
}

/** Artigo esperado do substantivo, para destacar na correção. */
export function expectedArticle(w: Word): string | null {
  return w.pos === 'substantivo' ? nounArticle(w) : null;
}

/** Montar a frase: compara a sequência de pedaços com a frase e as variantes aceitas. */
export function gradeBuild(pieces: string[], answers: string[]): boolean {
  const given = normAnswer(pieces.join(' '));
  return answers.some((a) => normAnswer(chunks(a).join(' ')) === given);
}

/** Letras acentuadas da forma certa, para destacar quando o usuário escreveu sem acento. */
export function accentMarks(s: string): boolean[] {
  return [...s].map((ch) => stripAccents(ch) !== ch || ch === 'œ' || ch === 'æ');
}
