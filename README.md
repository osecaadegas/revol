# MANIFESTO

Professional engineering project portal and Phase 1 webapp for a public worker/company marketplace plus operational evidence workflows. The public surface exposes only the client access area and public vacancies; project status, roadmap, modules, documentation structure, changelog and traceability are reserved for authenticated client/developer access.

## Quick Start

```bash
npm run build
npm run start
```

Open `http://localhost:4173`.

On launch, visitors see the MANIFESTO client access area. The public marketplace remains available with filters for keyword, company, work position, location, and kilometer radius. Workers register to apply. Companies register to publish vacancies and review applications. Company/manager accounts can also see the private project dashboard and use the operational workspace for user management, work orders, tasks, evidence upload, validation flow, and audit log.

For real deployment, run the Supabase migrations in `supabase/migrations/` in timestamp order and set `APP_STORAGE_DRIVER=supabase` with the Supabase server environment variables documented in `docs/SETUP.md`.

`npm run build` validates the Node serverless entrypoint and browser shell syntax. This app is served by the root `server.js` entrypoint rather than a generated `dist/` folder.

## Scripts

- `npm run start` - run the Node API and static frontend.
- `npm run dev` - same runtime, intended for local development.
- `npm run build` - deploy-time syntax validation for the serverless entrypoint and browser shell.
- `npm run check` - syntax-check server and browser scripts.
- `npm run smoke` - run an end-to-end API smoke test against a temporary data directory.

## Documentation

- `docs/SETUP.md` - setup, first-run, data storage, deployment notes.
- `docs/AUDIT.md` - current product, UX, architecture and code-quality audit.
- `docs/SUPABASE_RESET.md` - destructive reset procedure for Supabase projects with old prototype tables.
- `docs/PROGRESSIVE_BUILD_PLAN.md` - phased implementation plan and agent workflow.
- `docs/REQUIREMENTS_TRACE.md` - source requirement mapping to implementation.
- `docs/API.md` - API contract for future mobile or backend migration.
- `docs/CHANGELOG.md` - project change log.
