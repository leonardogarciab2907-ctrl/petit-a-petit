// Navegação entre as cinco telas e disparo da sincronização.
import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cloudEnabled, currentSession, signOut, supabase, sync } from './lib/cloud';
import { getKV, getSettings, setKV } from './lib/db';
import { startSession } from './lib/engine';
import type { SessionPlan } from './lib/session';
import { configureSpeech } from './lib/speech';
import EndScreen from './screens/EndScreen';
import Home from './screens/Home';
import Login from './screens/Login';
import SessionScreen from './screens/SessionScreen';
import Settings from './screens/Settings';

type Route = { name: 'loading' } | { name: 'login' } | { name: 'home' } | { name: 'session'; plan: SessionPlan } | { name: 'end'; plan: SessionPlan } | { name: 'settings' };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'loading' });
  const [session, setSession] = useState<Session | null>(null);
  const [syncText, setSyncText] = useState(cloudEnabled ? '' : 'Progresso salvo neste aparelho');
  const [refreshKey, setRefreshKey] = useState(0);
  const syncTimer = useRef<number | undefined>(undefined);

  const runSync = useCallback(async () => {
    if (!cloudEnabled) return;
    const r = await sync();
    setSyncText(r.message);
    if (r.ok) setRefreshKey((k) => k + 1);
  }, []);

  /** Sincroniza alguns segundos depois da última resposta, sem atrapalhar a sessão. */
  const scheduleSync = useCallback(() => {
    window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(runSync, 4000);
  }, [runSync]);

  useEffect(() => {
    (async () => {
      const s = await getSettings();
      configureSpeech({ voice: s.voice, rate: s.audio_rate });
      const sess = await currentSession();
      setSession(sess);
      const localOnly = await getKV('localOnly', false);
      setRoute(cloudEnabled && !sess && !localOnly ? { name: 'login' } : { name: 'home' });
      if (sess) runSync();
    })();
    const sub = supabase?.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_IN') {
        setKV('localOnly', false);
        setRoute((r) => (r.name === 'login' || r.name === 'loading' ? { name: 'home' } : r));
        runSync();
      }
    });
    const online = () => runSync();
    const hidden = () => document.visibilityState === 'hidden' && runSync();
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      sub?.data.subscription.unsubscribe();
      window.removeEventListener('online', online);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [runSync]);

  const goHome = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setRoute({ name: 'home' });
  }, []);

  const onFinish = useCallback(
    (plan: SessionPlan) => {
      setRoute({ name: 'end', plan });
      runSync();
    },
    [runSync],
  );

  switch (route.name) {
    case 'loading':
      return null;
    case 'login':
      return (
        <Login
          onLocalOnly={() => {
            setKV('localOnly', true);
            setRoute({ name: 'home' });
          }}
        />
      );
    case 'home':
      return (
        <Home
          refreshKey={refreshKey}
          syncText={syncText}
          onSettings={() => setRoute({ name: 'settings' })}
          onStart={async () => setRoute({ name: 'session', plan: await startSession() })}
        />
      );
    case 'session':
      return <SessionScreen initial={route.plan} onExit={goHome} onFinish={onFinish} onChange={scheduleSync} />;
    case 'end':
      return <EndScreen plan={route.plan} onHome={goHome} />;
    case 'settings':
      return (
        <Settings
          onBack={goHome}
          email={session?.user.email ?? null}
          syncText={syncText}
          onSync={runSync}
          onSignIn={() => setRoute({ name: 'login' })}
          onSignOut={async () => {
            if (!confirm('Sair da conta? O progresso fica guardado na nuvem e volta quando você entrar de novo.')) return;
            await runSync();
            await signOut();
            setSession(null);
            setRoute({ name: 'login' });
          }}
        />
      );
  }
}
