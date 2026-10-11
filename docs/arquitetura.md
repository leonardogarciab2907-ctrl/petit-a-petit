# Arquitetura e decisões

Stack do plano: React 19 + Vite 8 + TypeScript 7 + Tailwind 4, vite-plugin-pwa (service worker gerado pelo
Workbox, pré-cache de tudo), ts-fsrs 5, Dexie 4 (IndexedDB), Supabase JS 2, Recharts 3. Vercel ligada ao GitHub.
O Controle Inteligente de Aplicativos não bloqueou os binários nativos do Vite/TS (testado em 2026-10-11).

## Fluxo de dados

- Tudo é gravado primeiro no IndexedDB (`src/lib/db.ts`). Linhas com `dirty = 1` são a fila de envio.
- `cloud.ts` envia a fila: `review_log` só por inserção (UUID do aparelho, duplicata ignorada); `card_state`
  pela função `sync_card_states` (fica o `updated_at` mais recente); `daily_stats` por `sync_daily_stats`
  (fica o maior valor, "feito" se qualquer aparelho terminou); ajustes por `sync_settings`.
- Para baixar, usa a coluna `synced_at` (hora do servidor) como cursor, com 1 min de margem.
- A sincronização roda ao abrir, ao voltar a internet, ao esconder o app e 4 s depois de cada resposta.

## Sessão

- `session.ts` monta o dia: revisões vencidas até o fim do dia, ordenadas pela menor chance de lembrar
  (retrievability), no máximo 80; depois as próximas palavras não vistas (8 menos as já aprendidas hoje), com o
  pilar antes da palavra que o abre; depois o mini quiz embaralhado. Se a estimativa passar do teto (15 min),
  tira palavras novas até caber.
- Estimativa: revisões × 10 s + novas (e pilares) × 40 s + 90 s de quiz; com 7 dias de histórico usa a média real.
- `engine.ts` grava cada passo na hora (o plano fica em `kv.session`, então a sessão continua de onde parou).
- FSRS com `enable_short_term: false` (intervalos em dias). Só a primeira resposta do dia vai para o FSRS e
  para a escada; o erro volta no fim como passo `retry`, que só treina.
- A palavra nova recebe a primeira nota no mini quiz. Pilares também entram no quiz (cartão "revelar").

## Desvios do plano (e por quê)

1. **Palavra-ponte:** no 1º dia a frase aceita até 2 pontes, porque a primeira palavra (je) não forma frase
   de 3 palavras com só 1 ponte. Dias 2–5: 1 ponte, como no plano.
2. **Login:** além do link mágico, o e-mail traz um código de 6 dígitos. No iPhone, o link abre no Safari e
   não no app instalado (armazenamento separado); o código resolve. Exige editar o modelo de e-mail no Supabase
   (ver `publicar.md`).
3. **"Usar sem conta":** opção na tela de entrada para usar só no aparelho (útil offline e para testar).
4. **Lembrete:** botão nos Ajustes que baixa um evento diário `.ics` para o calendário (o lembrete continua fora do app).
5. **"cafe" sem artigo:** vale Difícil (faltou o artigo) e mostra "le café" com artigo e acento destacados;
   "le cafe" vale Bom. Segue a tabela de notas do plano.
6. **Ordem das palavras:** aproximada (sem o arquivo do Lexique, por escolha do usuário).
7. **Gráfico:** uma série (minutos por dia) numa cor só; o dia cumprido aparece no texto e na dica ao tocar.
