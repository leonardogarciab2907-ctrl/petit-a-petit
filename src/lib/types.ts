// Formato do conteúdo (gerado por scripts/conteudo.ts a partir de content/palavras.txt).

export interface Sentence {
  fr: string;
  pt: string;
  /** Palavras base usadas na frase (formas conjugadas contam como a base). */
  lemmas: string[];
  /** Palavras-ponte: ainda não estudadas, mostradas com tradução. */
  bridge: string[];
  /** Outras traduções aceitas em francês. */
  accepted: string[];
}

export interface Word {
  id: string;
  rank: number;
  lemma: string;
  /** Como mostrar quando difere do lemma (famílias: "le, la, les"). */
  display: string | null;
  pos: string;
  gender: 'm' | 'f' | null;
  /** Artigo do substantivo quando não dá para deduzir (les gens, le héros). */
  article: string | null;
  translations: string[];
  pron_br: string;
  ipa: string;
  forms: string[];
  pillar: string | null;
  false_friend: string | null;
  tip: string | null;
  sentences: Sentence[];
}

export interface PillarDrill {
  /** Frase com ___ no lugar da resposta. */
  fr: string;
  pt: string;
  answer: string;
  options: string[];
}

export interface Pillar {
  id: string;
  title: string;
  trigger: string[];
  explanation: string;
  examples: { fr: string; pt: string }[];
  practice: PillarDrill[];
}
