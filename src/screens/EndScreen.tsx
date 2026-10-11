// Fim da sessão: acertos, tempo, palavras novas e o gráfico atualizado.
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import HistoryChart from '../components/HistoryChart';
import { Button, Screen } from '../components/ui';
import { db } from '../lib/db';
import { sessionSummary } from '../lib/engine';
import type { SessionPlan } from '../lib/session';

type Summary = Awaited<ReturnType<typeof sessionSummary>>;

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-surface p-4 text-center">
      <p className="text-3xl font-bold tabular-nums">{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

export default function EndScreen({ plan, onHome }: { plan: SessionPlan; onHome: () => void }) {
  const [s, setS] = useState<Summary | null>(null);
  const stats = useLiveQuery(() => db.stats.toArray(), [], []);
  useEffect(() => {
    sessionSummary(plan).then(setS);
  }, [plan]);

  return (
    <Screen className="gap-4">
      <div className="pt-6 text-center">
        <p className="text-5xl" aria-hidden="true">
          🎉
        </p>
        <h1 className="mt-2 text-3xl font-bold">Sessão concluída!</h1>
        <p className="text-muted">Meta de hoje cumprida. À demain !</p>
      </div>
      {s && (
        <div className="grid grid-cols-2 gap-3">
          <Stat value={s.accuracy === null ? '–' : `${Math.round(s.accuracy * 100)}%`} label={`acertos (${s.right} de ${s.answered})`} />
          <Stat value={`${Math.max(1, Math.round(s.minutes))} min`} label="de estudo" />
          <Stat value={String(s.newWords)} label="palavras novas" />
          <Stat value={String(s.reviews)} label="revisões" />
        </div>
      )}
      <HistoryChart stats={stats} />
      <div className="mt-auto pb-2">
        <Button className="w-full" onClick={onHome}>
          Voltar ao início
        </Button>
      </div>
    </Screen>
  );
}
