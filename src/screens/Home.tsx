// Tela inicial: tamanho do dia, botão Começar e gráfico do histórico.
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import HistoryChart from '../components/HistoryChart';
import { Button, GearIcon, IconButton, Screen } from '../components/ui';
import { WORDS } from '../lib/content';
import { db, getKV, localDate, setKV } from '../lib/db';
import { computePreview, getSavedPlan } from '../lib/engine';
import type { DayPreview, SessionPlan } from '../lib/session';
import { hasFrenchVoice, onVoicesChanged, ttsSupported } from '../lib/speech';

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export default function Home({
  onStart,
  onSettings,
  syncText,
  refreshKey,
}: {
  onStart: () => void;
  onSettings: () => void;
  syncText: string;
  refreshKey: number;
}) {
  const [preview, setPreview] = useState<DayPreview | null>(null);
  const [saved, setSaved] = useState<SessionPlan | null>(null);
  const [voiceWarning, setVoiceWarning] = useState(false);
  const stats = useLiveQuery(() => db.stats.toArray(), [], []);
  const seenCount = useLiveQuery(() => db.cards.where('item_id').startsWith('w-').count(), [], 0);
  const today = stats.find((s) => s.date === localDate());

  useEffect(() => {
    computePreview().then(setPreview);
    getSavedPlan().then(setSaved);
  }, [refreshKey, stats.length]);

  // Aviso único quando o aparelho não tem voz francesa.
  useEffect(() => {
    if (!ttsSupported()) return;
    const check = async () => {
      if (hasFrenchVoice() || (await getKV('voiceWarned', false))) return;
      setVoiceWarning(true);
    };
    const t = setTimeout(check, 1500);
    const off = onVoicesChanged(() => hasFrenchVoice() && setVoiceWarning(false));
    return () => {
      clearTimeout(t);
      off();
    };
  }, []);

  const minutes = preview ? Math.max(1, Math.round(preview.seconds / 60)) : 0;
  const nothingToDo = preview && !saved && preview.reviews.length === 0 && preview.newWords.length === 0;
  const allLearned = seenCount >= WORDS.length;

  return (
    <Screen className="gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Petit <span className="text-primary">à</span> Petit
          </h1>
          <p className="text-xs text-muted">{syncText}</p>
        </div>
        <IconButton label="Ajustes" onClick={onSettings}>
          <GearIcon />
        </IconButton>
      </header>

      {voiceWarning && (
        <div className="rounded-2xl border border-line bg-surface p-4 text-sm">
          <p className="font-semibold">Seu aparelho não tem voz em francês</p>
          <p className="mt-1 text-muted">
            O áudio usa a voz do próprio celular. Para instalar: no iPhone, Ajustes › Acessibilidade › Conteúdo Falado › Vozes › Francês. No
            Android, Configurações › Gerenciamento geral › Conversão de texto em voz › Instalar dados de voz › Francês. Depois, feche e abra o app.
          </p>
          <Button
            variant="secondary"
            className="mt-3 w-full"
            onClick={() => {
              setVoiceWarning(false);
              setKV('voiceWarned', true);
            }}
          >
            Entendi
          </Button>
        </div>
      )}

      <section className="rounded-2xl bg-primary-soft p-5">
        <p className="text-sm font-semibold tracking-wide text-primary uppercase">Hoje</p>
        {!preview ? (
          <p className="mt-2 text-muted">Carregando…</p>
        ) : saved ? (
          <>
            <p className="mt-1 text-2xl font-bold">Sessão em andamento</p>
            <p className="mt-1 text-muted">
              Você parou no passo {saved.pos + 1} de {saved.steps.length}.
            </p>
            <Button className="mt-4 w-full" onClick={onStart}>
              Continuar
            </Button>
          </>
        ) : nothingToDo ? (
          <>
            <p className="mt-1 text-2xl font-bold">{today?.done ? 'Meta de hoje cumprida ✓' : 'Nada para hoje'}</p>
            <p className="mt-1 text-muted">
              {allLearned ? 'Você já viu todas as palavras desta versão. As revisões continuam.' : 'Volte amanhã para novas palavras e revisões.'}
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-2xl font-bold">
              {plural(preview.reviews.length, 'revisão', 'revisões')} + {plural(preview.newWords.length, 'nova', 'novas')}
            </p>
            <p className="mt-1 text-muted">
              ≈ {minutes} min{preview.pillars.length > 0 && ` · inclui ${plural(preview.pillars.length, 'cartão', 'cartões')} de pilar`}
            </p>
            {preview.notes.map((n) => (
              <p key={n} className="mt-2 text-sm text-muted">
                {n}
              </p>
            ))}
            <Button className="mt-4 w-full" onClick={onStart}>
              Começar
            </Button>
          </>
        )}
      </section>

      <HistoryChart stats={stats} />

      <p className="text-center text-xs text-muted">
        {seenCount} de {WORDS.length} palavras vistas
      </p>
    </Screen>
  );
}
