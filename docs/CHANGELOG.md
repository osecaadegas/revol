# Changelog

## 2026-08-17

- Added protected scheduled maintenance endpoint `/api/cron/operational-maintenance`.
- Added Vercel Cron scheduling for daily evidence cleanup, validation auto-approval and validation reminder generation.
- Added manager dashboard validation reminder cards for tasks waiting on the 12-hour employer approval window.
- Added `CRON_SECRET` setup documentation and smoke coverage for cron authorization and reminder alerts.
- Simplified the public landing page into a cleaner search-first vacancy page with featured jobs, market summary, company/trabalhador calls to action and a refreshed shell cache.
- Added large dropdown suggestion menus for public cargo/function and location vacancy filters while preserving free-text search.
- Added trabalhador CV profiles with private profile photos, birth dates, skills, previous experience, references, application gating, company-visible profile cards and Supabase profile indexing.
- Simplified public login/register by moving trabalhador, company and login forms into a topbar-triggered modal and removing the large inline auth panel.
- Made the public topbar account entry explicit as `Login / Registar` and restyled it so visitors can immediately find the login/register modal.
- Renamed public-facing `worker` labels to `Trabalhador` while keeping the internal role, API paths and Supabase schema stable.
- Added SEO core routes with dynamic canonical metadata, `robots.txt`, `sitemap.xml`, server-rendered public vacancy detail pages and JobPosting structured data.
- Reorganized the authenticated trabalhador marketplace into a cleaner workspace with summary stats, full-width filters, a clearer vacancy area and structured CV sections.
- Added the `TrataPro` public brand with slogan `Trabalho certo. Prova feita.`, a new `TP` logo mark, refreshed metadata, PWA manifest and branded evidence watermark text.

## 2026-08-12

- Added GPS-required final task evidence with at least three authenticated photos before validation.
- Added evidence metadata for capture/upload time, GPS, SHA-256 hash, authenticity checks and seven-day retention expiry.
- Added 12-hour employer validation deadlines with automatic approval after expiry.
- Added authenticated watermarked evidence downloads with visible and embedded structured metadata, plus audit entries for downloads and retention deletion.
- Added Supabase migration `20260812000000_evidence_validation_retention.sql` and updated reset/current schema SQL.

## 2026-08-11

- Increased public homepage background visibility on large screens with stronger animated network lanes, higher contrast grid motion, translucent landing cards and a fresh app-shell cache version.
- Added Google OAuth login for existing accounts plus trabalhador-only Google self-registration, with server-side callback handling and setup documentation.
- Added a more alive public interface with wider desktop search/filter controls, animated surface grid, header signal motion, card entrance states and service-worker cache bump.
- Modernized the public job-network UI with a cleaner 2026-style surface, stronger hierarchy, refined search/feed cards, improved auth tabs and clearer candidate/company entry points.
- Fixed stale public pages after deploy by replacing the service worker cache-first shell with network-first fetching, bumping the shell cache and disabling server cache for app shell files.
- Added a more LinkedIn-like landing surface with a compact top search, candidate profile entry card, central job search card and company hiring card.
- Reworked the public homepage into a LinkedIn-style vacancy feed with first-screen search, quick filters, result counts, job cards and trabalhador/company account actions.
- Kept project/client/developer information out of the public homepage and left `/cliente` as the reserved project access route.
- Repositioned the public application as MANIFESTO, a professional engineering project portal.
- Added public routes for `/cliente` and `/changelog`.
- Added structured UI data for phases, roadmap, modules, requirements, acceptance criteria, deliverables, documentation groups, change requests, feedback and versions.
- Added responsive technical design system, mobile public navigation, responsive requirement table cards and MANIFESTO metadata/PWA branding.
- Added `npm run build` as a deploy-time validation script for the Node serverless app.
- Added `docs/AUDIT.md` with product, UX, architecture and remaining-dependency findings.
- Restricted public project information to a client access gate and moved status, roadmap, modules, requirements, documentation and changelog into the authenticated `Projeto` workspace tab.
- Moved private project dashboard content out of the public JavaScript bundle and behind authenticated `/api/project/private`.
- Added the private `MVP` workspace tab for the active `Desenvolvimento do MVP` phase with authenticated server-rendered readiness checks for marketplace, accounts, tasks, evidence and audit.
- Added first-class `client` and `developer` roles and restricted private `Projeto` / `MVP` access to those roles.

## 2026-08-10

- Created the Phase 1 webapp in the repository root from the PDF requirements.
- Added no-dependency Node API with authentication, sessions, role checks, local persistence, private upload storage, and audit logging.
- Added mobile-first static frontend with setup, login, dashboard, work orders, tasks, evidence upload, validation, team management, invite links, and history.
- Added PWA manifest and shell service worker.
- Added setup guide, progressive build plan, requirements trace, API documentation, and future-agent notes.
- Added same-origin HttpOnly session cookie support so private evidence images and JSON export work in the browser while API bearer tokens remain supported.
- Added Supabase Postgres/Storage backend support with migration, private bucket, RLS-enabled tables, environment configuration, and selectable `APP_STORAGE_DRIVER`.
- Added active storage driver reporting to `/api/health`.
- Corrected product concept to a public vacancy marketplace: visible job offers, trabalhador registration/application flow, company registration/vacancy creation flow, application review, new Supabase marketplace migration, and updated smoke coverage.
- Improved the homepage into a public-first job board with keyword, cargo/function, location, and radius filters, plus a dedicated vacancy `position` field and Supabase migration for company postings.
- Added an admin Supabase reset script and documentation to remove old unprefixed prototype tables and recreate the current `meo_*` schema.
- Declared the Node server entrypoint in `package.json` and documented Vercel deployment settings.
- Added a root Vercel serverless adapter so Vercel invokes the request handler directly instead of importing the local server module shape.
- Made the public jobs endpoint degrade to an empty board with a setup warning when Supabase schema/configuration is incomplete.
