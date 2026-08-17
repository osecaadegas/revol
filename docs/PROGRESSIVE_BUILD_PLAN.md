# Progressive Build Plan

## Current Product Boundary

The repository started with only source PDFs and no existing app. This implementation creates the first app in the repository root.

The corrected first product concept is a public labor-market board: vacancies are visible without login, trabalhador accounts register to apply, and companies register to publish vacancies. The homepage must feel like a practical LinkedIn-style job feed, while client/developer project information remains private. The operational work-order/evidence module remains part of the company workspace and is still backed by the contract annex.

The engineering manuals and manifesto inform terminology and auditability principles, but they do not expand Phase 1 into Tiers, AI, blockchain, decentralized infrastructure, scoring, automated dispute resolution, or commercial SaaS.

## Architecture Chosen For Phase 1

- Static frontend in `public/`.
- No-dependency Node API in `server/`.
- Selectable persistence: local JSON/private files for development, or Supabase Postgres/private Storage for deployment.
- Bearer-token authentication with server-side session validation.
- Server-enforced role access for internal worker, company, manager, employee, contractor, client, and developer profiles. Public UI labels the worker role as `Trabalhador`.
- PWA metadata and shell caching without advanced offline synchronization.

This keeps the MVP fully runnable without external services while also supporting a real Supabase backend for deployment. The API boundary remains suitable for future Vercel functions or a native mobile client.

## Milestones

### M1 - Foundations

Status: complete.

- Create app root files and scripts.
- Add documentation workflow.
- Implement setup, login, sessions, roles, and local persistence.
- Add private upload storage.

### M2 - Core Operations

Status: complete.

- Manager creates users directly or issues invite links.
- Manager creates work orders with optional initial photos.
- Manager creates tasks with assignee and deadline.
- Employee/contractor sees only assigned tasks.
- Responsible user starts, blocks with reason, adds photographic proof, and submits for validation.
- Manager approves or rejects; rejection requires reason.

### M3 - Evidence And Audit

Status: complete.

- Evidence includes photo, note, timestamp, actor, and optional point-in-time location status.
- Photos are served only through authenticated API access.
- Important actions write audit entries.
- Basic export returns company-owned operational data.

### M4 - UI/UX Polish

Status: complete.

- Mobile-first responsive shell.
- Dashboard, task board, work order creation, team management, and history views.
- Search and status/user filtering.
- Task detail panel with action controls and evidence gallery.
- PWA manifest and service worker for installable shell behavior.

### M5 - Verification

Status: complete.

- Syntax checks through `npm run check`.
- End-to-end API smoke test through `npm run smoke`.
- Manual browser review is still recommended before client handoff.

### M6 - Real Database Backend

Status: complete.

- Added Supabase migration for companies, users, sessions, invites, work orders, tasks, evidence, audit logs, and app metadata.
- Added private Supabase Storage bucket for evidence files.
- Enabled RLS on application tables and service-role-only policies.
- Added server storage driver selection through `APP_STORAGE_DRIVER`.
- Preserved local driver for development and smoke tests.

### M7 - Marketplace Correction

Status: complete.

- Reworked the public entrypoint into a vacancy board.
- Added trabalhador registration and authenticated applications.
- Added company registration, vacancy creation, close/reopen controls, and application review.
- Added marketplace persistence to the local and Supabase data model.
- Updated smoke tests to cover the public job board and application workflow.

### M8 - Public Job Discovery

Status: complete.

- Kept the homepage publicly accessible instead of login-first.
- Added LinkedIn-style vacancy filters for keyword/company/contract, cargo/function, location, and radius around known Portuguese cities.
- Added a separate vacancy `position` field and Supabase follow-up migration so companies can publish a clear role/function and trabalhadores can filter by it.
- Shared the same filtering controls between the public board and logged-in marketplace.

### M9 - Supabase Clean Reset

Status: complete.

