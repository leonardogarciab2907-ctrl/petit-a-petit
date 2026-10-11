// Lê content/palavras.txt, descobre as palavras base de cada frase e confere as regras:
// cada frase só usa palavras já estudadas + a nova (com palavras-ponte só nos primeiros dias).
import { baseTokens, buildCompounds, surface, tokenize, type Compounds } from '../src/lib/text.ts';
import type { Pillar, Sentence, Word } from '../src/lib/types.ts';

const POS: Record<string, string> = {
  verbo: 'verbo',
  adj: 'adjetivo',
  adv: 'advérbio',
  pron: 'pronome',
  art: 'artigo',
  prep: 'preposição',
  conj: 'conjunção',
  det: 'determinante',
  interj: 'interjeição',
  num: 'numeral',
  expr: 'expressão',
};

/** Palavras-ponte permitidas por frase, conforme a posição da palavra na lista. */
export function bridgeLimit(rank: number): number {
  if (rank <= 8) return 2; // 1º dia: a primeira palavra ainda não tem com quem formar frase
  if (rank <= 40) return 1; // dias 2 a 5
  return 0;
}

export const MIN_TOKENS = 3;
export const MAX_TOKENS = 8;

interface RawSentence {
  fr: string;
  pt: string;
  accepted: string[];
  notes: Record<string, string>;
  line: string;
}

interface RawWord extends Omit<Word, 'sentences'> {
  raw: RawSentence[];
  line: string;
}

export interface Report {
  words: Word[];
  errors: string[];
  warnings: string[];
}

export interface SourceFile {
  name: string;
  txt: string;
}

