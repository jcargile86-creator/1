# InspectPro backend (Supabase)

The account + claim sync spine: Supabase Auth (accounts, password recovery),
Postgres (claims, profiles, orgs), and row-level security for per-inspector
isolation and per-org manager visibility. Photo binaries land in Supabase
Storage in a later slice; this spine syncs everything except the images.

## What's here

- `migrations/0001_init.sql` — schema, triggers, and RLS policies.
- `config.toml` — Supabase CLI config (email/password auth).

## Provision it (you run this; the build sandbox can't reach Supabase)

1. Create a project at https://supabase.com (pick a US region for insured PII).
2. Install the CLI: `npm i -g supabase` (or `brew install supabase/tap/supabase`).
3. From the repo root:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push        # applies migrations/0001_init.sql
   ```
   (Or paste `migrations/0001_init.sql` into the dashboard SQL editor and run it.)
4. In the dashboard: **Project Settings -> API**. Copy:
   - **Project URL**  (e.g. https://abcd.supabase.co)
   - **anon public key**  (safe to ship — it's protected by RLS)
5. Send me those two values. I'll set them in `app.json -> extra` and ship the
   client sync layer via OTA. (The anon key is designed to be public; RLS is
   what protects the data. The service-role key must NEVER go in the app.)

## Create an organization + attach inspectors

After the first inspectors sign up (which auto-creates their `profiles` row):

```sql
-- one-time: create your org
insert into public.organizations (name) values ('Patriot Claims') returning id;

-- attach an inspector (and optionally promote to manager)
update public.profiles
   set org_id = '<org-id>', role = 'manager'
 where id = (select id from auth.users where email = 'you@example.com');
```

## Security notes

- RLS is on for every table. An inspector can only touch `owner_id = auth.uid()`
  rows; managers/admins can read their org's claims.
- Keep the **service-role** key server-side only (workers, Xact ingestion) —
  never in the mobile bundle.
- Enable email confirmations before production (`config.toml`).
