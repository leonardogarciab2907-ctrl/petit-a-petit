# Publicar (GitHub → Vercel, Supabase)

O usuário cria as contas e faz os logins; o resto é feito pelo Claude Code (navegador embutido + terminal).
Planos gratuitos: Supabase (https://supabase.com/pricing) e Vercel Hobby (https://vercel.com/docs/plans/hobby).

## 1. Supabase (nuvem do progresso)

1. Criar conta e um projeto `petit-a-petit` (região São Paulo, senha do banco gerada pelo próprio Supabase).
2. SQL Editor → colar `supabase/schema.sql` → Run. (Pode rodar de novo sem estragar nada.)
3. Authentication → Sign In / Providers → Email: ligado, "Confirm email" ligado.
4. Authentication → Emails → modelo **Magic Link**: incluir o código, por exemplo
   `<p>Seu código: <strong>{{ .Token }}</strong></p><p><a href="{{ .ConfirmationURL }}">Ou toque aqui para entrar</a></p>`.
   Fazer o mesmo no modelo **Confirm signup** (primeiro acesso).
5. Authentication → URL Configuration: Site URL = endereço da Vercel; Redirect URLs = endereço da Vercel e
   `http://localhost:5173`.
6. Project Settings → API Keys: copiar a URL do projeto e a chave **publishable** (ou anon) para o `.env`:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_KEY=sb_publishable_...
   ```
   Essa chave é pública por desenho (vai dentro do app); quem protege os dados é o RLS. Nunca usar a `service_role`/secret.
7. O plano grátis pausa o projeto depois de 1 semana sem uso. O app continua offline; reativar no painel.

## 2. GitHub (código)

1. Criar conta e um repositório **privado** vazio `petit-a-petit` (sem README).
2. `git remote add origin https://github.com/<usuario>/petit-a-petit.git` e `git push -u origin main`
   (o Git Credential Manager abre o navegador para o usuário autorizar).

## 3. Vercel (publicação com HTTPS)

1. Criar conta entrando com o GitHub.
2. Add New → Project → importar `petit-a-petit` → Framework: Vite (build `npm run build`, saída `dist`) → Deploy.
3. Cada `git push` publica de novo sozinho.
4. Se o build falhar por binário nativo faltando (rolldown/typescript no Linux), apagar `package-lock.json`,
   rodar `npm install` e enviar de novo.

## 4. Celular

Abrir o endereço da Vercel no Safari (iPhone) ou Chrome (Android) → Compartilhar → "Adicionar à Tela de Início".
Entrar com o e-mail (digitar o código de 6 dígitos que chega). Instalar a voz francesa se o app avisar.