- Added an admin-only reset SQL script for dirty Supabase projects that still contain the old unprefixed prototype tables.
- Kept the destructive reset outside the normal migration path.
- Documented reset steps and current expected `meo_*` tables.
- Updated the initial Supabase metadata seed to include marketplace ID counters.

### M10 - Vercel Entrypoint

Status: complete.

- Declared the root `server.js` adapter as the package entrypoint for Vercel's Node preset.
- Exported the shared request handler from `server/index.js`.
- Documented the Vercel deployment settings and Supabase environment requirement.

### M11 - Public Boot Resilience

Status: complete.

- Kept the public landing page renderable when Supabase setup is incomplete.
- Added a visible setup warning for the public jobs board instead of failing the whole boot flow.

### M12 - MANIFESTO Portal UX

Status: complete.

- Repositioned the public surface as MANIFESTO, a professional engineering project portal.
- Added public navigation for Manifesto, Projeto, Modulos, Roadmap, Documentacao, Area do Cliente and Changelog.
- Added data-driven public sections for project status, roadmap, MVP scope, future evolution, modules, technical base, requirement traceability, acceptance criteria, deliverables, documentation, change requests and feedback.
- Added `/cliente` and `/changelog` public routes.
- Updated metadata, PWA manifest, icon and design system for the MANIFESTO brand.
- Preserved the marketplace and operational workspace as existing MVP functionality.

### M13 - Private Project Visibility

Status: complete.

- Restricted unauthenticated visitors to the public `Area do Cliente` access gate and public vacancy marketplace.
- Moved project status, roadmap, modules, scope, requirements, acceptance criteria, deliverables, documentation, feedback and changelog into an authenticated `Projeto` workspace tab.
- Initially limited the private `Projeto` tab to existing `company` and `manager` roles; replaced by first-class `client` and `developer` access in M15.
- Removed public navigation links to Manifesto, Projeto, Modulos, Roadmap, Documentacao and Changelog.
- Moved detailed project copy out of `public/app.js` and behind authenticated `/api/project/private` server delivery.

### M14 - MVP Development Cockpit

Status: complete.

- Added a private `MVP` workspace tab, later restricted to `client` and `developer` users in M15.
- Connected the active `Desenvolvimento do MVP` phase to live company data for marketplace, accounts, work orders, tasks, evidence and audit history through authenticated `/api/mvp/private`.
- Added readiness cards, live metrics, validation-pending work and recent audit activity.
- Added direct action buttons into the existing marketplace, team, orders, tasks and history workflows.
- Added `docs/MVP_DEVELOPMENT.md` as the progressive guide for this active phase.

### M15 - Client/Developer Project Roles

Status: complete.

- Added first-class `client` and `developer` roles to server validation, UI labels, user creation, invites, Supabase migration and reset SQL.
- Restricted private `Projeto` and `MVP` endpoints to `client` and `developer` roles.
- Kept `company` and `manager` focused on marketplace and operational administration.
- Prevented `client` and `developer` users from appearing as task assignees or operational workspace users.
- Updated setup and API documentation for the new project-access flow.

### M16 - Public Job Network Homepage

Status: complete.

- Made `/` the public vacancy marketplace instead of the client/project access page.
- Added a LinkedIn-style job feed layout with first-screen search, quick filters, public result counts, job cards and account actions.
- Added a network-style landing surface with compact top search, candidate profile entry, central job search and company hiring entry.
- Modernized the visual system with cleaner 2026-style surfaces, stronger typography hierarchy, polished feed cards, refined auth controls and current interaction states.
- Expanded desktop search/filter layouts and added visible live motion through animated surface grids, moving network lanes, header signal movement and card entrance/hover states while preserving reduced-motion behavior.
- Kept `/cliente` as the reserved entry for client/developer project information.
- Removed project-portal copy from the public homepage and kept private project/MVP content behind authenticated endpoints.

### M17 - Google Login

Status: complete.

