-- Partaza: duomenų bazės schema ir saugumo taisyklės („Supabase“ / „Postgres“).
-- Kaip paleisti: „Supabase“ skydelyje atidarykite SQL Editor, įklijuokite visą šį failą
-- ir paspauskite Run. Failą galima paleisti pakartotinai – jis nieko nedubliuoja.

-- ---------------------------------------------------------------------------
-- Lentelės
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null default 'private' check (kind in ('private', 'business')),
  created_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  price numeric(10, 2) not null check (price > 0),
  vat boolean not null default false,
  condition text not null check (condition in ('new', 'used', 'refurbished')),
  defects text[] not null default '{}',
  oem text not null default '',
  fits text not null default '',
  vehicle_type text not null check (
    vehicle_type in ('car', 'motorcycle', 'truck', 'boat', 'moped', 'scooter', 'kart', 'bicycle')
  ),
  city text not null check (char_length(city) between 1 and 80),
  country text not null default 'Lietuva',
  shipping numeric(10, 2) check (shipping is null or shipping >= 0),
  pickup boolean not null default true,
  photos text[] not null default '{}',
  allow_offers boolean not null default true,
  status text not null default 'active' check (status in ('active', 'sold', 'hidden')),
  created_at timestamptz not null default now()
);

create index if not exists listings_created_idx on public.listings (created_at desc);
create index if not exists listings_seller_idx on public.listings (seller_id);
-- Paieška pagal dalies kodą be tarpų ir didžiosiomis raidėmis.
create index if not exists listings_oem_idx on public.listings (upper(replace(oem, ' ', '')));

create table if not exists public.threads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id),
  check (buyer_id <> seller_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('text', 'offer')),
  body text check (body is null or char_length(body) <= 2000),
  amount numeric(10, 2),
  status text check (status in ('pending', 'accepted', 'declined', 'countered')),
  created_at timestamptz not null default now(),
  check (
    (kind = 'text' and body is not null and char_length(body) > 0 and amount is null and status is null)
    or (kind = 'offer' and amount is not null and amount > 0 and status is not null)
  )
);

create index if not exists messages_thread_idx on public.messages (thread_id, created_at);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null default '',
  created_at timestamptz not null default now(),
  unique (listing_id, reporter_id)
);

-- ---------------------------------------------------------------------------
-- Teisės ir eilučių lygio saugumas (RLS)
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.listings to anon;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.listings to authenticated;
grant select, insert on public.threads to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert on public.reports to authenticated;

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.threads enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;

-- Profiliai: vardą ir statusą mato visi, keisti gali tik savininkas.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (true);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Skelbimai: aktyvius mato visi, savo mato savininkas; kurti ir keisti gali tik savininkas.
drop policy if exists listings_read on public.listings;
create policy listings_read on public.listings for select
  using (status = 'active' or seller_id = (select auth.uid()));
drop policy if exists listings_insert_own on public.listings;
create policy listings_insert_own on public.listings for insert to authenticated
  with check (seller_id = (select auth.uid()));
drop policy if exists listings_update_own on public.listings;
create policy listings_update_own on public.listings for update to authenticated
  using (seller_id = (select auth.uid())) with check (seller_id = (select auth.uid()));
drop policy if exists listings_delete_own on public.listings;
create policy listings_delete_own on public.listings for delete to authenticated
  using (seller_id = (select auth.uid()));

-- Pokalbiai: mato tik pirkėjas ir pardavėjas; pradėti gali tik pirkėjas, ir tik su tikru
-- skelbimo pardavėju.
drop policy if exists threads_read on public.threads;
create policy threads_read on public.threads for select to authenticated
  using ((select auth.uid()) in (buyer_id, seller_id));
drop policy if exists threads_insert_buyer on public.threads;
create policy threads_insert_buyer on public.threads for insert to authenticated
  with check (
    buyer_id = (select auth.uid())
    and seller_id = (select l.seller_id from public.listings l where l.id = listing_id and l.status = 'active')
  );

-- Žinutės: mato tik pokalbio dalyviai. Tiesiogiai įrašyti galima tik tekstinę žinutę savo vardu;
-- pasiūlymai kuriami ir atsakomi tik per žemiau esančias funkcijas.
drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.threads t
      where t.id = thread_id and (select auth.uid()) in (t.buyer_id, t.seller_id)
    )
  );
drop policy if exists messages_insert_text on public.messages;
create policy messages_insert_text on public.messages for insert to authenticated
  with check (
    kind = 'text'
    and sender_id = (select auth.uid())
    and exists (
      select 1 from public.threads t
      where t.id = thread_id and (select auth.uid()) in (t.buyer_id, t.seller_id)
    )
  );

-- Pranešimai apie skelbimus: kiekvienas mato tik savo.
drop policy if exists reports_read_own on public.reports;
create policy reports_read_own on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()));
drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Funkcijos
-- ---------------------------------------------------------------------------

