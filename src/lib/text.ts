// Texto em francês: tokenização (usada pelo app e pelo script de conteúdo) e
// normalização das respostas digitadas. Sem dependências, para rodar no Node também.

const APOSTROPHES = /[’‘ʼ`´]/g;
const ELISION = /^(j|l|c|n|d|m|t|s|qu|jusqu|lorsqu|puisqu)'(.+)$/;
const EDGE_PUNCT = /^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu;

export function normApos(s: string): string {
  return s.replace(APOSTROPHES, "'");
}

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
}

/** Minúsculas, apóstrofo reto e ligaduras abertas (œ → oe). */
export function fold(s: string): string {
  return normApos(s.normalize('NFC')).toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae');
}

/**
 * Divide uma frase em tokens: separa elisões (j'ai → j' + ai), hífens
 * (est-ce → est + ce) e tira a pontuação. O "t" eufônico (a-t-il) é descartado.
 */
export function baseTokens(fr: string): string[] {
  const out: string[] = [];
  for (const chunk of fold(fr).split(/[\s  ]+/)) {
    const clean = chunk.replace(EDGE_PUNCT, '');
    if (!clean) continue;
    const parts = clean.split('-');
    parts.forEach((p, i) => {
      let part = p;
      if (!part) return;
      if (part === 't' && i > 0 && i < parts.length - 1) return;
      let m: RegExpExecArray | null;
      while ((m = ELISION.exec(part))) {
        out.push(m[1] + "'");
        part = m[2];
      }
      out.push(part);
    });
  }
  return out;
}

/** Expressões de várias palavras (d'accord, peut-être, est-ce que…), já tokenizadas. */
export type Compounds = Map<string, string[][]>;

export function buildCompounds(expressions: Iterable<string>): Compounds {
  const map: Compounds = new Map();
  for (const e of expressions) {
    const toks = baseTokens(e.replace(/_/g, ' '));
    if (toks.length < 2) continue;
    const list = map.get(toks[0]) ?? [];
    if (!list.some((l) => l.join(' ') === toks.join(' '))) list.push(toks);
    list.sort((a, b) => b.length - a.length);
    map.set(toks[0], list);
  }
  return map;
}

/** Tokens com as expressões compostas unidas num só token ("peut être" → "peut-être"). */
export function tokenize(fr: string, compounds: Compounds): string[] {
  const toks = baseTokens(fr);
  const out: string[] = [];
  for (let i = 0; i < toks.length; ) {
    const match = (compounds.get(toks[i]) ?? []).find((c) => c.every((t, k) => toks[i + k] === t));
    if (match) {
      out.push(compoundKey(match));
      i += match.length;
    } else {
      out.push(toks[i]);
      i += 1;
    }
  }
  return out;
}

export function compoundKey(toks: string[]): string {
  return toks.join(' ');
}

/** Pedaços da frase para o exercício "montar a frase": separa por espaço e tira a pontuação. */
export function chunks(fr: string): string[] {
  return fr
    .normalize('NFC')
    .replace(APOSTROPHES, "'")
    .split(/[\s  ]+/)
    .map((c) => c.replace(EDGE_PUNCT, ''))
    .filter(Boolean);
}

/** Forma usada para comparar respostas: minúsculas, sem pontuação, hífen = espaço, sem espaços extras. */
export function normAnswer(s: string): string {
  return fold(s)
    .replace(/'\s+/g, "'")
    .replace(/[-–—]/g, ' ')
    .replace(/[^\p{L}\p{N}'\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Forma escrita de um lemma: tira a marca de homônimo (le#pron → le) e troca _ por espaço. */
export function surface(lemma: string): string {
  return lemma.replace(/#.*$/, '').replace(/_/g, ' ');
}
