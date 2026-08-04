-- =====================================================================
-- HostAI Concierge — Phase 1 schema
-- Run this whole file in the Supabase SQL Editor (one shot, idempotent).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Helpers
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. profiles — one row per host, mirrors auth.users
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  plan        text not null default 'free' check (plan in ('free', 'pro')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create a profile whenever a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. properties — the apartment. One QR code per row.
-- ---------------------------------------------------------------------
create table if not exists public.properties (
  id                uuid primary key default gen_random_uuid(),
  host_id           uuid not null references public.profiles(id) on delete cascade,

  -- identity
  name              text not null,
  address           text,
  timezone          text not null default 'UTC',
  default_language  text not null default 'en',
  is_active         boolean not null default true,

  -- category 1: essentials
  wifi_ssid         text,
  wifi_password     text,
  checkin_time      text,
  checkout_time     text,
  checkin_instructions text,
  checkout_instructions text,
  parking_info      text,
  trash_info        text,

  -- category 2: rules
  house_rules       text,
  quiet_hours       text,
  smoking_policy    text,
  pet_policy        text,

  -- category 4: emergency / escalation
  host_name         text,
  host_phone        text,
  emergency_contact text,
  emergency_notes   text,
  alert_webhook_url text,          -- simulated SMS / Slack / Make.com hook
  alert_email       text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists properties_host_id_idx on public.properties(host_id);

drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. appliances — feeds the Vision AI ("how does this washing machine work?")
-- ---------------------------------------------------------------------
create table if not exists public.appliances (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  name          text not null,               -- "Washing machine"
  brand         text,                        -- "Candy"
  model         text,                        -- "CBW 27D1S"
  location      text,                        -- "Under the kitchen counter"
  instructions  text not null,               -- what the AI explains
  image_url     text,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists appliances_property_id_idx on public.appliances(property_id);

drop trigger if exists appliances_set_updated_at on public.appliances;
create trigger appliances_set_updated_at
  before update on public.appliances
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. local_guides — restaurants, pharmacies, transport
-- ---------------------------------------------------------------------
create table if not exists public.local_guides (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  category      text not null default 'other'
                check (category in ('restaurant','cafe','bar','grocery','pharmacy',
                                    'transport','attraction','beach','emergency','other')),
  title         text not null,
  description   text,
  address       text,
  url           text,
  walking_time  text,                        -- "6 min walk"
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists local_guides_property_id_idx on public.local_guides(property_id);

drop trigger if exists local_guides_set_updated_at on public.local_guides;
create trigger local_guides_set_updated_at
  before update on public.local_guides
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 5. upsells — the revenue engine (Stripe Payment Links)
-- ---------------------------------------------------------------------
create table if not exists public.upsells (
  id                  uuid primary key default gen_random_uuid(),
  property_id         uuid not null references public.properties(id) on delete cascade,
  title               text not null,          -- "Late check-out until 6pm"
  description         text,
  price_cents         int not null default 0 check (price_cents >= 0),
  currency            text not null default 'EUR',
  stripe_payment_link text,                   -- pasted from Stripe dashboard
  trigger_keywords    text[] not null default '{}',  -- ['late checkout','stay longer']
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists upsells_property_id_idx on public.upsells(property_id);

drop trigger if exists upsells_set_updated_at on public.upsells;
create trigger upsells_set_updated_at
  before update on public.upsells
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 6. chat_sessions / chat_messages — guest conversations
-- ---------------------------------------------------------------------
create table if not exists public.chat_sessions (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  guest_label   text,                         -- optional "Room 3" / guest name
  language      text,                         -- detected language code
  started_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create index if not exists chat_sessions_property_id_idx on public.chat_sessions(property_id);

create table if not exists public.chat_messages (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.chat_sessions(id) on delete cascade,
  property_id   uuid not null references public.properties(id) on delete cascade,
  role          text not null check (role in ('user', 'assistant')),
  content       text not null default '',
  image_url     text,                         -- Supabase Storage path for Vision AI
  sentiment     text check (sentiment in ('positive','neutral','negative','critical')),
  tokens_in     int,
  tokens_out    int,
  created_at    timestamptz not null default now()
);

create index if not exists chat_messages_session_id_idx on public.chat_messages(session_id, created_at);
create index if not exists chat_messages_property_id_idx on public.chat_messages(property_id, created_at desc);

-- ---------------------------------------------------------------------
-- 7. alerts — Review Saver + Auto-Escalation
-- ---------------------------------------------------------------------
create table if not exists public.alerts (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  session_id    uuid references public.chat_sessions(id) on delete set null,
  kind          text not null check (kind in ('sentiment', 'escalation')),
  severity      text not null default 'medium' check (severity in ('low','medium','high','critical')),
  trigger_term  text,                         -- 'leak', 'broken AC', ...
  summary       text not null,
  guest_message text,
  delivered     boolean not null default false,
  delivery_error text,
  acknowledged_at timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists alerts_property_id_idx on public.alerts(property_id, created_at desc);
create index if not exists alerts_unacked_idx on public.alerts(property_id) where acknowledged_at is null;

-- =====================================================================
-- 8. Row Level Security
--
-- Model: hosts own their data and only ever touch it through the anon key.
-- Guests are ANONYMOUS — they never talk to Postgres directly. The guest
-- chat goes through our own API routes, which use the SERVICE ROLE key
-- (bypasses RLS). That keeps wifi_password & co. off the public client.
-- =====================================================================

alter table public.profiles      enable row level security;
alter table public.properties    enable row level security;
alter table public.appliances    enable row level security;
alter table public.local_guides  enable row level security;
alter table public.upsells       enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.alerts        enable row level security;

-- profiles: self only
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- properties: full CRUD for the owning host
drop policy if exists "properties_all_own" on public.properties;
create policy "properties_all_own" on public.properties
  for all using (auth.uid() = host_id) with check (auth.uid() = host_id);

-- child tables: ownership is derived through properties
do $$
declare
  t text;
begin
  foreach t in array array['appliances','local_guides','upsells','chat_sessions','chat_messages','alerts']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_all_own', t);
    execute format($f$
      create policy %I on public.%I
        for all
        using (exists (
          select 1 from public.properties p
          where p.id = %I.property_id and p.host_id = auth.uid()
        ))
        with check (exists (
          select 1 from public.properties p
          where p.id = %I.property_id and p.host_id = auth.uid()
        ))
    $f$, t || '_all_own', t, t, t);
  end loop;
end;
$$;

-- =====================================================================
-- 9. Storage bucket for guest photo uploads (Vision AI)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('guest-uploads', 'guest-uploads', true)
on conflict (id) do nothing;

drop policy if exists "guest_uploads_read" on storage.objects;
create policy "guest_uploads_read" on storage.objects
  for select using (bucket_id = 'guest-uploads');

-- Uploads are performed server-side with the service role key, so no
-- public insert policy is granted here on purpose.

-- =====================================================================
-- Phase 5 — Stripe revenue tracking
--
-- Payment Links belong to the HOST's own Stripe account, not ours, so the
-- host points their Stripe webhook at a URL carrying their own opaque token
-- and pastes their signing secret. No Stripe Connect onboarding, no platform
-- account, nothing for the host to approve beyond a webhook endpoint.
-- =====================================================================

alter table public.profiles
  add column if not exists stripe_webhook_secret text,
  add column if not exists stripe_webhook_token uuid not null default gen_random_uuid();

create unique index if not exists profiles_stripe_webhook_token_idx
  on public.profiles(stripe_webhook_token);

create table if not exists public.upsell_purchases (
  id                          uuid primary key default gen_random_uuid(),
  host_id                     uuid not null references public.profiles(id) on delete cascade,
  property_id                 uuid references public.properties(id) on delete set null,
  upsell_id                   uuid references public.upsells(id) on delete set null,
  session_id                  uuid references public.chat_sessions(id) on delete set null,

  -- Stripe sends every event at least once. This makes replays a no-op.
  stripe_event_id             text not null unique,
  stripe_checkout_session_id  text,

  amount_cents                int not null default 0 check (amount_cents >= 0),
  currency                    text not null default 'EUR',
  guest_email                 text,
  created_at                  timestamptz not null default now()
);

create index if not exists upsell_purchases_host_id_idx
  on public.upsell_purchases(host_id, created_at desc);
create index if not exists upsell_purchases_property_id_idx
  on public.upsell_purchases(property_id, created_at desc);

alter table public.upsell_purchases enable row level security;

drop policy if exists "upsell_purchases_select_own" on public.upsell_purchases;
create policy "upsell_purchases_select_own" on public.upsell_purchases
  for select using (auth.uid() = host_id);
