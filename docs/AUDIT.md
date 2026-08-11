# MANIFESTO Product And Technical Audit

## Repository Architecture

- Static frontend in `public/` with a single vanilla JavaScript application file.
- No-dependency Node API in `server/index.js`.
- Root `server.js` adapts the shared request handler for Vercel serverless deployment.
- Local JSON/private-upload persistence for development.
- Supabase Postgres/private Storage support for production-like deployment.
- Project documentation lives in `docs/`.
- Source PDFs remain in the repository root and are not exposed by the static server.

## Existing Functionality Preserved

- Public vacancy listing through `/api/jobs/public`.
- Worker registration and authenticated vacancy applications.
- Company registration, vacancy creation, vacancy status changes, and application review.
- Company workspace with work orders, tasks, evidence upload, validation and audit history.
- Server-side role checks for worker, company, manager, employee and contractor.
- Private evidence delivery through authenticated API access.
- Supabase reset/admin SQL and migrations.

## Issues Found

- Public entrypoint looked like a simple vacancy prototype rather than a professional engineering project portal.
- Main public navigation did not communicate the MANIFESTO information architecture.
- Project status, roadmap, scope, deliverables, requirements traceability and documentation structure must be visible only to authenticated client/developer users.
- No public changelog or client-area route existed.
- Product versioning was only present in developer documentation, not in the UI.
- Documentation and private-source file handling needed clearer public boundaries.
- Tables and future structured data needed a mobile-friendly UI pattern.

## Changes Implemented

- Rebuilt the public experience around a restricted MANIFESTO client access area.
- Moved project information into the authenticated workspace `Projeto` tab.
- Moved private project dashboard copy out of the public static bundle and into authenticated server-rendered HTML.
- Added reusable, data-driven UI sections for phases, roadmap, modules, requirements, acceptance criteria, deliverables, documentation groups, changelog entries, change requests and feedback foundations.
- Added `/cliente` for the client dashboard foundation.
- Kept `/changelog` public route from exposing version history; changelog is now shown inside the private workspace.
- Kept the existing marketplace in the public page as an MVP module instead of removing it.
- Added professional technical styling: neutral surfaces, charcoal typography, subtle blue accents, thin borders, compact hero and controlled grid language.
- Improved responsive behaviour for nav, cards, roadmap and requirement tables.
- Updated metadata, PWA manifest and icon for MANIFESTO.

## Remaining Dependencies

- Run `supabase/admin/reset_to_current_schema.sql` in the target Supabase project before production data flows can be fully validated.
- Configure Vercel production environment variables for Supabase.
- Client must approve real completion percentage, detailed manual-to-requirement mappings, private document access rules and final acceptance criteria.
- Future authenticated document access should be backed by database/file-storage permissions before exposing private commercial/legal documents.
