import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkBuilt } from '../scripts/validacao';
import { PILLARS, WORDS, sentenceTokens } from '../src/lib/content';
import { makeExercise } from '../src/lib/exercises';

describe('conteúdo', () => {
  it('nenhuma frase usa palavra ainda não estudada', () => {
    expect(checkBuilt(WORDS)).toEqual([]);
  });
  it('300 palavras, todas com frase, e os 16 pilares da fase 1', () => {
    expect(WORDS.length).toBe(300);
    expect(WORDS.every((w) => w.sentences.length >= 1)).toBe(true);
    expect(PILLARS.length).toBe(16);
    for (const p of PILLARS) expect(WORDS.filter((w) => w.pillar === p.id)).toHaveLength(1);
  });
  it('o JSON gerado está em dia com os arquivos de texto', () => {
    const json = JSON.parse(readFileSync('src/content/words.json', 'utf8'));
    expect(json.length).toBe(WORDS.length);
  });
  it('cada token da frase aponta para uma palavra', () => {
    for (const w of WORDS)
      for (const s of w.sentences) for (const t of sentenceTokens(s)) expect(t.word, `${t.text} em ${s.fr}`).not.toBeNull();
  });
  it('todo item gera exercício em todos os níveis', () => {
    const ctx = { seen: new Set(WORDS.slice(0, 50).map((w) => w.id)), tts: true };
    for (const w of WORDS) for (const lvl of [1, 2, 3]) expect(makeExercise(w.id, lvl, ctx), `${w.lemma} nível ${lvl}`).not.toBeNull();
    for (const p of PILLARS) for (const lvl of [1, 2, 3]) expect(makeExercise(p.id, lvl, ctx)).not.toBeNull();
  });
  it('opções sempre distintas e com a resposta certa', () => {
    const ctx = { seen: new Set<string>(), tts: false };
    for (const w of WORDS) {
      for (let i = 0; i < 5; i++) {
        const ex = makeExercise(w.id, 2, ctx);
        if (ex && 'options' in ex) {
          expect(new Set(ex.options.map((o) => o.toLowerCase())).size, `${w.lemma}: ${ex.options}`).toBe(ex.options.length);
          expect(ex.options.length).toBeGreaterThanOrEqual(3);
          expect(ex.answer).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});