export function parseWords(files: SourceFile[]): { words: RawWord[]; errors: string[] } {
  const errors: string[] = [];
  const words: RawWord[] = [];
  let cur: RawWord | null = null;
  for (const file of files) file.txt.split(/\r?\n/).forEach((rawLine, i) => {
    const line = rawLine.trim();
    const n = `${file.name}:${i + 1}`;
    if (!line || (line.startsWith('#') && !line.startsWith('##'))) return;
    if (line.startsWith('## ')) {
      const f = line.slice(3).split('|').map((s) => s.trim());
      if (f.length !== 5) {
        errors.push(`${n}: cabeçalho precisa de 5 campos (lemma | classe | traduções | pron | ipa)`);
        return;
      }
      const [lemma, cls, tr, pron, ipa] = f;
      const noun = /^(m|f)( pl)?$/.exec(cls);
      if (!noun && !POS[cls]) errors.push(`${n}: classe desconhecida "${cls}"`);
      cur = {
        id: 'w-' + lemma.normalize('NFC').toLowerCase().replace(/['’]/g, '').replace(/[\s_#]+/g, '-'),
        rank: words.length + 1,
        lemma: lemma.normalize('NFC'),
        display: null,
        pos: noun ? 'substantivo' : (POS[cls] ?? cls),
        gender: noun ? (noun[1] as 'm' | 'f') : null,
        article: noun?.[2] ? 'les' : null,
        translations: tr.split(',').map((s) => s.trim()).filter(Boolean),
        pron_br: pron,
        ipa,
        forms: [],
        pillar: null,
        false_friend: null,
        tip: null,
        raw: [],
        line: n,
      };
      words.push(cur);
      return;
    }
    if (!cur) {
      errors.push(`${n}: conteúdo antes da primeira palavra`);
      return;
    }
    const w: RawWord = cur;
    if (line.startsWith('>')) {
      const parts = line.slice(1).split('|').map((s) => s.trim());
      const notes: Record<string, string> = {};
      const accepted: string[] = [];
      for (const p of parts.slice(2)) {
        const m = /^@(.+?)=(.+)$/.exec(p);
        if (m) notes[m[1].toLowerCase()] = m[2];
        else if (p) accepted.push(p);
      }
      w.raw.push({ fr: parts[0], pt: parts[1] ?? '', accepted, notes, line: n });
      return;
    }
    const m = /^(\p{L}+):\s*(.*)$/u.exec(line);
    if (!m) {
      errors.push(`${n}: linha não reconhecida`);
      return;
    }
    const [, key, value] = m;
    if (key === 'formas') w.forms = value.split(/\s+/).filter(Boolean).map((f) => f.normalize('NFC'));
    else if (key === 'exibir') w.display = value;
    else if (key === 'art') w.article = value;
    else if (key === 'pilar') w.pillar = value;
    else if (key === 'dica') w.tip = value;
    else if (key === 'falso') w.false_friend = value;
    else errors.push(`${n}: campo desconhecido "${key}"`);
  });
  return { words, errors };
}

function forms(w: { lemma: string; forms: string[] }): string[] {
  return [surface(w.lemma), ...w.forms.map(surface)];
}

export function buildIndex(words: { lemma: string; forms: string[] }[]): { compounds: Compounds; index: Map<string, string[]> } {
  const compounds = buildCompounds(words.flatMap(forms));
  const index = new Map<string, string[]>();
  for (const w of words) {
    for (const f of forms(w)) {
      const key = tokenize(f, compounds).join(' ');
      const list = index.get(key) ?? [];
      if (!list.includes(w.lemma)) list.push(w.lemma);
      index.set(key, list);
    }
  }
  return { compounds, index };
}

export function build(files: SourceFile[], pillars: Pillar[]): Report {
  const { words: raw, errors } = parseWords(files);
  const warnings: string[] = [];
  const { compounds, index } = buildIndex(raw);
  const rankOf = new Map(raw.map((w) => [w.lemma, w.rank]));
  const pillarIds = new Set(pillars.map((p) => p.id));

  const seen = new Map<string, string>();
  for (const w of raw) {
    if (seen.has(w.lemma)) errors.push(`${w.line}: "${w.lemma}" repetida (já em ${seen.get(w.lemma)})`);
    seen.set(w.lemma, w.line);
  }

  const words: Word[] = raw.map((w) => {
    const where = `${w.line} (${w.lemma})`;
    if (!w.translations.length) errors.push(`${where}: sem tradução`);
    if (!w.pron_br || !w.ipa) errors.push(`${where}: falta pronúncia ou IPA`);
    if (w.pos === 'verbo' && w.lemma !== 'falloir' && w.forms.length < 7) warnings.push(`${where}: verbo com menos de 7 formas`);
    if (w.pillar && !pillarIds.has(w.pillar)) errors.push(`${where}: pilar "${w.pillar}" não existe`);
    if (!w.raw.length) errors.push(`${where}: nenhuma frase`);
    if (w.raw.length > 2) warnings.push(`${where}: mais de 2 frases`);

    const sentences: Sentence[] = w.raw.map((s) => {
      const at = `${s.line} (${w.lemma})`;
      const toks = tokenize(s.fr, compounds);
      if (toks.length < MIN_TOKENS || toks.length > MAX_TOKENS)
        errors.push(`${at}: frase com ${toks.length} palavras (precisa de ${MIN_TOKENS} a ${MAX_TOKENS}): ${s.fr}`);
      if (!/[.!?…]$/.test(s.fr)) warnings.push(`${at}: frase sem pontuação final`);
      if (!s.pt) errors.push(`${at}: frase sem tradução`);

      const lemmas: string[] = [];
      for (const t of toks) {
        const cands = index.get(t) ?? [];
        let chosen: string | undefined = s.notes[t];
        if (chosen && !rankOf.has(chosen)) {
          errors.push(`${at}: anotação @${t}=${chosen} aponta para palavra inexistente`);
          chosen = undefined;
        }
        if (!chosen && cands.includes(w.lemma)) chosen = w.lemma;
        if (!chosen) {
          const byRank = cands.slice().sort((a, b) => rankOf.get(a)! - rankOf.get(b)!);
          chosen = byRank.find((c) => rankOf.get(c)! < w.rank) ?? byRank[0];
        }
        if (!chosen) {
          errors.push(`${at}: "${t}" não é forma de nenhuma palavra da lista: ${s.fr}`);
          continue;
        }
        if (!lemmas.includes(chosen)) lemmas.push(chosen);
      }
      if (!lemmas.includes(w.lemma)) errors.push(`${at}: a frase não usa a própria palavra: ${s.fr}`);
      const bridge = lemmas.filter((l) => l !== w.lemma && rankOf.get(l)! > w.rank);
      if (bridge.length > bridgeLimit(w.rank))
        errors.push(`${at}: palavras ainda não estudadas [${bridge.join(', ')}] (limite ${bridgeLimit(w.rank)}): ${s.fr}`);
      for (const a of s.accepted) {
        const unknown = tokenize(a, compounds).filter((t) => !index.has(t));
        if (unknown.length) warnings.push(`${at}: variante com palavra fora da lista [${unknown.join(', ')}]: ${a}`);
      }
      return { fr: s.fr, pt: s.pt, lemmas, bridge, accepted: s.accepted };
    });

    const { raw: _r, line: _l, ...rest } = w;
    return { ...rest, sentences };
  });

  // Pilares: cada um aberto por exatamente uma palavra; exercícios bem formados.
  for (const p of pillars) {
    const openers = words.filter((w) => w.pillar === p.id);
    if (openers.length !== 1) errors.push(`pilar ${p.id}: aberto por ${openers.length} palavras (precisa de 1)`);
    if (p.examples.length < 2) warnings.push(`pilar ${p.id}: menos de 2 exemplos`);
    for (const d of p.practice) {
      if ((d.fr.match(/___/g) ?? []).length !== 1) errors.push(`pilar ${p.id}: exercício sem ___ único: ${d.fr}`);
      if (d.options.includes(d.answer)) errors.push(`pilar ${p.id}: resposta repetida nas opções: ${d.fr}`);
      if (d.options.length < 2) errors.push(`pilar ${p.id}: poucas opções: ${d.fr}`);
    }
    for (const ex of [...p.examples, ...p.practice.map((d) => ({ fr: d.fr.replace('___', d.answer) }))]) {
      const unknown = tokenize(ex.fr, compounds).filter((t) => !index.has(t));
      if (unknown.length) warnings.push(`pilar ${p.id}: exemplo com palavra fora da lista [${unknown.join(', ')}]: ${ex.fr}`);
    }
  }
  return { words, errors, warnings };
}

/** Confere de novo o JSON já gerado (usado pelos testes). */
export function checkBuilt(words: Word[]): string[] {
  const problems: string[] = [];
  const { compounds, index } = buildIndex(words);
  const rankOf = new Map(words.map((w) => [w.lemma, w.rank]));
  for (const w of words) {
    for (const s of w.sentences) {
      for (const l of s.lemmas) {
        const r = rankOf.get(l);
        if (r === undefined) problems.push(`${w.lemma}: "${l}" não existe`);
        else if (r > w.rank && !s.bridge.includes(l)) problems.push(`${w.lemma}: "${l}" ainda não estudada em: ${s.fr}`);
      }
      if (s.bridge.length > bridgeLimit(w.rank)) problems.push(`${w.lemma}: pontes demais em: ${s.fr}`);
      for (const t of tokenize(s.fr, compounds)) {
        if (!(index.get(t) ?? []).some((c) => s.lemmas.includes(c))) problems.push(`${w.lemma}: "${t}" sem palavra declarada em: ${s.fr}`);
      }
    }
  }
  return problems;
}

export { baseTokens };
