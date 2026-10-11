// Os exercícios da escada. Cada um termina chamando onDone com a nota para o FSRS.
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { genderLabel, meaning, nounArticle, wordLabel, wordSpeech } from '../lib/content';
import type { Outcome } from '../lib/engine';
import type { Exercise } from '../lib/exercises';
import { type Verdict, accentMarks, gradeBuild, gradeTyped } from '../lib/grade';
import { speak } from '../lib/speech';
import { stripAccents } from '../lib/text';
import { type Grade, Rating } from '../lib/srs';
import type { Word } from '../lib/types';
import { Layout, SentenceBlock, WordHeader } from './cards';
import { Button, Speaker } from './ui';

type Done = (o: Outcome) => void;

export function ExerciseView({ ex, onDone }: { ex: Exercise; onDone: Done }) {
  switch (ex.type) {
    case 'reveal':
      return <Reveal ex={ex} onDone={onDone} />;
    case 'pillar-reveal':
      return <PillarReveal ex={ex} onDone={onDone} />;
    case 'type':
      return <TypeAnswer w={ex.word} onDone={onDone} />;
    case 'build':
      return <Build ex={ex} onDone={onDone} />;
    default:
      return <Choice ex={ex} onDone={onDone} />;
  }
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-sm font-semibold tracking-wide text-muted uppercase">{children}</p>;
}

// ---------- nível 1: revelar (o usuário avalia) ----------

const RATINGS: { r: Grade; label: string; variant: 'danger' | 'secondary' | 'primary' }[] = [
  { r: Rating.Again, label: 'Errei', variant: 'danger' },
  { r: Rating.Hard, label: 'Difícil', variant: 'secondary' },
  { r: Rating.Good, label: 'Bom', variant: 'primary' },
  { r: Rating.Easy, label: 'Fácil', variant: 'secondary' },
];

function RateButtons({ onRate, type }: { onRate: Done; type: string }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {RATINGS.map(({ r, label, variant }) => (
        <Button key={r} variant={variant} className="px-1" onClick={() => onRate({ rating: r, correct: r !== Rating.Again, exerciseType: type })}>
          {label}
        </Button>
      ))}
    </div>
  );
}

function Reveal({ ex, onDone }: { ex: Extract<Exercise, { type: 'reveal' }>; onDone: Done }) {
  const [shown, setShown] = useState(false);
  return (
    <Layout
      main={
        <>
          <Hint>O que significa?</Hint>
          <WordHeader w={ex.word} />
          {shown && (
            <>
              <p className="text-2xl font-semibold">{meaning(ex.word, 4)}</p>
              {ex.sentence && <SentenceBlock s={ex.sentence} />}
            </>
          )}
        </>
      }
      actions={
        shown ? (
          <>
            <p className="text-center text-sm text-muted">Como foi?</p>
            <RateButtons onRate={onDone} type="reveal" />
          </>
        ) : (
          <Button onClick={() => setShown(true)}>Mostrar resposta</Button>
        )
      }
    />
  );
}

function PillarReveal({ ex, onDone }: { ex: Extract<Exercise, { type: 'pillar-reveal' }>; onDone: Done }) {
  const [shown, setShown] = useState(false);
  return (
    <Layout
      main={
        <>
          <Hint>{ex.pillar.title} · o que quer dizer?</Hint>
          <div className="flex items-start gap-3">
            <p className="fr flex-1 text-3xl font-bold" lang="fr">
              {ex.example.fr}
            </p>
            <Speaker text={ex.example.fr} />
          </div>
          {shown && (
            <>
              <p className="text-2xl font-semibold">{ex.example.pt}</p>
              <p className="text-muted">{ex.pillar.explanation}</p>
            </>
          )}
        </>
      }
      actions={
        shown ? (
          <>
            <p className="text-center text-sm text-muted">Como foi?</p>
            <RateButtons onRate={onDone} type="pillar-reveal" />
          </>
        ) : (
          <Button onClick={() => setShown(true)}>Mostrar resposta</Button>
        )
      }
    />
  );
}

