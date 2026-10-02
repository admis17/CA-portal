# Mehra Associates — CA Task & Client Portal (Phases 1–2)

Foundation + upload/inbox per `PRD.md` + `TECH_STACK.md`: Next.js App Router + TypeScript strict,
Tailwind, Supabase Auth/Postgres/RLS/Storage, username login via `{username}@portal.internal`.

Design: Stitch mockup language — floating glass topbar with pill nav (no sidebar),
frosted cards, tinted icon tiles, dotted status pills — in Sovereign emerald/gold
(forest `#052E27`, emerald `#047857→#0F766E`, gold `#D4A017`).
Firm identity lives in `src/config/brand.ts`. (Note: mockup screenshots show a
sidebar; built as floating topbar per instruction.)

## Phase 1 scope
Project setup, Supabase schema + RLS, login, role redirects,
admin creates employees, client sign-up. Each role lands on its own
(empty) dashboard; wrong roles are blocked by `src/middleware.ts` + `requireProfile`.

Skipped for later phases (not YAGNI yet): react-hook-form, Resend emails,
Recharts, forgot-password, manual dark-mode toggle (OS setting respected),
uploads/inbox/assignment/status/reports (Phases 2–5).

## Setup
1. Create a Supabase project in **Mumbai (ap-south-1)** if available, else Singapore.
2. Run `supabase/migrations/001_foundation.sql` in the SQL editor.
3. `cp .env.example .env.local` and fill in URL / anon key / service-role key.
4. Create the first admin (service role bypasses RLS — run in SQL editor):
   ```sql
   -- a) create the auth user in Dashboard > Authentication > Users with email admin@portal.internal
   -- b) then insert its profile (get the id from auth.users):
   insert into profiles (id, role, username, full_name)
   values ('<auth-user-id>', 'admin', 'admin', 'Firm Admin');
   ```
5. `pnpm install && pnpm dev` → http://localhost:3000

## Test by hand (Phase 1 acceptance)
- [ ] `/` without session → `/login`.
- [ ] Client signs up at `/signup` → lands on `/client/requests` (empty).
- [ ] Client visits `/admin/dashboard` → bounced to `/client/requests`.
- [ ] Admin logs in (`admin` + password) → `/admin/dashboard` (empty stat cards).
- [ ] Admin creates employee at Employees → employee logs in → forced to `/account/password`, then lands on `/employee/today`.
- [ ] Admin deactivates employee → employee login fails with "deactivated".
- [ ] Admin reset password → temp shown once; employee must change on next login.
- [ ] RLS: as client/employee in Supabase, selecting another user's `requests` rows returns nothing.

## Test by hand (Phase 2 acceptance)
- [ ] Client uploads at `/client/upload` (service + files + note) → new `unassigned` request on `/client/requests`.
- [ ] Upload appears in admin `/admin/inbox` with client, service, files, received date.
- [ ] Inbox file opens via `/api/files/...` for admin; employees/clients get 403/redirect on files that aren't theirs.
- [ ] `.exe` / >25 MB files rejected with a clear error.
- [ ] Demo mode (no env): full round-trip works with files kept under the OS temp dir.

## Scripts
`pnpm dev` · `pnpm build` · `pnpm lint` (typecheck: `pnpm tsc --noEmit`)