-- Užsiregistravus automatiškai sukuriamas profilis iš registracijos duomenų.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, kind)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), 'Naudotojas'),
    case when new.raw_user_meta_data ->> 'kind' = 'business' then 'business' else 'private' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Kainos pasiūlymas. Ankstesni neatsakyti pasiūlymai tame pokalbyje pažymimi „countered“.
create or replace function public.send_offer(p_thread uuid, p_amount numeric, p_body text default null)
returns public.messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_thread public.threads;
  v_listing public.listings;
  v_message public.messages;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_thread from public.threads where id = p_thread;
  if not found or v_me not in (v_thread.buyer_id, v_thread.seller_id) then
    raise exception 'not_a_participant';
  end if;
  select * into v_listing from public.listings where id = v_thread.listing_id;
  if v_listing.status <> 'active' then
    raise exception 'listing_not_active';
  end if;
  if not v_listing.allow_offers then
    raise exception 'offers_not_allowed';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount >= v_listing.price then
    raise exception 'amount_out_of_range';
  end if;

  update public.messages
    set status = 'countered'
    where thread_id = p_thread and kind = 'offer' and status = 'pending';

  insert into public.messages (thread_id, sender_id, kind, body, amount, status)
  values (p_thread, v_me, 'offer', nullif(trim(coalesce(p_body, '')), ''), round(p_amount, 2), 'pending')
  returning * into v_message;
  return v_message;
end;
$$;

-- Atsakymas į pasiūlymą: priimti arba atmesti gali tik kita pokalbio pusė, ne pasiūlymo autorius.
create or replace function public.answer_offer(p_message uuid, p_status text)
returns public.messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_message public.messages;
  v_thread public.threads;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if p_status not in ('accepted', 'declined') then
    raise exception 'invalid_status';
  end if;
  select * into v_message from public.messages where id = p_message;
  if not found or v_message.kind <> 'offer' or v_message.status <> 'pending' then
    raise exception 'offer_not_pending';
  end if;
  select * into v_thread from public.threads where id = v_message.thread_id;
  if v_me not in (v_thread.buyer_id, v_thread.seller_id) or v_me = v_message.sender_id then
    raise exception 'not_allowed';
  end if;
  update public.messages set status = p_status where id = p_message returning * into v_message;
  return v_message;
end;
$$;

-- Paskyros ištrynimas pačioje programėlėje („App Store“ reikalavimas). Ištrynus naudotoją,
-- kartu ištrinami jo profilis, skelbimai, pokalbiai ir žinutės.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.send_offer(uuid, numeric, text) from public, anon;
revoke all on function public.answer_offer(uuid, text) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.send_offer(uuid, numeric, text) to authenticated;
grant execute on function public.answer_offer(uuid, text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- Nuotraukų saugykla
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

-- Nuotraukas mato visi (viešas kibiras); įkelti ir trinti galima tik savo aplanke <naudotojo id>/...
drop policy if exists listing_photos_list_own on storage.objects;
create policy listing_photos_list_own on storage.objects for select to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists listing_photos_insert_own on storage.objects;
create policy listing_photos_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists listing_photos_delete_own on storage.objects;
create policy listing_photos_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Žinutės realiu laiku
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 0.3: istorinių automobilių dalys, ardomi automobiliai ir pardavėjo apskaita
-- ---------------------------------------------------------------------------

alter table public.listings add column if not exists classic boolean not null default false;

-- Ardomas automobilis („donoras“). Mato tik jo savininkas.
create table if not exists public.donors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  vin text not null default '',
  cost numeric(10, 2) not null default 0 check (cost >= 0),
  created_at timestamptz not null default now()
);

-- Privatūs skelbimo skaičiai: už kiek pirkta, iš kurio automobilio, už kiek parduota.
-- Laikomi atskirai nuo viešos skelbimų lentelės, kad pirkėjai jų niekada negautų.
create table if not exists public.listing_finance (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  donor_id uuid references public.donors (id) on delete set null,
  cost numeric(10, 2) check (cost is null or cost >= 0),
  sold_price numeric(10, 2) check (sold_price is null or sold_price >= 0),
  sold_at timestamptz
);

grant select, insert, update, delete on public.donors, public.listing_finance to authenticated;
alter table public.donors enable row level security;
alter table public.listing_finance enable row level security;

drop policy if exists donors_own on public.donors;
create policy donors_own on public.donors for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists listing_finance_own on public.listing_finance;
create policy listing_finance_own on public.listing_finance for all to authenticated
  using (seller_id = (select auth.uid()))
  with check (
    seller_id = (select auth.uid())
    and exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = (select auth.uid()))
    and (donor_id is null or exists (select 1 from public.donors d where d.id = donor_id and d.owner_id = (select auth.uid())))
  );