// ---------- correção pelo app: botão continuar + ajuste opcional da nota ----------

function Feedback({ ok, base, children, onDone, type }: { ok: boolean; base: Grade; children: ReactNode; onDone: Done; type: string }) {
  const [rating, setRating] = useState<Grade>(base);
  const toggle = (r: Grade) => setRating((cur) => (cur === r ? base : r));
  return (
    <>
      <div className={`rounded-2xl border p-3 ${ok ? 'border-primary/40 bg-primary-soft' : 'border-danger/40 bg-danger-soft'}`} role="status">
        {children}
      </div>
      {ok && (
        <div className="flex justify-center gap-2 text-sm">
          {base !== Rating.Hard && (
            <button className={`min-h-11 rounded-full px-4 ${rating === Rating.Hard ? 'bg-ink text-bg' : 'text-muted'}`} onClick={() => toggle(Rating.Hard)}>
              foi difícil
            </button>
          )}
          <button className={`min-h-11 rounded-full px-4 ${rating === Rating.Easy ? 'bg-ink text-bg' : 'text-muted'}`} onClick={() => toggle(Rating.Easy)}>
            foi fácil
          </button>
        </div>
      )}
      <Button autoFocus onClick={() => onDone({ rating: ok ? rating : Rating.Again, correct: ok, exerciseType: type })}>
        Continuar
      </Button>
    </>
  );
}

// ---------- escolha entre opções (ouvir, reconhecer, português → francês, completar) ----------

function Choice({ ex, onDone }: { ex: Extract<Exercise, { options: string[] }>; onDone: Done }) {
  const [picked, setPicked] = useState<number | null>(null);
  const word = 'word' in ex ? ex.word : null;
  const fullSentence =
    ex.type === 'cloze' ? ex.sentence.fr : ex.type === 'pillar-cloze' ? ex.drill.fr.replace('___', ex.drill.answer) : null;

  useEffect(() => {
    if (ex.type === 'listen' && word) {
      const t = setTimeout(() => speak(wordSpeech(word)), 300);
      return () => clearTimeout(t);
    }
  }, [ex.type, word]);

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (fullSentence) speak(fullSentence);
    else if (word) speak(wordSpeech(word));
  };

  const ok = picked === ex.answer;
  const optionClass = (i: number) => {
    if (picked === null) return 'border-line bg-bg';
    if (i === ex.answer) return 'border-primary bg-primary-soft';
    if (i === picked) return 'border-danger bg-danger-soft text-danger';
    return 'border-line opacity-50';
  };
  const frOptions = ex.type === 'mc-fr' || ex.type === 'cloze' || ex.type === 'pillar-cloze';

  return (
    <Layout
      main={
        <>
          {ex.type === 'listen' && word && (
            <>
              <Hint>Ouça e escolha o significado</Hint>
              <div className="flex flex-col items-center gap-3">
                <Speaker text={wordSpeech(word)} size="lg" label="Ouvir de novo" />
                {picked !== null && (
                  <p className="fr text-3xl font-bold" lang="fr">
                    {wordLabel(word)}
                  </p>
                )}
              </div>
            </>
          )}
          {ex.type === 'choose-pt' && word && (
            <>
              <Hint>O que significa?</Hint>
              <WordHeader w={word} />
            </>
          )}
          {ex.type === 'mc-fr' && word && (
            <>
              <Hint>Como se diz em francês?</Hint>
              <p className="text-3xl font-bold">{meaning(word, 3)}</p>
              <p className="text-sm text-muted">{word.pos}</p>
            </>
          )}
          {ex.type === 'cloze' && (
            <>
              <Hint>Complete a frase</Hint>
              <ClozeLine before={ex.before} after={ex.after} fill={picked !== null ? ex.options[ex.answer] : null} />
              <p className="text-muted">{ex.sentence.pt}</p>
            </>
          )}
          {ex.type === 'pillar-cloze' && (
            <>
              <Hint>{ex.pillar.title}</Hint>
              <ClozeLine
                before={ex.drill.fr.split('___')[0]}
                after={ex.drill.fr.split('___')[1] ?? ''}
                fill={picked !== null ? ex.drill.answer : null}
              />
              <p className="text-muted">{ex.drill.pt}</p>
            </>
          )}
          <div className="flex flex-col gap-2">
            {ex.options.map((o, i) => (
              <button
                key={i}
                onClick={() => pick(i)}
                className={`min-h-13 rounded-xl border-2 px-4 py-2 text-left text-lg font-medium ${frOptions ? 'fr' : ''} ${optionClass(i)}`}
                lang={frOptions ? 'fr' : undefined}
              >
                {o.trim()}
              </button>
            ))}
          </div>
        </>
      }
      actions={
        picked !== null ? (
          <Feedback ok={ok} base={Rating.Good} onDone={onDone} type={ex.type}>
            {ok ? <p className="font-semibold text-primary">Certo!</p> : <p className="font-semibold text-danger">Resposta certa: {ex.options[ex.answer].trim()}</p>}
            {word && ex.type !== 'cloze' && (
              <p className="mt-1 text-sm">
                <span className="fr font-semibold">{wordLabel(word)}</span> = {meaning(word, 3)}
              </p>
            )}
          </Feedback>
        ) : (
          <p className="text-center text-sm text-muted">Toque na resposta</p>
        )
      }
    />
  );
}

