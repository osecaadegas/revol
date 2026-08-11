# Changelog

## 2026-08-10

- Created the Phase 1 webapp in the repository root from the PDF requirements.
- Added no-dependency Node API with authentication, sessions, role checks, local persistence, private upload storage, and audit logging.
- Added mobile-first static frontend with setup, login, dashboard, work orders, tasks, evidence upload, validation, team management, invite links, and history.
- Added PWA manifest and shell service worker.
- Added setup guide, progressive build plan, requirements trace, API documentation, and future-agent notes.
- Added same-origin HttpOnly session cookie support so private evidence images and JSON export work in the browser while API bearer tokens remain supported.
- Added Supabase Postgres/Storage backend support with migration, private bucket, RLS-enabled tables, environment configuration, and selectable `APP_STORAGE_DRIVER`.
- Added active storage driver reporting to `/api/health`.
- Corrected product concept to a public vacancy marketplace: visible job offers, worker registration/application flow, company registration/vacancy creation flow, application review, new Supabase marketplace migration, and updated smoke coverage.
- Improved the homepage into a public-first job board with keyword, cargo/function, location, and radius filters, plus a dedicated vacancy `position` field and Supabase migration for company postings.
- Added an admin Supabase reset script and documentation to remove old unprefixed prototype tables and recreate the current `meo_*` schema.
