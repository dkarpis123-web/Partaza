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
-- The seller's own photo or logo (a public link into the photo bucket).
alter table public.profiles add column if not exists logo_url text;

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
alter table public.listings add column if not exists motorsport boolean not null default false;

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

-- ---------------------------------------------------------------------------
-- 0.6: skelbimo aprašymas ir įsiminti skelbimai
-- ---------------------------------------------------------------------------

alter table public.listings add column if not exists description text not null default '';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'listings_description_length') then
    alter table public.listings add constraint listings_description_length check (char_length(description) <= 3000);
  end if;
end;
$$;

-- Sellers a person follows, and searches they saved to be told about new matching parts. Private to the person.
create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, seller_id),
  check (follower_id <> seller_id)
);
grant select, insert, delete on public.follows to authenticated;
alter table public.follows enable row level security;
drop policy if exists follows_own on public.follows;
create policy follows_own on public.follows for all to authenticated
  using (follower_id = (select auth.uid())) with check (follower_id = (select auth.uid()));

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  query text not null default '' check (char_length(query) <= 120),
  vehicle_type text,
  country text,
  city text not null default '' check (char_length(city) <= 80),
  created_at timestamptz not null default now(),
  seen_at timestamptz not null default now()
);
create index if not exists saved_searches_user_idx on public.saved_searches (user_id);
grant select, insert, update, delete on public.saved_searches to authenticated;
alter table public.saved_searches enable row level security;
drop policy if exists saved_searches_own on public.saved_searches;
create policy saved_searches_own on public.saved_searches for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
grant select, insert, delete on public.favorites to authenticated;
alter table public.favorites enable row level security;
drop policy if exists favorites_own on public.favorites;
create policy favorites_own on public.favorites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 0.7: užsakymai (susitarimas pirkti). Mokėjimai per platformą dar neįjungti:
-- užsakymas fiksuoja, kas, ką ir už kiek perka; apmokėjimą šalys kol kas derina pačios.
-- ---------------------------------------------------------------------------

alter table public.listings drop constraint if exists listings_status_check;
alter table public.listings add constraint listings_status_check
  check (status in ('active', 'reserved', 'sold', 'hidden'));

-- Skelbimą mato visi, kol jis aktyvus; pardavėjas visada; pirkėjas, kuris dėl jo jau rašė,
-- ir toliau (kad pokalbis ir užsakymas neliktų be skelbimo, kai jis rezervuotas ar parduotas).
create or replace function public.has_thread_on(p_listing uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.threads t where t.listing_id = p_listing and t.buyer_id = (select auth.uid()));
$$;
revoke all on function public.has_thread_on(uuid) from public;
grant execute on function public.has_thread_on(uuid) to anon, authenticated;

