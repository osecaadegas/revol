# Progressive Build Plan

## Current Product Boundary

The repository started with only source PDFs and no existing app. This implementation creates the first app in the repository root.

The corrected first product concept is a public labor-market board: vacancies are visible without login, workers register to apply, and companies register to publish vacancies. The homepage must feel like a practical LinkedIn-style job feed, while client/developer project information remains private. The operational work-order/evidence module remains part of the company workspace and is still backed by the contract annex.

The engineering manuals and manifesto inform terminology and auditability principles, but they do not expand Phase 1 into Tiers, AI, blockchain, decentralized infrastructure, scoring, automated dispute resolution, or commercial SaaS.

## Architecture Chosen For Phase 1

- Static frontend in `public/`.
- No-dependency Node API in `server/`.
- Selectable persistence: local JSON/private files for development, or Supabase Postgres/private Storage for deployment.
- Bearer-token authentication with server-side session validation.
- Server-enforced role access for worker, company, manager, employee, contractor, client, and developer profiles.
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
- New Google users can self-create only `worker` accounts from the worker registration path.
- Company, client, developer, manager, employee and contractor access remains controlled by the existing registration, user creation and invite flows.
- Stored Google identity metadata in the existing user profile JSON so no extra Supabase table is required.

### M18 - Evidence Validation Retention

Status: complete.

- Final task completion now requires at least three non-expired task evidence photos with accepted authenticity metadata and granted GPS.
- Evidence uploads record browser file capture time, server upload time, GPS coordinates/timestamp, SHA-256 file hash, authenticity checks and seven-day expiry.
- Submitted tasks receive a 12-hour employer validation deadline and auto-approve after the deadline on the next authenticated maintenance pass.
- Authorized parties can download retained evidence through an audited watermarked SVG copy containing job, GPS, time and hash metadata.
- Added a Supabase migration plus reset-schema updates for evidence metadata, retention expiry and task validation deadlines.

## Next Recommended Work

1. Configure Google OAuth credentials and authorized callback URLs for local and production.
2. Run `supabase/migrations/20260811000000_project_viewer_roles.sql` in the production Supabase project if it has not already been applied.
3. Create or invite a `client` account and a `developer` account from the company `Equipa` tab.
4. Verify `/` as the public job feed and `/cliente` as the reserved project login on production.
5. Verify Google login for an existing client/developer account, an existing company account and a new worker account.
6. Verify private `Projeto` and `MVP` tabs with client/developer roles on production.
7. Run `supabase/migrations/20260812000000_evidence_validation_retention.sql` in production if the previous migrations are already applied.
8. Verify worker/company registration, vacancy publishing, applications, GPS-required three-photo evidence upload, watermarked downloads and seven-day retention against Supabase.
9. Ask the client to approve real completion percentage, manual-to-requirement mappings and acceptance criteria.
10. Add authenticated document storage/access rules before exposing private manuals, contract or proposal files.
11. Add browser-driven regression coverage for public routes, public filtering and worker application.

## Agent Update Protocol

For every future build turn:

1. Re-read this file and `docs/REQUIREMENTS_TRACE.md`.
2. Identify whether the requested change is Phase 1 scope or a change request.
3. Update the relevant documentation before final response.
4. Run `npm run check`; run `npm run smoke` for API or workflow changes.
5. Record completed work in `docs/CHANGELOG.md`.