- Added Google OAuth authorization-code login through `/api/auth/google/start` and `/api/auth/google/callback`.
- Existing active users can sign in with Google when the verified Google email matches their app account.
- New Google users can self-create only internal `worker` accounts from the trabalhador registration path.
- Company, client, developer, manager, employee and contractor access remains controlled by the existing registration, user creation and invite flows.
- Stored Google identity metadata in the existing user profile JSON so no extra Supabase table is required.

### M18 - Evidence Validation Retention

Status: complete.

- Final task completion now requires at least three non-expired task evidence photos with accepted authenticity metadata and granted GPS.
- Evidence uploads record browser file capture time, server upload time, GPS coordinates/timestamp, SHA-256 file hash, authenticity checks and seven-day expiry.
- Submitted tasks receive a 12-hour employer validation deadline and auto-approve after the deadline on the next authenticated maintenance pass.
- Authorized parties can download retained evidence through an audited watermarked SVG copy containing job, GPS, time and hash metadata.
- Added a Supabase migration plus reset-schema updates for evidence metadata, retention expiry and task validation deadlines.

### M19 - Scheduled Maintenance And Validation Reminders

Status: complete.

- Added protected `/api/cron/operational-maintenance` for scheduled evidence retention cleanup, validation auto-approval, and validation reminder audit entries.
- Added Vercel Cron configuration for daily production maintenance.
- Added manager dashboard validation reminder cards for pending tasks with due status, assignee and deadline.
- Added smoke coverage for cron authorization, reminder creation and manager validation alerts.

### M20 - Public Landing Simplification

Status: complete.

- Simplified the public landing page into a cleaner search-first structure inspired by the current `trataimobiliaria.pt` homepage flow.
- Removed the busy animated network background and three-column social-card composition from the public entry.
- Preserved the public vacancy marketplace, filters, trabalhador/company account creation and private `/cliente` entry.
- Bumped the service-worker shell cache so deployed browsers fetch the revised public shell.

### M21 - Marketplace Filter Dropdowns

Status: complete.

- Added large dropdown suggestion lists for cargo/function and location filters using common Portuguese operational roles, known locations and live vacancy values.
- Kept free-text search, existing query filtering and known-city radius filtering unchanged.
- Applied the same suggestions to the first-screen public search and the detailed marketplace filter bar.

### M22 - Trabalhador CV Profiles

Status: complete.

- Added a trabalhador-owned CV profile in the authenticated marketplace with profile photo, birth date, skills, previous experience, availability, bio and references.
- Required trabalhadores to publish the CV profile before submitting vacancy applications.
- Exposed published trabalhador CV profiles to company/manager accounts and attached CV details to received applications.
- Stored trabalhador CV data in `meo_users.profile.workerCv` and protected profile photos through authenticated private local/Supabase storage.

### M23 - Public Login Modal

Status: complete.

- Simplified the public topbar brand text and moved public login/register forms into a modal opened from the topbar and page CTAs.
- Removed the large inline homepage auth panel while preserving trabalhador registration, company registration, login and Google OAuth behavior.
- Kept `/cliente` as the reserved client/developer page and left public job discovery visible without authentication.

### M24 - Topbar Account Clarity

Status: complete.

- Renamed the public topbar account trigger to `Login / Registar` so the login area is visible instead of reading like a secondary text link.
- Restyled the account trigger as a bordered action and kept `Publicar vaga` as the company publishing shortcut.
- Bumped the service-worker shell cache so browsers fetch the clearer topbar.

### M25 - Trabalhador Label Cleanup

Status: complete.

- Replaced public-facing `Worker` copy with `Trabalhador` across account creation, Google registration, marketplace CV panels, company candidate lists, audit labels and server error messages.
- Kept `worker` as the internal role/API/storage identifier to avoid a database migration or breaking existing sessions, rows and Supabase indexes.
- Bumped the public shell cache and asset query string so browsers fetch the updated copy.

### M26 - SEO Core

Status: complete.

