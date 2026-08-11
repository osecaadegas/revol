# Motor de Evidencia Operacional

Phase 1 webapp for a public worker/company marketplace plus operational evidence workflows: vacancies visible to everyone, worker applications, company vacancy management, work orders, assigned tasks, photographic evidence, point-in-time location capture, manager validation, and audit history.

## Quick Start

```bash
npm run start
```

Open `http://localhost:4173`.

On launch, visitors see public vacancies with filters for keyword, company, work position, location, and kilometer radius. Workers register to apply. Companies register to publish vacancies and review applications. Company/admin accounts can also use the operational workspace for user management, work orders, tasks, evidence upload, validation flow, and audit log.

For real deployment, run the Supabase migrations in `supabase/migrations/` in timestamp order and set `APP_STORAGE_DRIVER=supabase` with the Supabase server environment variables documented in `docs/SETUP.md`.

## Scripts

- `npm run start` - run the Node API and static frontend.
- `npm run dev` - same runtime, intended for local development.
- `npm run check` - syntax-check server and browser scripts.
- `npm run smoke` - run an end-to-end API smoke test against a temporary data directory.

## Documentation

- `docs/SETUP.md` - setup, first-run, data storage, deployment notes.
- `docs/SUPABASE_RESET.md` - destructive reset procedure for Supabase projects with old prototype tables.
- `docs/PROGRESSIVE_BUILD_PLAN.md` - phased implementation plan and agent workflow.
- `docs/REQUIREMENTS_TRACE.md` - source requirement mapping to implementation.
- `docs/API.md` - API contract for future mobile or backend migration.
- `docs/CHANGELOG.md` - project change log.