-- ---------------------------------------------------------------------------
-- 0.4: telefono numeris būtinas registruojantis
-- ---------------------------------------------------------------------------

-- Numeris laikomas privačiuose paskyros duomenyse (auth.users), ne viešame profilyje.
-- Registracija be tinkamo numerio atmetama pačiame serveryje.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'phone', '') !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'phone_required';
  end if;
  insert into public.profiles (id, name, kind)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), 'Naudotojas'),
    case when new.raw_user_meta_data ->> 'kind' = 'business' then 'business' else 'private' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 0.4: nepatvirtintos paskyros ištrinamos savaime po 15 minučių
-- ---------------------------------------------------------------------------

create or replace function public.purge_unconfirmed_accounts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from auth.users
    where email_confirmed_at is null
      and created_at < now() - interval '15 minutes';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.purge_unconfirmed_accounts() from public, anon, authenticated;

-- Paleidžiama kas minutę per „pg_cron“ (yra „Supabase“; vietiniuose bandymuose praleidžiama).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';
    execute $job$select cron.schedule('partaza-purge-unconfirmed', '* * * * *', 'select public.purge_unconfirmed_accounts()')$job$;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 0.5: visas automobilis dalims vienu skelbimu
-- ---------------------------------------------------------------------------

alter table public.listings add column if not exists whole_vehicle boolean not null default false;

-- 0.5: kada pardavėjas paskutinį kartą sumažino kainą (nuo čia skaičiuojamas 90 dienų priminimas)
alter table public.listings add column if not exists refreshed_at timestamptz;

-- ---------------------------------------------------------------------------
-- 0.5: naudotojų blokavimas („App Store“ reikalavimas turiniui, kurį kuria naudotojai)
-- ---------------------------------------------------------------------------
-- Užblokavus: abi pusės nebegali pradėti pokalbio, rašyti žinučių ir siūlyti kainos viena kitai.

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

grant select, insert, delete on public.blocks to authenticated;
alter table public.blocks enable row level security;

drop policy if exists blocks_own on public.blocks;
create policy blocks_own on public.blocks for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));

create or replace function public.blocked_with(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker_id = (select auth.uid()) and b.blocked_id = p_other)
       or (b.blocker_id = p_other and b.blocked_id = (select auth.uid()))
  );
$$;
revoke all on function public.blocked_with(uuid) from public, anon;
grant execute on function public.blocked_with(uuid) to authenticated;

drop policy if exists threads_insert_buyer on public.threads;
create policy threads_insert_buyer on public.threads for insert to authenticated
  with check (
    buyer_id = (select auth.uid())
    and seller_id = (select l.seller_id from public.listings l where l.id = listing_id and l.status = 'active')
    and not public.blocked_with(seller_id)
  );

drop policy if exists messages_insert_text on public.messages;
create policy messages_insert_text on public.messages for insert to authenticated
  with check (
    kind = 'text'
    and sender_id = (select auth.uid())
    and exists (
      select 1 from public.threads t
      where t.id = thread_id
        and (select auth.uid()) in (t.buyer_id, t.seller_id)
        and not public.blocked_with(case when t.buyer_id = (select auth.uid()) then t.seller_id else t.buyer_id end)
    )
  );

create or replace function public.send_offer(p_thread uuid, p_amount numeric, p_body text default null)
returns public.messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_thread public.threads;
  v_listing public.listings;
  v_message public.messages;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_thread from public.threads where id = p_thread;
  if not found or v_me not in (v_thread.buyer_id, v_thread.seller_id) then
    raise exception 'not_a_participant';
  end if;
  if public.blocked_with(case when v_thread.buyer_id = v_me then v_thread.seller_id else v_thread.buyer_id end) then
    raise exception 'user_blocked';
  end if;
  select * into v_listing from public.listings where id = v_thread.listing_id;
  if v_listing.status <> 'active' then
    raise exception 'listing_not_active';
  end if;
  if not v_listing.allow_offers then
    raise exception 'offers_not_allowed';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount >= v_listing.price then
    raise exception 'amount_out_of_range';
  end if;

  update public.messages
    set status = 'countered'
    where thread_id = p_thread and kind = 'offer' and status = 'pending';

  insert into public.messages (thread_id, sender_id, kind, body, amount, status)
  values (p_thread, v_me, 'offer', nullif(trim(coalesce(p_body, '')), ''), round(p_amount, 2), 'pending')
  returning * into v_message;
  return v_message;
end;
$$;
revoke all on function public.send_offer(uuid, numeric, text) from public, anon;
grant execute on function public.send_offer(uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 0.6: pranešimų el. paštu apie naują žinutę žurnalas (naudoja tik serverio funkcija)
-- ---------------------------------------------------------------------------

create table if not exists public.notification_log (
  thread_id uuid not null references public.threads (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (thread_id, recipient_id)
);
alter table public.notification_log enable row level security;
revoke all on public.notification_log from anon, authenticated;
