-- =============================================================================
-- Kinofan: Supabase schema (xonalar va chat)
-- Video bazada saqlanmaydi — host qurilmasidan WebRTC orqali strim qilinadi,
-- hajm cheklovi yo'q. Ushbu jadvalar faqat xona va chat uchun.
-- =============================================================================
-- Ishga tushirish: Supabase Dashboard > SQL Editor da barcha blokni bajarng.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Xonalar (id, host_id, created_at)
-- -----------------------------------------------------------------------------
create table if not exists public.rooms (
  id text primary key,
  host_id text,
  created_at timestamptz default now()
);

alter table public.rooms enable row level security;

drop policy if exists "Allow anonymous read rooms" on public.rooms;
create policy "Allow anonymous read rooms"
  on public.rooms for select to anon using (true);

drop policy if exists "Allow anonymous insert rooms" on public.rooms;
create policy "Allow anonymous insert rooms"
  on public.rooms for insert to anon with check (true);

drop policy if exists "Allow anonymous update rooms" on public.rooms;
create policy "Allow anonymous update rooms"
  on public.rooms for update to anon using (true) with check (true);

-- -----------------------------------------------------------------------------
-- Chat xabarlari (cheklovsiz — faqat matn, video yoki fayl hajmi yo'q)
-- -----------------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms(id) on delete cascade,
  sender_id text not null,
  nickname text not null default 'Guest',
  text text not null,
  created_at timestamptz default now()
);

-- Tez qidiruv uchun room_id bo'yicha index
create index if not exists idx_messages_room_id on public.messages(room_id);
create index if not exists idx_messages_created_at on public.messages(room_id, created_at);

alter table public.messages enable row level security;

drop policy if exists "Allow anonymous read messages" on public.messages;
create policy "Allow anonymous read messages"
  on public.messages for select to anon using (true);

drop policy if exists "Allow anonymous insert messages" on public.messages;
create policy "Allow anonymous insert messages"
  on public.messages for insert to anon with check (true);

-- -----------------------------------------------------------------------------
-- Realtime: chat yangilanishlarini tinglash uchun
-- -----------------------------------------------------------------------------
-- Agar "already a member of publication" xatosi chiqsa, bu qatorni o'tkazing.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
