import { describe, expect, it } from 'vitest';
import { Rating } from 'ts-fsrs';
import { wordByLemma } from '../src/lib/content';
import { gradeBuild, gradeTyped } from '../src/lib/grade';
import { nextLadder } from '../src/lib/ladder';

const w = (l: string) => wordByLemma.get(l)!;

describe('correção digitada', () => {
  it('aceita "cafe" e "le cafe" (sem acento), mostrando café', () => {
    expect(gradeTyped('le cafe', w('café'))).toBe('accents');
    expect(gradeTyped('cafe', w('café'))).toBe('article'); // vale Difícil: faltou o artigo
    expect(gradeTyped('le café', w('café'))).toBe('right');
    expect(gradeTyped('un café', w('café'))).toBe('right');
  });
  it('artigo errado vale Difícil', () => {
    expect(gradeTyped('le maison', w('maison'))).toBe('article');
    expect(gradeTyped('la maison', w('maison'))).toBe('right');
  });
  it('apóstrofo curvo = reto, maiúsculas e espaços não importam', () => {
    expect(gradeTyped('L’eau', w('eau'))).toBe('right');
    expect(gradeTyped("  l'EAU ", w('eau'))).toBe('right');
  });
  it('verbos e famílias', () => {
    expect(gradeTyped('etre', w('être'))).toBe('accents');
    expect(gradeTyped('la', w('le'))).toBe('right');
    expect(gradeTyped('avoir', w('être'))).toBe('wrong');
    expect(gradeTyped('', w('être'))).toBe('wrong');
  });
  it('montar a frase aceita a frase e as variantes', () => {
    expect(gradeBuild(['je', 'suis', 'là'], ['Je suis là.', 'Je suis ici.'])).toBe(true);
    expect(gradeBuild(['je', 'suis', 'ici'], ['Je suis là.', 'Je suis ici.'])).toBe(true);
    expect(gradeBuild(['suis', 'je', 'là'], ['Je suis là.'])).toBe(false);
  });
});

describe('escada', () => {
  it('sobe com 2 acertos seguidos, Difícil mantém, erro desce', () => {
    let s = { level: 1, streak: 0 };
    s = nextLadder(s, Rating.Good);
    expect(s).toEqual({ level: 1, streak: 1 });
    s = nextLadder(s, Rating.Easy);
    expect(s).toEqual({ level: 2, streak: 0 });
    s = nextLadder(s, Rating.Hard);
    expect(s).toEqual({ level: 2, streak: 0 });
    s = nextLadder(nextLadder(s, Rating.Good), Rating.Good);
    expect(s.level).toBe(3);
    s = nextLadder(s, Rating.Again);
    expect(s).toEqual({ level: 2, streak: 0 });
    expect(nextLadder({ level: 1, streak: 1 }, Rating.Again).level).toBe(1);
  });
});