function ClozeLine({ before, after, fill }: { before: string; after: string; fill: string | null }) {
  return (
    <p className="fr text-2xl leading-snug font-medium" lang="fr">
      {before}
      <span className={`inline-block min-w-16 border-b-2 px-1 text-center ${fill ? 'border-primary text-primary' : 'border-ink'}`}>{fill?.trim() ?? ' '}</span>
      {after}
    </p>
  );
}

// ---------- nível 3: digitar ----------

function Highlighted({ text, verdict, w, typed }: { text: string; verdict: Verdict; w: Word; typed: string }) {
  // Destaca os acentos quando a resposta veio sem eles (também quando o artigo faltou).
  const missedAccents = verdict === 'accents' || (verdict === 'article' && stripAccents(typed) === typed && stripAccents(text) !== text);
  if (verdict === 'article' && w.pos === 'substantivo') {
    const art = nounArticle(w);
    const rest = text.slice(art.length);
    const marks = accentMarks(rest);
    return (
      <>
        <span className="accent-mark">{art}</span>
        {[...rest].map((ch, i) => (
          <span key={i} className={missedAccents && marks[i] ? 'accent-mark' : undefined}>
            {ch}
          </span>
        ))}
      </>
    );
  }
  if (missedAccents) {
    const marks = accentMarks(text);
    return (
      <>
        {[...text].map((ch, i) => (
          <span key={i} className={marks[i] ? 'accent-mark' : undefined}>
            {ch}
          </span>
        ))}
      </>
    );
  }
  return <>{text}</>;
}

const VERDICT_TEXT: Record<Verdict, string> = {
  right: 'Certo!',
  accents: 'Certo! Só faltaram os acentos:',
  article: 'Quase: confira o artigo.',
  wrong: 'Não foi dessa vez. A resposta é:',
};

