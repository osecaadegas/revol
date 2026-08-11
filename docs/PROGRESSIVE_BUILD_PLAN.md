# Progressive Build Plan

## Current Product Boundary

The repository started with only source PDFs and no existing app. This implementation creates the first app in the repository root.

The corrected first product concept is a public labor-market board: vacancies are visible without login, workers register to apply, and companies register to publish vacancies. The operational work-order/evidence module remains part of the company workspace and is still backed by the contract annex.

The engineering manuals and manifesto inform terminology and auditability principles, but they do not expand Phase 1 into Tiers, AI, blockchain, decentralized infrastructure, scoring, automated dispute resolution, or commercial SaaS.

## Architecture Chosen For Phase 1

- Static frontend in `public/`.
- No-dependency Node API in `server/`.
- Selectable persistence: local JSON/private files for development, or Supabase Postgres/private Storage for deployment.
- Bearer-token authentication with server-side session validation.
- Server-enforced role access for worker, company, manager, employee, and contractor profiles.
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
- Added worker registration and authenticated applications.
- Added company registration, vacancy creation, close/reopen controls, and application review.
- Added marketplace persistence to the local and Supabase data model.
- Updated smoke tests to cover the public job board and application workflow.

### M8 - Public Job Discovery

Status: complete.

- Kept the homepage publicly accessible instead of login-first.
- Added LinkedIn-style vacancy filters for keyword/company/contract, cargo/function, location, and radius around known Portuguese cities.
- Added a separate vacancy `position` field and Supabase follow-up migration so companies can publish a clear role/function and workers can filter by it.
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

## Next Recommended Work

1. Run `supabase/admin/reset_to_current_schema.sql` once in the dirty Supabase project.
2. Configure deployment environment variables for Supabase.
3. Verify worker/company registration, vacancy publishing, applications, and evidence upload against Supabase.
4. Add browser-driven regression coverage for public filtering and worker application.
5. Add optional email delivery for worker/company notifications.
6. Add client-specific branding only after receiving approved logo, colors, and copy.

## Agent Update Protocol

For every future build turn:

1. Re-read this file and `docs/REQUIREMENTS_TRACE.md`.
2. Identify whether the requested change is Phase 1 scope or a change request.
3. Update the relevant documentation before final response.
4. Run `npm run check`; run `npm run smoke` for API or workflow changes.
5. Record completed work in `docs/CHANGELOG.md`.