drop policy if exists listings_read on public.listings;
create policy listings_read on public.listings for select
  using (status = 'active' or seller_id = (select auth.uid()) or public.has_thread_on(id));

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings (id) on delete set null,
  thread_id uuid references public.threads (id) on delete set null,
  buyer_id uuid references public.profiles (id) on delete set null,
  seller_id uuid references public.profiles (id) on delete set null,
  title text not null,
  photo text,
  price numeric(10, 2) not null check (price > 0),
  shipping numeric(10, 2),
  status text not null default 'agreed' check (status in ('agreed', 'handed', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  handed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);
-- Vienam skelbimui – tik vienas neužbaigtas užsakymas.
create unique index if not exists orders_open_listing_idx on public.orders (listing_id) where status in ('agreed', 'handed');
create index if not exists orders_buyer_idx on public.orders (buyer_id);
create index if not exists orders_seller_idx on public.orders (seller_id);

grant select on public.orders to authenticated;
alter table public.orders enable row level security;
drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders for select to authenticated
  using ((select auth.uid()) in (buyer_id, seller_id));

-- Pirkėjas patvirtina pirkimą. Kaina – paskutinis priimtas pasiūlymas tame pokalbyje, o jei jo nėra – skelbimo kaina.
create or replace function public.create_order(p_listing uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_listing public.listings;
  v_thread uuid;
  v_price numeric;
  v_order public.orders;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_listing from public.listings where id = p_listing for update;
  if not found or v_listing.status <> 'active' then
    raise exception 'listing_not_active';
  end if;
  if v_listing.seller_id = v_me then
    raise exception 'own_listing';
  end if;
  if public.blocked_with(v_listing.seller_id) then
    raise exception 'user_blocked';
  end if;

  select id into v_thread from public.threads where listing_id = p_listing and buyer_id = v_me;
  if v_thread is null then
    insert into public.threads (listing_id, buyer_id, seller_id) values (p_listing, v_me, v_listing.seller_id) returning id into v_thread;
  end if;

  select m.amount into v_price from public.messages m
    where m.thread_id = v_thread and m.kind = 'offer' and m.status = 'accepted'
    order by m.created_at desc limit 1;
  v_price := coalesce(v_price, v_listing.price);

  insert into public.orders (listing_id, thread_id, buyer_id, seller_id, title, photo, price, shipping)
  values (p_listing, v_thread, v_me, v_listing.seller_id, v_listing.title, v_listing.photos[1], v_price, v_listing.shipping)
  returning * into v_order;

  update public.listings set status = 'reserved' where id = p_listing;

  insert into public.messages (thread_id, sender_id, kind, body)
  values (v_thread, v_me, 'text', 'Perku už ' || trim(to_char(v_price, 'FM999999990.00')) || ' €. Susitarkime dėl apmokėjimo ir perdavimo.');

  return v_order;
end;
$$;

-- Užsakymo veiksmai: cancel (abi pusės, kol nesusitarta daugiau), hand (pardavėjas perdavė ar išsiuntė),
-- complete (pirkėjas gavo). Užbaigus skelbimas pažymimas parduotu ir suma įrašoma į pardavėjo apskaitą.
create or replace function public.order_action(p_order uuid, p_action text)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_order public.orders;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_order from public.orders where id = p_order for update;
  if not found or v_me not in (v_order.buyer_id, v_order.seller_id) then
    raise exception 'not_a_participant';
  end if;

  if p_action = 'cancel' and v_order.status = 'agreed' then
    update public.orders set status = 'cancelled', cancelled_at = now() where id = p_order returning * into v_order;
    update public.listings set status = 'active' where id = v_order.listing_id and status = 'reserved';
  elsif p_action = 'hand' and v_order.status = 'agreed' and v_me = v_order.seller_id then
    update public.orders set status = 'handed', handed_at = now() where id = p_order returning * into v_order;
  elsif p_action = 'complete' and v_order.status in ('agreed', 'handed') and v_me = v_order.buyer_id then
    update public.orders set status = 'completed', completed_at = now() where id = p_order returning * into v_order;
    update public.listings set status = 'sold' where id = v_order.listing_id;
    if v_order.listing_id is not null and v_order.seller_id is not null then
      insert into public.listing_finance (listing_id, seller_id, sold_price, sold_at)
      values (v_order.listing_id, v_order.seller_id, v_order.price, now())
      on conflict (listing_id) do update set sold_price = excluded.sold_price, sold_at = excluded.sold_at;
    end if;
  else
    raise exception 'not_allowed';
  end if;
  return v_order;
end;
$$;

revoke all on function public.create_order(uuid) from public, anon;
revoke all on function public.order_action(uuid, text) from public, anon;
grant execute on function public.create_order(uuid) to authenticated;
grant execute on function public.order_action(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 0.8: mokėjimai per „Stripe“ – pardavėjų išmokų paskyros ir užsakymai
-- ---------------------------------------------------------------------------
-- Pinigus priima ir laiko „Stripe“; pardavėjui jie pervedami, kai pirkėjas patvirtina gavimą
-- arba baigiasi patikros laikas. Šias lenteles pildo tik serverio funkcija „payments“
-- (supabase/functions/payments); programėlė jas gali tik skaityti.

-- Pardavėjo „Stripe“ paskyra. Visi mato tik tai, ar pardavėjas gali priimti mokėjimus.
create table if not exists public.seller_accounts (
  seller_id uuid primary key references public.profiles (id) on delete cascade,
  stripe_account_id text not null unique,
  payouts_ready boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.seller_accounts enable row level security;
revoke all on public.seller_accounts from anon, authenticated;
grant select (seller_id, payouts_ready) on public.seller_accounts to anon, authenticated;
drop policy if exists seller_accounts_read on public.seller_accounts;
create policy seller_accounts_read on public.seller_accounts for select using (true);

-- Per platformą apmokėtas užsakymas (lentelė „orders“ skirta susitarimams be mokėjimo). Sumos centais. Būsenos:
--   pending   – pirkėjas nukreiptas apmokėti (dalis rezervuota, kol galioja apmokėjimo langas)
--   paid      – apmokėta, pinigai laikomi; pardavėjas turi išsiųsti arba perduoti
--   shipped   – pardavėjas pažymėjo „Išsiunčiau“ / „Perdaviau“
--   received  – pirkėjas pažymėjo „Gavau“; prasideda patikros laikas
--   completed – pinigai pervesti pardavėjui
--   disputed  – pirkėjas pranešė apie problemą; pinigai sulaikyti, kol išspręs administratorius
--   refunded  – pinigai grąžinti pirkėjui
--   cancelled – apmokėjimas neįvyko arba nutrauktas
create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings (id) on delete set null,
  buyer_id uuid references public.profiles (id) on delete set null,
  seller_id uuid references public.profiles (id) on delete set null,
  title text not null,
  item_amount integer not null check (item_amount > 0),
  shipping_amount integer not null default 0 check (shipping_amount >= 0),
  fee_amount integer not null default 0 check (fee_amount >= 0),
  total_amount integer not null check (total_amount > 0),
  currency text not null default 'eur',
  delivery text not null check (delivery in ('shipping', 'pickup')),
  status text not null default 'pending' check (
    status in ('pending', 'paid', 'shipped', 'received', 'completed', 'disputed', 'refunded', 'cancelled')
  ),
  -- Pristatymo adresas ir telefonas iš apmokėjimo lango; mato tik pirkėjas ir pardavėjas.
  ship_to jsonb,
  tracking text check (tracking is null or char_length(tracking) <= 200),
  dispute_reason text check (dispute_reason is null or char_length(dispute_reason) <= 2000),
  stripe_session_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_transfer_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  shipped_at timestamptz,
  received_at timestamptz,
  -- Kada pinigai savaime atitenka pardavėjui, jei pirkėjas nieko nedaro.
  release_at timestamptz,
  completed_at timestamptz
);

create index if not exists payment_orders_buyer_idx on public.payment_orders (buyer_id, created_at desc);
create index if not exists payment_orders_seller_idx on public.payment_orders (seller_id, created_at desc);
create index if not exists payment_orders_release_idx on public.payment_orders (release_at) where status in ('shipped', 'received');
create index if not exists payment_orders_session_idx on public.payment_orders (stripe_session_id);
create index if not exists payment_orders_intent_idx on public.payment_orders (stripe_payment_intent_id);
-- Viena dalis – vienas galiojantis užsakymas: du pirkėjai negali apmokėti tos pačios dalies.
create unique index if not exists payment_orders_one_per_listing on public.payment_orders (listing_id)
  where status not in ('cancelled', 'refunded');

alter table public.payment_orders enable row level security;
revoke all on public.payment_orders from anon, authenticated;
grant select on public.payment_orders to authenticated;
drop policy if exists payment_orders_read on public.payment_orders;
create policy payment_orders_read on public.payment_orders for select to authenticated
  using ((select auth.uid()) in (buyer_id, seller_id));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'payment_orders'
  ) then
    alter publication supabase_realtime add table public.payment_orders;
  end if;
end;
$$;

-- Paskyros negalima ištrinti, kol yra nebaigtų užsakymų (laikomi pinigai turi kam nors atitekti).
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
  if exists (
    select 1 from public.payment_orders o
    where (select auth.uid()) in (o.buyer_id, o.seller_id)
      and o.status in ('paid', 'shipped', 'received', 'disputed')
  ) then
    raise exception 'open_orders';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Automatinis pinigų atleidimas: kas 15 minučių serverio funkcija patikrina, kurių užsakymų
-- patikros laikas baigėsi. Kvietimas be duomenų – funkcija pati nusprendžia, ką atleisti.
-- Projekto adresas imamas iš nustatymo; jei jo nėra (vietiniai bandymai), darbas nekuriamas.
do $$
declare
  v_url text := current_setting('app.settings.functions_url', true);
begin
  if v_url is null or v_url = '' then
    v_url := 'https://vpywtkqgbglqxufhzuct.supabase.co/functions/v1';
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    execute 'create extension if not exists pg_cron';
    execute 'create extension if not exists pg_net';
    perform cron.schedule(
      'partaza-release-orders',
      '*/15 * * * *',
      format($job$select net.http_post(url := %L, body := '{"action":"release_due"}'::jsonb, headers := '{"Content-Type":"application/json"}'::jsonb)$job$, v_url || '/payments')
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- VAT: a seller may mark a price as "including VAT" only after their VAT number was checked in the
-- EU register (VIES) by the "vat" edge function and recorded here.
-- ---------------------------------------------------------------------------
alter table public.listings add column if not exists shipping_quote boolean not null default false;
-- Delivery price to other countries; null = the buyer abroad asks the seller first.
alter table public.listings add column if not exists shipping_abroad numeric(10, 2) check (shipping_abroad is null or shipping_abroad >= 0);
alter table public.payment_orders add column if not exists ship_country text;
-- Defect marks on photos: { photo address: [[x, y], ...] } with x, y as shares of the picture's size.
alter table public.listings add column if not exists photo_marks jsonb not null default '{}'::jsonb;

create table if not exists public.seller_vat (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  vat_code text not null,
  registered_name text not null default '',
  verified_at timestamptz not null default now()
);
alter table public.seller_vat enable row level security;
revoke all on public.seller_vat from anon, authenticated;
grant select on public.seller_vat to authenticated;
drop policy if exists seller_vat_own on public.seller_vat;
create policy seller_vat_own on public.seller_vat for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.listing_vat_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.vat and (tg_op = 'INSERT' or not old.vat) then
    if not exists (select 1 from public.seller_vat v where v.user_id = new.seller_id) then
      raise exception 'vat_code_required';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists listing_vat_guard on public.listings;
create trigger listing_vat_guard before insert or update of vat on public.listings
  for each row execute function public.listing_vat_guard();

-- ---------------------------------------------------------------------------
-- AI helpers (the "ai" edge function): how many calls each user made today.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null default current_date,
  calls integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- Counts one call; returns false when the user has reached today's limit. Only the edge function may call it.
create or replace function public.ai_use(p_user uuid, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_calls integer;
begin
  insert into public.ai_usage (user_id, day, calls) values (p_user, current_date, 1)
  on conflict (user_id, day) do update set calls = public.ai_usage.calls + 1
  returning calls into v_calls;
  return v_calls <= p_limit;
end;
$$;
revoke all on function public.ai_use(uuid, integer) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.ai_use(uuid, integer) to service_role;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reviews: after a completed order the buyer rates the seller and the seller rates the buyer.
-- Public to read; written only through leave_review(), which checks the order.
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_kind text not null check (order_kind in ('order', 'payment')),
  order_id uuid not null,
  author_id uuid references public.profiles (id) on delete set null,
  subject_id uuid not null references public.profiles (id) on delete cascade,
  subject_role text not null check (subject_role in ('buyer', 'seller')),
  stars smallint not null check (stars between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);
create unique index if not exists reviews_once_idx on public.reviews (order_kind, order_id, author_id);
create index if not exists reviews_subject_idx on public.reviews (subject_id);
grant select on public.reviews to anon, authenticated;
alter table public.reviews enable row level security;
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select using (true);

create or replace function public.leave_review(p_kind text, p_order uuid, p_stars integer, p_comment text)
returns public.reviews
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_buyer uuid;
  v_seller uuid;
  v_status text;
  v_review public.reviews;
begin
  if v_me is null then
    raise exception 'not_authenticated';
  end if;
  if p_stars is null or p_stars < 1 or p_stars > 5 then
    raise exception 'bad_stars';
  end if;
  if p_kind = 'order' then
    select buyer_id, seller_id, status into v_buyer, v_seller, v_status from public.orders where id = p_order;
  elsif p_kind = 'payment' then
    select buyer_id, seller_id, status into v_buyer, v_seller, v_status from public.payment_orders where id = p_order;
  else
    raise exception 'not_allowed';
  end if;
  if v_status is distinct from 'completed' or v_buyer is null or v_seller is null or v_me not in (v_buyer, v_seller) then
    raise exception 'not_allowed';
  end if;
  insert into public.reviews (order_kind, order_id, author_id, subject_id, subject_role, stars, comment)
  values (p_kind, p_order, v_me, case when v_me = v_buyer then v_seller else v_buyer end,
          case when v_me = v_buyer then 'seller' else 'buyer' end, p_stars, left(coalesce(trim(p_comment), ''), 1000))
  returning * into v_review;
  return v_review;
exception when unique_violation then
  raise exception 'already_reviewed';
end;
$$;
revoke all on function public.leave_review(text, uuid, integer, text) from public, anon;
grant execute on function public.leave_review(text, uuid, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Listing check: whatever a seller writes waits ('pending') until the "moderate" edge function
-- has looked at it. The seller cannot publish or approve a listing themselves; server code can.
-- ---------------------------------------------------------------------------
alter table public.listings drop constraint if exists listings_status_check;
alter table public.listings add constraint listings_status_check
  check (status in ('active', 'reserved', 'sold', 'hidden', 'pending', 'rejected'));
alter table public.listings add column if not exists approved boolean not null default true;
alter table public.listings add column if not exists moderation_note text;

create or replace function public.listing_moderation_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Server code (edge functions with the service key, security-definer functions) is trusted.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if (select count(*) from public.listings l where l.seller_id = new.seller_id and l.created_at > now() - interval '1 hour') >= 30 then
      raise exception 'too_many_listings';
    end if;
    new.approved := false;
    new.status := 'pending';
    new.moderation_note := null;
    return new;
  end if;
  -- The seller cannot approve their own listing or rewrite the checker's note.
  new.approved := old.approved;
  new.moderation_note := old.moderation_note;
  if new.title is distinct from old.title or new.description is distinct from old.description
     or new.photos is distinct from old.photos or new.oem is distinct from old.oem or new.fits is distinct from old.fits then
    new.approved := false;
    new.moderation_note := null;
  end if;
  if new.status = 'rejected' and old.status <> 'rejected' then
    new.status := old.status;
  end if;
  if not new.approved and new.status in ('active', 'rejected') then
    new.status := 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists listing_moderation_guard on public.listings;
create trigger listing_moderation_guard before insert or update on public.listings
  for each row execute function public.listing_moderation_guard();

do $$
declare
  v_url text := current_setting('app.settings.functions_url', true);
begin
  if v_url is null or v_url = '' then
    v_url := 'https://vpywtkqgbglqxufhzuct.supabase.co/functions/v1';
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    perform cron.schedule(
      'partaza-moderate-listings',
      '*/5 * * * *',
      format($job$select net.http_post(url := %L, body := '{"action":"sweep"}'::jsonb, headers := '{"Content-Type":"application/json"}'::jsonb)$job$, v_url || '/moderate')
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Holiday mode: while a seller is away, buyers do not see their listings.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists away boolean not null default false;

create or replace function public.seller_away(p_seller uuid) returns boolean
language sql stable set search_path = '' as $$
  select coalesce((select p.away from public.profiles p where p.id = p_seller), false);
$$;
grant execute on function public.seller_away(uuid) to anon, authenticated;

drop policy if exists listings_read on public.listings;
create policy listings_read on public.listings for select
  using ((status = 'active' and not public.seller_away(seller_id)) or seller_id = (select auth.uid()) or public.has_thread_on(id));

-- ---------------------------------------------------------------------------
-- Disputes: what kind of problem the buyer reported, and both sides' explanations.
-- ---------------------------------------------------------------------------
alter table public.payment_orders add column if not exists dispute_kind text
  check (dispute_kind is null or dispute_kind in ('not_received', 'not_as_described', 'damaged', 'no_fit', 'other'));

create table if not exists public.dispute_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.payment_orders (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists dispute_messages_order_idx on public.dispute_messages (order_id, created_at);

alter table public.dispute_messages enable row level security;
revoke all on public.dispute_messages from anon, authenticated;
grant select, insert on public.dispute_messages to authenticated;

drop policy if exists dispute_messages_read on public.dispute_messages;
create policy dispute_messages_read on public.dispute_messages for select to authenticated
  using (exists (select 1 from public.payment_orders o where o.id = order_id and ((select auth.uid()) in (o.buyer_id, o.seller_id))));

drop policy if exists dispute_messages_write on public.dispute_messages;
create policy dispute_messages_write on public.dispute_messages for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.payment_orders o where o.id = order_id and o.status = 'disputed' and ((select auth.uid()) in (o.buyer_id, o.seller_id)))
  );

-- At most 20 explanations per person per order (a trigger, because a policy cannot count its own table).
create or replace function public.dispute_message_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.dispute_messages m where m.order_id = new.order_id and m.author_id = new.author_id) >= 20 then
    raise exception 'too_many_messages';
  end if;
  return new;
end;
$$;
drop trigger if exists dispute_message_limit on public.dispute_messages;
create trigger dispute_message_limit before insert on public.dispute_messages
  for each row execute function public.dispute_message_limit();

-- ---------------------------------------------------------------------------
-- AI feedback: what the AI proposed for a listing and what the seller finally published.
-- Written by the app, read only by the owner in the database - used to find wrong guesses
-- and improve the AI's instructions.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  oem text,
  source text,
  appearance text,
  ai_title text,
  ai_fits text,
  final_title text,
  final_fits text,
  picked text,
  created_at timestamptz not null default now()
);
create index if not exists ai_feedback_created_idx on public.ai_feedback (created_at desc);
alter table public.ai_feedback enable row level security;
revoke all on public.ai_feedback from anon, authenticated;
grant insert on public.ai_feedback to authenticated;
drop policy if exists ai_feedback_write on public.ai_feedback;
create policy ai_feedback_write on public.ai_feedback for insert to authenticated with check (user_id = (select auth.uid()));

-- 25–26. Trigger functions are run by the database only; nobody needs to call them through the API.
-- has_thread_on stays callable by visitors: the listings read policy uses it for everyone.
revoke execute on function public.dispute_message_limit() from public, anon, authenticated;
revoke execute on function public.listing_vat_guard() from public, anon, authenticated;
grant execute on function public.has_thread_on(uuid) to anon, authenticated;

-- 27. Other codes on the part (supplier, casting, catalogue codes), comma-separated: buyers search by them too.
alter table public.listings add column if not exists alt_codes text not null default '' check (char_length(alt_codes) <= 300);

-- ---------------------------------------------------------------------------
-- 28. Paid promotion: a seller pays 5 % of the part's price and the listing is shown first for 7 days.
-- ---------------------------------------------------------------------------
alter table public.listings add column if not exists bumped_until timestamptz;

create table if not exists public.listing_bumps (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  session_id text not null unique,
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'open' check (status in ('open', 'paid')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists listing_bumps_listing on public.listing_bumps (listing_id, status);
alter table public.listing_bumps enable row level security;
drop policy if exists listing_bumps_own on public.listing_bumps;
create policy listing_bumps_own on public.listing_bumps for select to authenticated using (seller_id = (select auth.uid()));

-- Only the server (after a confirmed payment) may set how long a listing is promoted.
create or replace function public.listing_bump_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.bumped_until := null;
    else
      new.bumped_until := old.bumped_until;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.listing_bump_guard() from public, anon, authenticated;
drop trigger if exists listing_bump_guard on public.listings;
create trigger listing_bump_guard before insert or update on public.listings
  for each row execute function public.listing_bump_guard();

-- ---------------------------------------------------------------------------
-- 29. Several parts from one seller in one order with one shipping.
-- Every order lists its parts here (a single part is a list of one). A part can be in only one
-- unfinished order at a time; when an order is cancelled or refunded, its parts are free again.
-- ---------------------------------------------------------------------------
create table if not exists public.payment_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.payment_orders (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  title text not null,
  item_amount integer not null check (item_amount > 0),
  released boolean not null default false,
  unique (order_id, listing_id)
);
create index if not exists payment_order_items_order on public.payment_order_items (order_id);
create unique index if not exists payment_order_items_one_open on public.payment_order_items (listing_id) where not released;
alter table public.payment_order_items enable row level security;
revoke all on public.payment_order_items from anon, authenticated;
grant select on public.payment_order_items to authenticated;
drop policy if exists payment_order_items_read on public.payment_order_items;
create policy payment_order_items_read on public.payment_order_items for select to authenticated
  using (exists (select 1 from public.payment_orders o where o.id = order_id and (select auth.uid()) in (o.buyer_id, o.seller_id)));

create or replace function public.payment_order_items_release() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.payment_order_items set released = new.status in ('cancelled', 'refunded') where order_id = new.id;
  return null;
end;
$$;
revoke execute on function public.payment_order_items_release() from public, anon, authenticated;
drop trigger if exists payment_order_items_release on public.payment_orders;
create trigger payment_order_items_release after update of status on public.payment_orders
  for each row when (old.status is distinct from new.status) execute function public.payment_order_items_release();
