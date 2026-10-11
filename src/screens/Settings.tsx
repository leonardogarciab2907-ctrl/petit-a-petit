// Ajustes: ritmo, memória, tempo, áudio, lembrete, conta e créditos.
import { type ReactNode, useEffect, useState } from 'react';
import { BackIcon, Button, IconButton, Screen } from '../components/ui';
import { PILLARS, WORDS } from '../lib/content';
import { cloudEnabled } from '../lib/cloud';
import { type Settings as S, DEFAULT_SETTINGS, getSettings, saveSettings } from '../lib/db';
import { configureSpeech, frenchVoices, onVoicesChanged, speak } from '../lib/speech';

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-line py-4">
      <div>
        <p className="font-semibold">{label}</p>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Stepper({ value, min, max, step = 1, unit, onChange }: { value: number; min: number; max: number; step?: number; unit: string; onChange: (v: number) => void }) {
  const btn = 'h-12 w-12 rounded-xl bg-surface text-2xl font-bold text-primary disabled:opacity-30';
  return (
    <div className="flex items-center gap-3">
      <button className={btn} aria-label="Diminuir" disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}>
        −
      </button>
      <span className="min-w-24 text-center text-xl font-semibold tabular-nums">
        {value} {unit}
      </span>
      <button className={btn} aria-label="Aumentar" disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}>
        +
      </button>
    </div>
  );
}

function icsFile(time: string, url: string): string {
  const [h, m] = time.split(':');
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, '0');
  const start = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${h}${m}00`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Petit a Petit//PT-BR',
    'BEGIN:VEVENT',
    `UID:petit-a-petit-${stamp}@lembrete`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    'DURATION:PT10M',
    'RRULE:FREQ=DAILY',
    'SUMMARY:Francês: Petit à Petit (10 min)',
    `DESCRIPTION:Abra o app: ${url}`,
    `URL:${url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:PT0M',
    'DESCRIPTION:Hora do francês!',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export default function Settings({
  onBack,
  email,
  syncText,
  onSync,
  onSignOut,
  onSignIn,
}: {
  onBack: () => void;
  email: string | null;
  syncText: string;
  onSync: () => void;
  onSignOut: () => void;
  onSignIn: () => void;
}) {
  const [s, setS] = useState<S>(DEFAULT_SETTINGS);
  const [voices, setVoices] = useState(frenchVoices());
  const [time, setTime] = useState('20:00');

  useEffect(() => {
    getSettings().then(setS);
    return onVoicesChanged(() => setVoices(frenchVoices()));
  }, []);

  const update = async (patch: Partial<S>) => {
    const next = await saveSettings(patch);
    setS(next);
    configureSpeech({ voice: next.voice, rate: next.audio_rate });
  };

  const downloadReminder = () => {
    const blob = new Blob([icsFile(time, window.location.origin)], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lembrete-frances.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  const select = 'min-h-12 w-full rounded-xl border-2 border-line bg-bg px-3 text-base';

  return (
    <Screen>
      <header className="flex items-center gap-2">
        <IconButton label="Voltar" onClick={onBack}>
          <BackIcon />
        </IconButton>
        <h1 className="text-2xl font-bold">Ajustes</h1>
      </header>

      <Row label="Palavras novas por dia" hint="O padrão é 8. O app reduz sozinho quando as revisões ocupam o teto de tempo.">
        <Stepper value={s.new_per_day} min={0} max={20} unit="por dia" onChange={(v) => update({ new_per_day: v })} />
      </Row>

      <Row label="Meta de retenção" hint="Chance de lembrar cada palavra quando ela volta. Mais alto = mais revisões por dia.">
        <select className={select} value={s.retention} onChange={(e) => update({ retention: Number(e.target.value) })}>
          {[0.8, 0.85, 0.9, 0.95].map((r) => (
            <option key={r} value={r}>
              {Math.round(r * 100)}%{r === 0.9 ? ' (recomendado)' : ''}
            </option>
          ))}
        </select>
      </Row>

      <Row label="Teto de minutos por dia" hint="Se o dia passar disso, o app diminui as palavras novas.">
        <Stepper value={s.cap_minutes} min={5} max={60} step={5} unit="min" onChange={(v) => update({ cap_minutes: v })} />
      </Row>

      <Row label="Máximo de revisões por sessão" hint="Depois de dias sem estudar, o resto fica para o dia seguinte.">
        <Stepper value={s.max_reviews} min={20} max={300} step={20} unit="revisões" onChange={(v) => update({ max_reviews: v })} />
      </Row>

      <Row label="Velocidade do áudio">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0.5}
            max={1.2}
            step={0.05}
            value={s.audio_rate}
            onChange={(e) => update({ audio_rate: Number(e.target.value) })}
            className="h-12 flex-1 accent-[var(--color-primary)]"
            aria-label="Velocidade do áudio"
          />
          <span className="w-12 text-right tabular-nums">{s.audio_rate.toFixed(2)}×</span>
        </div>
        {voices.length > 1 && (
          <select className={select} value={s.voice ?? ''} onChange={(e) => update({ voice: e.target.value || null })} aria-label="Voz">
            <option value="">Voz automática</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        )}
        {voices.length === 0 && <p className="text-sm text-danger">Nenhuma voz francesa encontrada neste aparelho.</p>}
        <Button variant="secondary" onClick={() => speak('Bonjour ! Je suis content de te voir.')}>
          Testar o áudio
        </Button>
      </Row>

      <Row label="Lembrete diário" hint="Cria um evento repetido no calendário do celular. Abra o arquivo baixado e toque em Adicionar.">
        <div className="flex gap-2">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${select} w-32`} aria-label="Horário do lembrete" />
          <Button variant="secondary" className="flex-1" onClick={downloadReminder}>
            Criar lembrete
          </Button>
        </div>
      </Row>

      <Row label="Conta" hint={cloudEnabled ? syncText : 'Este app está sem nuvem configurada: o progresso fica só neste aparelho.'}>
        {cloudEnabled && email && (
          <>
            <p className="text-sm">
              Conectado como <strong>{email}</strong>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={onSync}>
                Sincronizar
              </Button>
              <Button variant="danger" onClick={onSignOut}>
                Sair da conta
              </Button>
            </div>
          </>
        )}
        {cloudEnabled && !email && (
          <Button variant="secondary" onClick={onSignIn}>
            Entrar para sincronizar
          </Button>
        )}
      </Row>

      <div className="py-6 text-sm text-muted">
        <p>
          Conteúdo: {WORDS.length} palavras e {PILLARS.length} pilares, em ordem aproximada de frequência no francês falado.
        </p>
        <p className="mt-1">Repetição espaçada com FSRS (biblioteca ts-fsrs). Áudio pela voz do próprio aparelho.</p>
        <p className="mt-1">Versão {__APP_VERSION__}</p>
      </div>
    </Screen>
  );
}