- Added dynamic public SEO metadata for `/`, `/cliente` and noindex restricted shell routes.
- Added `/robots.txt` and `/sitemap.xml`, with sitemap entries generated from the current open public vacancies.
- Added server-rendered `/vagas/:id` pages for open vacancies with canonical tags, visible vacancy content, Open Graph/Twitter metadata and JobPosting JSON-LD.
- Added `PUBLIC_SITE_URL` as the production canonical-origin override while keeping request-origin fallback for local and preview environments.
- Added smoke coverage for robots, sitemap, homepage metadata, job detail structured data and missing-job noindex behavior.

### M27 - Trabalhador Marketplace Workspace

Status: complete.

- Reorganized the authenticated marketplace for trabalhador accounts into a simpler workspace with a compact market summary, full-width filters, a dedicated vacancy panel and a wider CV panel.
- Split the trabalhador CV editor into clear sections for main details, previous experience and references, with a completion indicator and cleaner profile-photo upload control.
- Preserved the existing internal `worker` role, application gate, company-visible published CV data and API/storage flow.
- Bumped the public shell cache and asset query string so deployed browsers fetch the revised authenticated workspace.

### M28 - TrataPro Public Brand

Status: complete.

- Selected `TrataPro` as the public marketplace/app brand after avoiding obvious visible conflicts with names such as ObraCerta, MaoCerta, ProvaWork, ProvaCerta, VagaCerta and TurnoPro.
- Added the slogan `Trabalho certo. Prova feita.` to the public topbar, footer, reserved-access hero and PWA metadata.
- Replaced the placeholder public `LuisTrata` / `LT` mark with a simple `TP` wordmark and SVG app icon.
- Added a visible horizontal `logo.svg` wordmark to the public topbar and server-rendered pages, and used the SVG icon in the footer, reserved-access hero and authenticated shell so the brand is visible in the product UI.
- Updated SEO site names, server-rendered vacancy pages, evidence watermark branding, package description, service-worker cache and asset query string.
- Kept `MANIFESTO` terminology for the private client/developer project portal and source-document references.

## Next Recommended Work

1. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to the Vercel production environment after the Google OAuth client is created.
2. Redeploy production so Vercel picks up the new env vars, cron config and simplified public shell.
3. Run `supabase/migrations/20260811000000_project_viewer_roles.sql` in the production Supabase project if it has not already been applied.
4. Create or invite a `client` account and a `developer` account from the company `Equipa` tab.
5. Verify `/` as the simplified public vacancy page and `/cliente` as the reserved project login on production.
6. Verify Google login for an existing client/developer account, an existing company account and a new trabalhador account.
7. Verify private `Projeto` and `MVP` tabs with client/developer roles on production.
8. Run `supabase/migrations/20260812000000_evidence_validation_retention.sql` in production if the previous migrations are already applied.
9. Run `supabase/migrations/20260817000000_worker_cv_profiles.sql` in production.
10. Verify `/api/cron/operational-maintenance` runs from the configured scheduler.
11. Verify trabalhador/company registration, trabalhador CV publishing, authenticated marketplace layout, vacancy publishing, applications, GPS-required three-photo evidence upload, watermarked downloads, validation reminders and seven-day retention against Supabase.
12. Run a proper trademark/domain/legal availability check for `TrataPro` before paid launch, then set `PUBLIC_SITE_URL` in production to the final public origin and submit `/sitemap.xml` in Google Search Console after the first production deployment.
13. Ask the client to approve real completion percentage, manual-to-requirement mappings and acceptance criteria.
14. Add authenticated document storage/access rules before exposing private manuals, contract or proposal files.
15. Add browser-driven regression coverage for public routes, public filtering and trabalhador application.

## Agent Update Protocol

For every future build turn:

1. Re-read this file and `docs/REQUIREMENTS_TRACE.md`.
2. Identify whether the requested change is Phase 1 scope or a change request.
3. Update the relevant documentation before final response.
4. Run `npm run check`; run `npm run smoke` for API or workflow changes.
5. Record completed work in `docs/CHANGELOG.md`.
