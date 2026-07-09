-- InspectPro backend — account + claim sync spine.
-- Multi-tenant from day one (organizations), row-level security everywhere.
-- Client is offline-first: it generates its own UUIDs and upserts by id, so
-- ids are client-supplied. Last-writer-wins on device_updated_at.

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles — one per auth user (Supabase Auth owns credentials/recovery).
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  org_id       uuid references public.organizations (id) on delete set null,
  display_name text not null default '',
  contact      text,
  role         text not null default 'inspector'
                 check (role in ('inspector', 'manager', 'admin')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Claims — the synced inspection. Flat columns for the fields a server/desk
-- adjuster queries on; the flexible, app-shaped remainder rides in `state`.
-- ---------------------------------------------------------------------------
create table if not exists public.claims (
  id                uuid primary key,                       -- client-supplied
  owner_id          uuid not null default auth.uid()
                      references auth.users (id) on delete cascade,
  org_id            uuid references public.organizations (id) on delete set null,
  flow_id           text not null default '',
  status            text not null default 'pending'
                      check (status in ('pending', 'in_progress', 'completed', 'declined')),
  source            text not null default 'manual'
                      check (source in ('xact', 'manual')),

  -- Claim identity / desk-queryable fields
  claim_number      text default '',
  insured           text default '',
  loss_address      text default '',
  carrier           text default '',
  adjuster          text default '',
  inspector         text default '',
  inspector_contact text default '',
  inspection_type   text default '',
  date_of_loss      text default '',
  structure_type    text default '',
  stories           text default '',
  other_structures  text default '',

  -- Lifecycle timestamps
  assigned_at       timestamptz,
  scheduled_at      timestamptz,
  accepted_at       timestamptz,
  submitted_at      timestamptz,
  declined_at       timestamptz,
  decline_reason    text,

  -- App-shaped remainder: answers, notes, instances, skipped, sectionSkipped,
  -- sketches, documents meta, photo meta, seen, createdAt.
  state             jsonb not null default '{}'::jsonb,

  -- Offline sync: the device's own updatedAt drives last-writer-wins.
  device_updated_at timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists claims_owner_idx on public.claims (owner_id);
create index if not exists claims_org_idx on public.claims (org_id);
create index if not exists claims_status_idx on public.claims (status);
create index if not exists claims_scheduled_idx on public.claims (scheduled_at);

-- ---------------------------------------------------------------------------
-- Claim photos — metadata now; the binary lands in Storage in the blob slice.
-- ---------------------------------------------------------------------------
create table if not exists public.claim_photos (
  id            uuid primary key,                           -- client-supplied
  claim_id      uuid not null references public.claims (id) on delete cascade,
  owner_id      uuid not null default auth.uid()
                  references auth.users (id) on delete cascade,
  section_id    text,
  prompt_id     text,
  instance      text,
  caption       text,
  taken_at      timestamptz,
  storage_path  text,                                       -- set in blob slice
  created_at    timestamptz not null default now()
);

create index if not exists claim_photos_claim_idx on public.claim_photos (claim_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists claims_set_updated_at on public.claims;
create trigger claims_set_updated_at before update on public.claims
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- New auth user -> profile row (display name/contact come from sign-up meta).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, contact)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    new.raw_user_meta_data ->> 'contact'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles      enable row level security;
alter table public.claims        enable row level security;
alter table public.claim_photos  enable row level security;

-- Profiles: a user reads/updates their own; can read others in their org.
drop policy if exists profiles_self_rw on public.profiles;
create policy profiles_self_rw on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_org_read on public.profiles;
create policy profiles_org_read on public.profiles
  for select using (
    org_id is not null
    and org_id = (select p.org_id from public.profiles p where p.id = auth.uid())
  );

-- Organizations: members can read their own org.
drop policy if exists orgs_member_read on public.organizations;
create policy orgs_member_read on public.organizations
  for select using (
    id = (select p.org_id from public.profiles p where p.id = auth.uid())
  );

-- Claims: an inspector owns their claims outright; managers/admins may read
-- everything in their org.
drop policy if exists claims_owner_all on public.claims;
create policy claims_owner_all on public.claims
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists claims_org_manager_read on public.claims;
create policy claims_org_manager_read on public.claims
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('manager', 'admin')
        and p.org_id is not null
        and p.org_id = public.claims.org_id
    )
  );

-- Claim photos: gated through claim ownership.
drop policy if exists claim_photos_owner_all on public.claim_photos;
create policy claim_photos_owner_all on public.claim_photos
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
