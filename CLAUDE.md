# Petit à Petit

App de celular (PWA) para aprender francês em ~10 min/dia: 8 palavras novas por dia dentro de frases
curtas, repetição espaçada FSRS (retenção 90%) e escada de exercícios. Plano original: `docs/plano.md`.

## Como rodar (Node 24 em `C:\Program Files\nodejs`, que pode não estar no PATH do shell)

- `npm run dev` — servidor local (ou `preview_start` com `petit-a-petit` em `Projetos/.claude/launch.json`)
- `npm test` — testes (vitest, 18 testes)
- `npm run conteudo` — valida `content/` e gera `src/content/*.json` (o build já roda isso)
- `npm run build` — conteúdo + checagem de tipos + build PWA em `dist/`
- `npm run icones` — regera os ícones em `public/`

## Onde está cada coisa

- `content/palavras/*.txt` — as 300 palavras (formato em `docs/conteudo.md`); `content/pilares.json` — 16 pilares
- `scripts/validacao.ts` — regras do conteúdo (frases só com palavras já estudadas); `scripts/conteudo.ts` — gera o JSON
- `src/lib/` — `text.ts` (tokens/normalização), `content.ts`, `grade.ts` (correção), `ladder.ts`, `srs.ts` (FSRS),
  `session.ts` (plano do dia, estimativa, tetos), `engine.ts` (executa a sessão e grava), `exercises.ts`,
  `db.ts` (Dexie/IndexedDB), `cloud.ts` (Supabase: login e sync), `speech.ts` (voz do aparelho)
- `src/screens/` — Login, Home, SessionScreen, EndScreen, Settings; `src/components/` — cartões, exercícios, gráfico
- `supabase/schema.sql` — tabelas, RLS e funções de sync (rodar no SQL Editor)
- `docs/` — `arquitetura.md` (decisões e desvios do plano), `conteudo.md`, `publicar.md` (passo a passo da nuvem)

## Status (2026-10-11)

Fase 1 construída e testada localmente (sessão completa, erros voltando no fim, "cafe" aceito, offline via
service worker, estimativa antes de começar). Falta publicar: contas GitHub/Supabase/Vercel do usuário,
`.env` com a URL e a chave pública do Supabase, deploy e teste no celular. Ver `docs/publicar.md`.

Próximo: fase 2 (falar, trocar uma peça, traduzir frase, reportar erro, conteúdo até 600) antes de ~5 semanas de uso.
