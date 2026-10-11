// Cartões de apresentação: palavra nova e pilar.
import { type ReactNode, useEffect } from 'react';
import { bridgeGloss, genderLabel, meaning, wordLabel, wordSpeech } from '../lib/content';
import { speak } from '../lib/speech';
import type { Pillar, Sentence, Word } from '../lib/types';
import { Button, Speaker } from './ui';

export function Layout({ main, actions }: { main: ReactNode; actions: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col justify-center gap-5 py-4">{main}</div>
      <div className="flex flex-col gap-2 pb-2">{actions}</div>
    </div>
  );
}

export function SentenceBlock({ s, showPt = true }: { s: { fr: string; pt: string } & Partial<Sentence>; showPt?: boolean }) {
  const gloss = s.bridge ? bridgeGloss(s as Sentence) : [];
  return (
    <div className="rounded-2xl bg-surface p-4">
      <div className="flex items-start gap-3">
        <p className="fr flex-1 text-xl leading-snug font-medium" lang="fr">
          {s.fr}
        </p>
        <Speaker text={s.fr} size="sm" label="Ouvir a frase" />
      </div>
      {showPt && <p className="mt-1 text-muted">{s.pt}</p>}
      {gloss.length > 0 && (
        <p className="mt-2 text-sm text-muted">
          {gloss.map((g) => (
            <span key={g.fr} className="mr-3">
              <span className="fr font-semibold text-ink">{g.fr}</span> = {g.pt}
            </span>
          ))}
          <span className="block text-xs">{gloss.length > 1 ? 'palavras que você ainda vai estudar' : 'palavra que você ainda vai estudar'}</span>
        </p>
      )}
    </div>
  );
}

export function WordHeader({ w, big = true }: { w: Word; big?: boolean }) {
  const gender = genderLabel(w);
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <p className={`fr font-bold break-words ${big ? 'text-4xl' : 'text-3xl'}`} lang="fr">
          {wordLabel(w)}
        </p>
        <p className="mt-1 text-sm text-muted">
          {w.pos}
          {gender && ` · ${gender}`}
        </p>
      </div>
      <Speaker text={wordSpeech(w)} size="lg" />
    </div>
  );
}

export function LearnWord({ w, onContinue, onKnown }: { w: Word; onContinue: () => void; onKnown: () => void }) {
  useEffect(() => {
    const t = setTimeout(() => speak(wordSpeech(w)), 250);
    return () => clearTimeout(t);
  }, [w]);
  return (
    <Layout
      main={
        <>
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">Palavra nova</p>
          <WordHeader w={w} />
          <div>
            <p className="text-2xl font-semibold">{meaning(w, 4)}</p>
            <p className="mt-1 text-muted">
              Pronúncia: <span className="font-semibold text-ink">{w.pron_br}</span> <span className="text-sm">/{w.ipa}/</span>
            </p>
          </div>
          {w.false_friend && <p className="rounded-xl border border-danger/40 bg-danger-soft p-3 text-sm text-danger">⚠ {w.false_friend}</p>}
          {w.tip && <p className="text-sm text-muted">💡 {w.tip}</p>}
          <div className="flex flex-col gap-3">
            {w.sentences.map((s) => (
              <SentenceBlock key={s.fr} s={s} />
            ))}
          </div>
        </>
      }
      actions={
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button variant="secondary" className="whitespace-nowrap" onClick={onKnown}>
            Já conheço
          </Button>
          <Button onClick={onContinue}>Continuar</Button>
        </div>
      }
    />
  );
}

export function PillarCard({ p, onContinue, onKnown }: { p: Pillar; onContinue: () => void; onKnown: () => void }) {
  return (
    <Layout
      main={
        <>
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">Pilar da língua</p>
          <h2 className="text-3xl font-bold">{p.title}</h2>
          <p className="text-lg leading-relaxed">{p.explanation}</p>
          <div className="flex flex-col gap-3">
            {p.examples.map((ex) => (
              <SentenceBlock key={ex.fr} s={ex} />
            ))}
          </div>
        </>
      }
      actions={
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button variant="secondary" className="whitespace-nowrap" onClick={onKnown}>
            Já conheço
          </Button>
          <Button onClick={onContinue}>Entendi</Button>
        </div>
      }
    />
  );
}
