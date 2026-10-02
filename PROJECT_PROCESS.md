# Project Process — Mehra Associates CA Portal

## Project Goal
Web portal for a CA firm: clients upload documents, admin assigns to employees, employees update status, admin tracks performance. (PRD: `C:\Users\Adarsh\Downloads\PRD.md`, stack: `TECH_STACK.md`)

## Current Milestone
Phase 2 (PRD §12.2): client upload to private storage, admin inbox, signed-URL downloads. DONE + tested. Stopped per instruction — Phase 3 not started.

## Current Task
Phase 2 built, lint+build pass, full demo round-trip tested (upload → inbox → byte-identical download, validation, 403s). UI restyled to floating topbar per instruction.

## Current Status
Phase 2 done, awaiting user review before Phase 3.

## Completed (Phase 2)
- `createRequest` action (`src/lib/actions/requests.ts`): service/note/files validation (25 MB, PDF/img/xls/doc/csv), real branch writes request + storage objects + document rows via service role, notifies admins + audit log (best-effort); demo branch stores bytes + item.
- `/client/upload`: service picker, multi-file, note. `/client/requests` now lists real own requests (status pill + progress).
- `/admin/inbox`: unassigned requests with client/service/files/received + pending pill (assign UI is Phase 3).
- `/api/files/[...key]`: permission-checked downloads — 60s signed-URL redirect (real, + `file_view` log) or memory/disk bytes (demo). RLS enforced by fetching via user client.
- `next.config.ts`: `serverActions.bodySizeLimit = 30mb`.
- Restyle: `Shell` rewritten to floating glass topbar + pill nav (no sidebar); `.tile`/`.navpill`/`.avatar-chip`/`.open-pill`/`.eyebrow` in `globals.css` (+ dark variants); login split-screen (forest brand panel + form); stat/section tiles everywhere. Avatar initials forest/white both modes; open counts now tinted pills.
- Verified: lint+build clean; demo round-trip (PDF upload → inbox → byte-identical download via `fc /b`); `.exe` rejected; employee download 403; unauthenticated bounced.

## Failed Approaches (Phase 2)
- Demo bytes in server-module `Map`: invisible across routes in dev (separate module graphs) — download 404'd while inbox saw the item. Moved demo store to OS temp dir JSON + files (`src/lib/demoStore.ts`).
- Supabase to-one join typing: inferred as arrays — normalize with `one()` helper at read sites.
Demo logins added (demo-only, auto-disabled when env is set): `admin` / `employee` / `client`, all password `demo1234`. Verified: per-role 200s, cross-role 307 bounces, employees demo table renders.
Demo dataset (`src/lib/demo.ts`): dashboard stats (6/14/32/92%) + activity + workload, 4 employees with open counts, employee tasks (today/week), client requests with progress bars. Verified rendered on all pages. Real-mode employees page also shows live open-task counts.

## Completed
- Scaffold: `C:\Users\Adarsh\ca-portal` (Next 16.3.8, React 19, TS strict, Tailwind v4, pnpm). Deps added: `@supabase/ssr`, `@supabase/supabase-js`, `zod`, `lucide-react`.
- `supabase/migrations/001_foundation.sql`: enums, profiles/services/requests/documents/comments/notifications/activity_log, RLS policies per role, private `client-docs` bucket (no direct-access policies).
- Auth: username→`{username}@portal.internal`, `signIn`/`signUpClient`/`signOut`/`createEmployee`/`setEmployeeActive`/`resetEmployeePassword`/`updateOwnPassword` (`src/lib/actions/auth.ts`, zod-validated, role-derived server-side).
- Route protection: `src/proxy.ts` (Next 16 renamed middleware→proxy) + `requireProfile` in `src/lib/auth.ts`. Homes: admin `/admin/dashboard`, employee `/employee/today`, client `/client/requests`.
- Pages: login, signup, admin dashboard (empty stats) + employees CRUD, employee today (empty), client requests (empty), account/password (forced when `must_change_password`).
- Design: `src/config/brand.ts` (Sovereign Fiscal Prestige: sidebar `#052E27`, emerald `#047857→#0F766E`, gold `#D4A017`, status pills) + Teloz patterns in `globals.css`/`Shell.tsx` (glass cards, blurred topbar, dotted pills, ambient blobs, mobile top-menu). Fonts Plus Jakarta Sans + Inter.
- Verified: `pnpm lint` clean, `pnpm build` clean, dev-server route tests all pass (see Testing).

## In Progress
- Nothing (Phase 1 complete).

## Next Steps
1. User reviews Phases 1–2 in browser (demo logins on `/login`).
2. Optional: connect Supabase (migration already covers Phases 1–2 tables/RLS/bucket) and re-test live.
3. Phase 3: assign action, notifications, employee My Work + Past Tasks.

## Architecture
- Server Actions + `redirect(?error|?ok)` query feedback; zero client JS for forms (no RHF yet).
- Supabase clients: `lib/supabase/{client,server,admin}.ts`; admin (service role) server-only, used for user creation + flag clears; user-scoped client everywhere else so RLS is exercised.
- Demo mode: missing env → pages show banner / bounce to `/login` instead of crashing; build passes without env (`force-dynamic` on session pages).

## Important Decisions
- Teloz = layout patterns only; all colour from stitch Sovereign palette (emerald/gold, not Teloz orange).
- Skipped for later: react-hook-form (plain forms+server zod suffice), Resend/Recharts/forgot-password/manual dark toggle (OS media query instead).
- `src/proxy.ts` not `middleware.ts` (Next 16 deprecation); role homes inlined in proxy (edge, no shared imports).
- Server-action files export async fns only (`toEmail` unexported helper).

## Files / Components
- `src/proxy.ts`, `src/lib/auth.ts`, `src/lib/actions/auth.ts`, `src/lib/supabase/*`, `src/config/brand.ts`
- `src/components/layout/Shell.tsx` (sidebar+topbar+logout in one file)
- `src/app/(auth)/{login,signup}`, `admin/{dashboard,employees}`, `employee/today`, `client/requests`, `account/password`

## Known Issues
- Authenticated flows (wrong-role bounce, RLS) not yet tested against real Supabase — needs env.
- `resetEmployeePassword` temp shown via `?temp=` URL (fine for local v1; move to email in Phase 6).

## Failed Approaches
- `src/middleware.ts` → build warned deprecated; migrated to `src/proxy.ts`.
- Exported `toEmail` const from `"use server"` file → Turbopack error; made it a local function.
- Static prerender of session pages threw without env → `force-dynamic` on all of them.

## Testing
- `pnpm lint` ✓, `pnpm build` ✓ (9 routes: 8 dynamic + 404).
- Dev server: `/`→307 `/login`; `/login`+`/signup` 200 with brand/demo banner; all 5 protected routes →307 `/login` unauthenticated. Login HTML verified (monogram, glass card, signIn action).

## Dependencies
next 16.3.8, react 19.2.8, @supabase/ssr 0.12.7, @supabase/supabase-js 2.117.2, zod 4.6.5, lucide-react 1.50.0, tailwindcss 4.3.3, pnpm 10.33.2.

## Environment / Commands
- `pnpm dev` (http://localhost:3000), `pnpm build`, `pnpm lint`. Env template: `.env.example`.

## User Requirements
- PRD + TECH_STACK fully read; Phase 1 only, then run+test. Colours from stitch zip, design theme from 3 Teloz HTML files.

## Notes
- Design refs stay in Downloads + Temp (`stitch_portal`); not copied into repo.
- Next phases per PRD §12: 2 upload+inbox, 3 assignment+employee view, 4 status+tracking, 5 reports, 6 email+polish.
