// Entrar: e-mail → link mágico. No iPhone o link abre no Safari, fora do app instalado,
// então o mesmo e-mail traz um código de 6 dígitos para digitar aqui.
import { useState } from 'react';
import { Button, Screen } from '../components/ui';
import { sendLoginEmail, verifyCode } from '../lib/cloud';

export default function Login({ onLocalOnly }: { onLocalOnly: () => void }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    const err = navigator.onLine ? await sendLoginEmail(email.trim()) : 'Sem internet. Conecte-se para entrar.';
    setBusy(false);
    if (err) setError(err);
    else setSent(true);
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const err = await verifyCode(email.trim(), code);
    setBusy(false);
    if (err) setError(err);
  };

  const field = 'min-h-14 w-full rounded-xl border-2 border-line bg-bg px-4 text-lg outline-none focus:border-primary';

  return (
    <Screen className="justify-center gap-6">
      <div>
        <h1 className="text-4xl font-bold">
          Petit <span className="text-primary">à</span> Petit
        </h1>
        <p className="mt-2 text-lg text-muted">Francês em 10 minutos por dia.</p>
      </div>

      {!sent ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label className="text-sm font-semibold" htmlFor="email">
            Seu e-mail
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
            placeholder="voce@exemplo.com"
          />
          <Button type="submit" disabled={busy || !email.includes('@')}>
            {busy ? 'Enviando…' : 'Enviar link'}
          </Button>
        </form>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            confirm();
          }}
        >
          <p>
            Enviamos um e-mail para <strong>{email}</strong>. Toque no link do e-mail <em>ou</em> digite aqui o código de 6 dígitos que veio nele.
          </p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className={`${field} text-center text-2xl tracking-[0.4em]`}
            placeholder="000000"
            aria-label="Código do e-mail"
          />
          <Button type="submit" disabled={busy || code.length < 6}>
            {busy ? 'Entrando…' : 'Entrar'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setSent(false)}>
            Usar outro e-mail
          </Button>
        </form>
      )}

      {error && (
        <p className="rounded-xl bg-danger-soft p-3 text-danger" role="alert">
          {error}
        </p>
      )}

      <button className="min-h-11 text-sm text-muted underline" onClick={onLocalOnly}>
        Usar sem conta (só neste aparelho)
      </button>
    </Screen>
  );
}
