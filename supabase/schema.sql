create table if not exists public.words (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 term text not null,
 meaning text not null,
 example text not null default '',
 category text not null default '일반',
 correct_count integer not null default 0,
 wrong_count integer not null default 0,
 interval_days integer not null default 0,
 due_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 constraint nonempty_term check (length(trim(term)) > 0),
 constraint nonempty_meaning check (length(trim(meaning)) > 0)
);
create index if not exists words_user_due on public.words(user_id,due_at);
create table if not exists public.reviews (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 word_id uuid not null references public.words(id) on delete cascade,
 mode text not null,
 correct boolean not null,
 created_at timestamptz not null default now()
);
create index if not exists reviews_user_created on public.reviews(user_id,created_at desc);
alter table public.words enable row level security;
alter table public.reviews enable row level security;
create policy "Own words select" on public.words for select to authenticated using (auth.uid() = user_id);
create policy "Own words insert" on public.words for insert to authenticated with check (auth.uid() = user_id);
create policy "Own words update" on public.words for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own words delete" on public.words for delete to authenticated using (auth.uid() = user_id);
create policy "Own reviews select" on public.reviews for select to authenticated using (auth.uid() = user_id);
create policy "Own reviews insert" on public.reviews for insert to authenticated with check (auth.uid() = user_id and exists (select 1 from public.words where id = word_id and user_id = auth.uid()));
