// Gráfico do histórico: minutos estudados por dia (uma série, uma cor). O dia com a meta
// cumprida aparece no texto acima e na dica ao tocar na barra, não só pela cor.
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { type StatRow, localDate } from '../lib/db';

interface Point {
  date: string;
  label: string;
  minutes: number;
  done: boolean;
}

function lastDays(stats: StatRow[], days: number): Point[] {
  const byDate = new Map(stats.map((s) => [s.date, s]));
  const out: Point[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i, 12);
    const key = localDate(d.getTime());
    const s = byDate.get(key);
    out.push({
      date: key,
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      minutes: s ? Math.round(s.minutes * 10) / 10 : 0,
      done: !!s?.done,
    });
  }
  return out;
}

function TipBox({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-bg px-3 py-2 text-sm shadow">
      <p className="font-semibold">{p.label}</p>
      <p>{p.minutes.toLocaleString('pt-BR')} min</p>
      {p.done && <p className="text-primary">✓ meta cumprida</p>}
    </div>
  );
}

export default function HistoryChart({ stats }: { stats: StatRow[] }) {
  const [days, setDays] = useState<30 | 90>(30);
  const data = lastDays(stats, days);
  const done = data.filter((d) => d.done).length;
  const total = data.reduce((s, d) => s + d.minutes, 0);
  const streak = (() => {
    let n = 0;
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].done) n++;
      else if (i === data.length - 1) continue; // hoje ainda pode estar em aberto
      else break;
    }
    return n;
  })();

  return (
    <section className="rounded-2xl bg-surface p-4" aria-label="Histórico de estudo">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">Minutos por dia</h2>
        <div className="flex rounded-lg border border-line p-0.5 text-sm" role="group" aria-label="Período">
          {([30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              aria-pressed={days === d}
              className={`min-h-9 rounded-md px-3 ${days === d ? 'bg-primary text-primary-ink' : 'text-muted'}`}
            >
              {d} dias
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">
        {done} {done === 1 ? 'dia cumprido' : 'dias cumpridos'} · {Math.round(total)} min no total
        {streak > 1 && ` · ${streak} dias seguidos`}
      </p>
      <div className="mt-3 h-40" role="img" aria-label={`Gráfico de barras: minutos estudados em cada um dos últimos ${days} dias`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: -24 }} barCategoryGap={days === 30 ? 2 : 1}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" strokeDasharray="0" />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-line)' }}
              interval={days === 30 ? 6 : 14}
            />
            <YAxis tick={{ fill: 'var(--color-muted)', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={48} />
            <Tooltip content={<TipBox />} cursor={{ fill: 'var(--color-primary-soft)' }} />
            <Bar dataKey="minutes" fill="var(--color-primary)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
