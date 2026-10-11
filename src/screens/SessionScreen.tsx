// Tela da sessão: barra de progresso, cartão no centro e botões embaixo.
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { LearnWord, PillarCard } from '../components/cards';
import { ExerciseView } from '../components/exercises';
import { CloseIcon, IconButton, Screen } from '../components/ui';
import { getItem } from '../lib/content';
import { db } from '../lib/db';
import { type Outcome, answer, learn, skip } from '../lib/engine';
import { makeExercise } from '../lib/exercises';
import type { SessionPlan } from '../lib/session';
import { hasFrenchVoice } from '../lib/speech';

const STAGE: Record<string, string> = {
  review: 'Revisão',
  pillar: 'Pilar',
  learn: 'Palavra nova',
  quiz: 'Mini quiz',
  retry: 'Repetindo os erros',
};

export default function SessionScreen({
  initial,
  onExit,
  onFinish,
  onChange,
}: {
  initial: SessionPlan;
  onExit: () => void;
  onFinish: (plan: SessionPlan) => void;
  onChange: () => void;
}) {
  const [plan, setPlan] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [ladder, setLadder] = useState<{ id: string; level: number } | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const started = useRef(Date.now());
  const step = plan.steps[plan.pos];

  // Nível atual da escada e itens já vistos (para escolher exercício e opções).
  useEffect(() => {
    if (!step) return;
    let alive = true;
    Promise.all([db.cards.get(step.itemId), db.cards.toCollection().primaryKeys()]).then(([card, keys]) => {
      if (!alive) return;
      setLadder({ id: step.itemId, level: card?.ladder_level ?? 1 });
      setSeen(new Set(keys));
    });
    started.current = Date.now();
    return () => {
      alive = false;
    };
  }, [plan.pos, step]);

  useEffect(() => {
    if (plan.finished) onFinish(plan);
  }, [plan, onFinish]);

  const exercise = useMemo(() => {
    if (!step || step.kind === 'learn' || step.kind === 'pillar' || ladder?.id !== step.itemId) return null;
    return makeExercise(step.itemId, ladder.level, { seen, tts: hasFrenchVoice() }, step.kind === 'quiz');
    // O exercício é sorteado uma vez por passo.
  }, [plan.pos, ladder?.id, ladder?.level]);

  if (!step) return null;
  const item = getItem(step.itemId);
  const elapsed = () => Date.now() - started.current;

  const run = async (fn: () => Promise<SessionPlan>) => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await fn();
      setLadder(null);
      setPlan(next);
      onChange();
    } finally {
      setBusy(false);
    }
  };

  const onAnswer = (o: Outcome) => run(() => answer(plan, o, elapsed()));
  const onLearn = (known: boolean) => run(() => learn(plan, known, elapsed()));

  const progress = plan.steps.length ? plan.pos / plan.steps.length : 0;

  let body: ReactNode = null;
  if (!item) {
    body = <SkipMissing onSkip={() => run(() => skip(plan))} />;
  } else if (step.kind === 'learn' && item.kind === 'word') {
    body = <LearnWord key={plan.pos} w={item.word} onContinue={() => onLearn(false)} onKnown={() => onLearn(true)} />;
  } else if (step.kind === 'pillar' && item.kind === 'pillar') {
    body = <PillarCard key={plan.pos} p={item.pillar} onContinue={() => onLearn(false)} onKnown={() => onLearn(true)} />;
  } else if (exercise) {
    body = <ExerciseView key={`${plan.pos}-${plan.steps.length}`} ex={exercise} onDone={onAnswer} />;
  }

  return (
    <Screen>
      <header className="flex items-center gap-2">
        <IconButton label="Sair (o progresso fica salvo)" onClick={onExit}>
          <CloseIcon />
        </IconButton>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="w-14 text-right text-sm text-muted tabular-nums">
          {plan.pos + 1}/{plan.steps.length}
        </span>
      </header>
      <p className="mt-2 text-center text-xs font-semibold tracking-wide text-muted uppercase">{STAGE[step.kind]}</p>
      {body}
    </Screen>
  );
}

/** Item que saiu do conteúdo (versão nova do app): pula sem registrar nada. */
function SkipMissing({ onSkip }: { onSkip: () => void }) {
  useEffect(() => {
    onSkip();
  }, []);
  return null;
}