function TypeAnswer({ w, onDone }: { w: Word; onDone: Done }) {
  const [value, setValue] = useState('');
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const check = (giveUp = false) => {
    if (verdict) return;
    const v = giveUp ? 'wrong' : gradeTyped(value, w);
    setVerdict(v);
    speak(wordSpeech(w));
    input.current?.blur();
  };
  const gender = genderLabel(w);
  const ok = verdict !== null && verdict !== 'wrong';
  return (
    <Layout
      main={
        <>
          <Hint>Escreva em francês</Hint>
          <p className="text-3xl font-bold">{meaning(w, 3)}</p>
          <p className="text-sm text-muted">
            {w.pos}
            {gender && ` · ${gender} · com o artigo`}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              check();
            }}
          >
            <input
              ref={input}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={verdict !== null}
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              lang="fr"
              enterKeyHint="done"
              placeholder="Sua resposta"
              aria-label="Sua resposta em francês"
              className="fr min-h-14 w-full rounded-xl border-2 border-line bg-bg px-4 text-2xl outline-none focus:border-primary"
            />
          </form>
        </>
      }
      actions={
        verdict ? (
          <Feedback ok={ok} base={verdict === 'article' ? Rating.Hard : Rating.Good} onDone={onDone} type="type">
            <p className={`font-semibold ${ok ? 'text-primary' : 'text-danger'}`}>{VERDICT_TEXT[verdict]}</p>
            <p className="fr mt-1 text-2xl font-bold text-ink" lang="fr">
              <Highlighted text={wordLabel(w)} verdict={verdict} w={w} typed={value} />
            </p>
          </Feedback>
        ) : (
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <Button variant="secondary" onClick={() => check(true)}>
              Não sei
            </Button>
            <Button onClick={() => check()} disabled={!value.trim()}>
              Verificar
            </Button>
          </div>
        )
      }
    />
  );
}

// ---------- nível 3: montar a frase ----------

function Build({ ex, onDone }: { ex: Extract<Exercise, { type: 'build' }>; onDone: Done }) {
  const [chosen, setChosen] = useState<number[]>([]);
  const [result, setResult] = useState<boolean | null>(null);
  const check = () => {
    const ok = gradeBuild(
      chosen.map((i) => ex.pieces[i]),
      ex.answers,
    );
    setResult(ok);
    speak(ex.fr);
  };
  const chip = 'min-h-11 rounded-xl border-2 px-3 text-lg font-medium';
  return (
    <Layout
      main={
        <>
          <Hint>{ex.pillar ? `${ex.pillar.title} · monte a frase` : 'Monte a frase em francês'}</Hint>
          <p className="text-2xl font-semibold">{ex.pt}</p>
          <div className="flex min-h-16 flex-wrap content-start gap-2 rounded-2xl border-2 border-dashed border-line p-2" aria-label="Sua frase">
            {chosen.map((i, k) => (
              <button
                key={k}
                disabled={result !== null}
                onClick={() => setChosen((c) => c.filter((_, j) => j !== k))}
                className={`fr ${chip} border-primary bg-primary-soft`}
                lang="fr"
              >
                {ex.pieces[i]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {ex.pieces.map((p, i) =>
              chosen.includes(i) ? (
                <span key={i} className={`${chip} invisible`}>
                  {p}
                </span>
              ) : (
                <button key={i} disabled={result !== null} onClick={() => setChosen((c) => [...c, i])} className={`fr ${chip} border-line bg-bg`} lang="fr">
                  {p}
                </button>
              ),
            )}
          </div>
        </>
      }
      actions={
        result !== null ? (
          <Feedback ok={result} base={Rating.Good} onDone={onDone} type="build">
            <p className={`font-semibold ${result ? 'text-primary' : 'text-danger'}`}>{result ? 'Certo!' : 'A frase certa é:'}</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="fr flex-1 text-xl font-semibold text-ink" lang="fr">
                {ex.fr}
              </p>
              <Speaker text={ex.fr} size="sm" />
            </div>
          </Feedback>
        ) : (
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <Button variant="secondary" onClick={() => setChosen([])} disabled={!chosen.length}>
              Limpar
            </Button>
            <Button onClick={check} disabled={!chosen.length}>
              Verificar
            </Button>
          </div>
        )
      }
    />
  );
}
