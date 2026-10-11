-- Petit à Petit: banco do progresso no Supabase.
-- Rodar uma vez no SQL Editor do projeto. Pode rodar de novo sem estragar nada.

-- ---------- tabelas ----------

create table if not exists public.settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  new_per_day int not null default 8,
  retention real not null default 0.9,
  cap_minutes int not null default 15,
  max_reviews int not null default 80,
  audio_rate real not null default 0.9,
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

create table if not exists public.card_state (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  item_id text not null,
  due timestamptz not null,
  stability double precision not null default 0,
  difficulty double precision not null default 0,
  elapsed_days int not null default 0,
  scheduled_days int not null default 0,
  learning_steps int not null default 0,
  reps int not null default 0,
  lapses int not null default 0,
  state smallint not null default 0,
  last_review timestamptz,
  ladder_level smallint not null default 1,
  ladder_streak smallint not null default 0,
  known boolean not null default false,
  updated_at timestamptz not null,
  synced_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create table if not exists public.review_log (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  item_id text not null,
  kind text not null,
  rating smallint not null,
  exercise_type text not null,
  correct boolean,
  duration_ms int not null default 0,
  reviewed_at timestamptz not null,
  day date not null,
  synced_at timestamptz not null default now()
);

create table if not exists public.daily_stats (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  reviews int not null default 0,
  new_items int not null default 0,
  minutes real not null default 0,
  accuracy real,
  done boolean not null default false,
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- Fase 2: botão "reportar erro".
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  item_id text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists card_state_synced on public.card_state (user_id, synced_at);
create index if not exists review_log_synced on public.review_log (user_id, synced_at);
create index if not exists daily_stats_synced on public.daily_stats (user_id, synced_at);

-- ---------- segurança: cada usuário só vê e altera as próprias linhas ----------

alter table public.settings enable row level security;
alter table public.card_state enable row level security;
alter table public.review_log enable row level security;
alter table public.daily_stats enable row level security;
alter table public.reports enable row level security;

drop policy if exists "dono" on public.settings;
create policy "dono" on public.settings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "dono" on public.card_state;
create policy "dono" on public.card_state for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- review_log só recebe inserções (e leitura das próprias linhas).
drop policy if exists "ler" on public.review_log;
create policy "ler" on public.review_log for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "inserir" on public.review_log;
create policy "inserir" on public.review_log for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "dono" on public.daily_stats;
create policy "dono" on public.daily_stats for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "inserir" on public.reports;
create policy "inserir" on public.reports for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "ler" on public.reports;
create policy "ler" on public.reports for select to authenticated using (user_id = (select auth.uid()));

-- ---------- funções de sincronização (rodam com as permissões do próprio usuário) ----------

-- Estado dos cartões: fica a versão com updated_at mais recente.
create or replace function public.sync_card_states(payload jsonb)
returns void language sql security invoker set search_path = '' as $$
  insert into public.card_state (user_id, item_id, due, stability, difficulty, elapsed_days, scheduled_days,
    learning_steps, reps, lapses, state, last_review, ladder_level, ladder_streak, known, updated_at, synced_at)
  select auth.uid(), r.item_id, r.due, r.stability, r.difficulty, r.elapsed_days, r.scheduled_days,
    r.learning_steps, r.reps, r.lapses, r.state, r.last_review, r.ladder_level, r.ladder_streak, r.known, r.updated_at, now()
  from jsonb_to_recordset(payload) as r(item_id text, due timestamptz, stability double precision, difficulty double precision,
    elapsed_days int, scheduled_days int, learning_steps int, reps int, lapses int, state smallint,
    last_review timestamptz, ladder_level smallint, ladder_streak smallint, known boolean, updated_at timestamptz)
  on conflict (user_id, item_id) do update set
    due = excluded.due, stability = excluded.stability, difficulty = excluded.difficulty,
    elapsed_days = excluded.elapsed_days, scheduled_days = excluded.scheduled_days,
    learning_steps = excluded.learning_steps, reps = excluded.reps, lapses = excluded.lapses,
    state = excluded.state, last_review = excluded.last_review, ladder_level = excluded.ladder_level,
    ladder_streak = excluded.ladder_streak, known = excluded.known, updated_at = excluded.updated_at, synced_at = now()
  where public.card_state.updated_at < excluded.updated_at;
$$;

-- Resumo do dia: junta os aparelhos ficando com o maior valor; "feito" vale se qualquer um terminou.
create or replace function public.sync_daily_stats(payload jsonb)
returns void language sql security invoker set search_path = '' as $$
  insert into public.daily_stats (user_id, date, reviews, new_items, minutes, accuracy, done, updated_at, synced_at)
  select auth.uid(), r.date, r.reviews, r.new_items, r.minutes, r.accuracy, r.done, r.updated_at, now()
  from jsonb_to_recordset(payload) as r(date date, reviews int, new_items int, minutes real, accuracy real, done boolean, updated_at timestamptz)
  on conflict (user_id, date) do update set
    reviews = greatest(public.daily_stats.reviews, excluded.reviews),
    new_items = greatest(public.daily_stats.new_items, excluded.new_items),
    minutes = greatest(public.daily_stats.minutes, excluded.minutes),
    accuracy = coalesce(excluded.accuracy, public.daily_stats.accuracy),
    done = public.daily_stats.done or excluded.done,
    updated_at = greatest(public.daily_stats.updated_at, excluded.updated_at),
    synced_at = now();
$$;

create or replace function public.sync_settings(payload jsonb)
returns void language sql security invoker set search_path = '' as $$
  insert into public.settings (user_id, new_per_day, retention, cap_minutes, max_reviews, audio_rate, updated_at, synced_at)
  select auth.uid(), r.new_per_day, r.retention, r.cap_minutes, r.max_reviews, r.audio_rate, r.updated_at, now()
  from jsonb_to_record(payload) as r(new_per_day int, retention real, cap_minutes int, max_reviews int, audio_rate real, updated_at timestamptz)
  on conflict (user_id) do update set
    new_per_day = excluded.new_per_day, retention = excluded.retention, cap_minutes = excluded.cap_minutes,
    max_reviews = excluded.max_reviews, audio_rate = excluded.audio_rate, updated_at = excluded.updated_at, synced_at = now()
  where public.settings.updated_at < excluded.updated_at;
$$;

grant execute on function public.sync_card_states(jsonb) to authenticated;
grant execute on function public.sync_daily_stats(jsonb) to authenticated;
grant execute on function public.sync_settings(jsonb) to authenticated;
revoke execute on function public.sync_card_states(jsonb) from anon, public;
revoke execute on function public.sync_daily_stats(jsonb) from anon, public;
revoke execute on function public.sync_settings(jsonb) from anon, public;
