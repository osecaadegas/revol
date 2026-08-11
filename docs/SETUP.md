# Setup Guide

## Requirements

- Node.js 18 or newer.
- A browser with camera/photo upload support.
- HTTPS in production if point-in-time geolocation is needed. Browsers normally block geolocation on non-secure origins except `localhost`.
- Supabase project for real deployment storage.

The app supports two storage modes:

- `local`: development/test mode using `data/database.json` and `data/uploads/`.
- `supabase`: production/test-deployment mode using Supabase Postgres and private Supabase Storage.

## Install

There are no package dependencies to install.

```bash
npm run start
```

Then open:

```text
http://localhost:4173
```

## First Run

When the app opens, visitors see the public vacancy marketplace first. It should feel like a job network: search, quick filters, visible job cards and clear worker/company account actions. Project status, roadmap, scope, modules, documentation structure, changelog, requirements, feedback and deliverables are private workspace information for authenticated client/developer access through `/cliente`.

Use the vacancy filters in the marketplace section to search by company/keyword/contract, cargo or function, location, and radius around known Portuguese cities.

To use the marketplace:

- Workers create a worker account to apply to vacancies.
- Companies create a company account to publish vacancies and review applications.

After company registration, use the company account to:

- Publish vacancies.
- Review worker applications.
- Create employees, contractors, client users or developer users directly.
- Generate invite links for employees, contractors, clients or developers.
- Create work orders.
- Create and assign tasks.
- Review submitted evidence.

Use `/cliente` with a `client` or `developer` account to view the private MANIFESTO project dashboard and private MVP development cockpit. Worker and company registration remain on the public vacancies page.

## Environment Variables

Copy `.env.example` only if you need custom values.

```text
PORT=4173
APP_DATA_DIR=./data
MAX_UPLOAD_MB=6
APP_STORAGE_DRIVER=local
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_EVIDENCE_BUCKET=meo-evidence
```

`PORT` controls the server port.

`APP_DATA_DIR` controls where `database.json` and private uploads are stored. Use a persistent absolute path in production.

`MAX_UPLOAD_MB` limits each uploaded image.

`APP_STORAGE_DRIVER` selects persistence. Use `local` for development and `supabase` for deployment.

`SUPABASE_URL` is the Supabase project URL.

`SUPABASE_SERVICE_ROLE_KEY` is required only on the server when using Supabase. Do not put it in frontend code.

`SUPABASE_EVIDENCE_BUCKET` defaults to the private bucket created by the migration.

## Supabase Setup

For a dirty Supabase project that already contains old prototype tables, run the reset procedure in `docs/SUPABASE_RESET.md` instead of the normal migration sequence below.

1. Create a Supabase project.
2. Open the SQL editor.
3. Run `supabase/migrations/20260810000000_initial_phase1_schema.sql`.
4. Run `supabase/migrations/20260810010000_marketplace_jobs.sql`.
5. Run `supabase/migrations/20260810020000_job_offer_position.sql`.
6. Run `supabase/migrations/20260811000000_project_viewer_roles.sql`.
7. Confirm the private storage bucket `meo-evidence` exists.
8. Set these environment variables on the host:

```text
APP_STORAGE_DRIVER=supabase
SUPABASE_URL=<your Supabase project URL>
SUPABASE_SERVICE_ROLE_KEY=<server-only service role key>
SUPABASE_EVIDENCE_BUCKET=meo-evidence
```

9. Start or redeploy the Node app.

The app still uses its own Phase 1 email/password/session system. Supabase Auth is not used in this phase, because the existing server already enforces roles, task visibility, and private evidence access.

## Supabase Reset For Old Tables

The current project should use only the `meo_*` app tables listed in `docs/SUPABASE_RESET.md`. If a Supabase project already has old public tables such as `companies`, `tasks`, `task_blocks`, or `work_orders`, run `supabase/admin/reset_to_current_schema.sql` through the Supabase SQL Editor before starting the app with `APP_STORAGE_DRIVER=supabase`.

## Local Data And Backups

In `APP_STORAGE_DRIVER=local`, runtime data is stored in:

```text
data/database.json
data/uploads/
```

Back up both together. The JSON database references files in `uploads/`.

Do not expose `data/uploads/` through a static web server. Images must be served through `/api/evidence/:id/file`, which checks authentication and task access.

In `APP_STORAGE_DRIVER=supabase`, operational records are stored in Supabase tables prefixed with `meo_`, and photos are stored in the private Supabase bucket. Backups should be configured in Supabase.

## Production Notes

This build is ready for a Phase 1 test environment on a persistent Node host or on a Node host backed by Supabase.

For production:

- Run behind HTTPS.
- Use `APP_STORAGE_DRIVER=supabase` for serverless or production-like deployment.
- Configure Supabase backups.
- Restrict server filesystem access.
- Use strong passwords and remove inactive users quickly.
- Review privacy/labor notices before using real worker data.

Local filesystem persistence is not suitable for serverless platforms that discard file writes between requests. For Vercel/serverless, set `APP_STORAGE_DRIVER=supabase`.

## Vercel Deployment

Use the Node application preset. The Vercel entrypoint is the root `server.js` adapter, which exports the existing Node request handler from `server/index.js`.

Use these project settings:

```text
Install command: npm install
Build command: empty
Start command: npm run start
Output directory: empty
```

Set the Supabase environment variables before deploying. Do not use local filesystem persistence on Vercel.

If the public page shows a database setup warning, verify that `supabase/admin/reset_to_current_schema.sql` has been run and that the Vercel environment variables are set for the active deployment environment.

## Verification

Run:

```bash
npm run build
npm run check
npm run smoke
```

`npm run build` runs deploy-time syntax validation. The production app uses the root `server.js` serverless entrypoint and does not require a generated static build directory.

`npm run check` validates JavaScript syntax.

`npm run smoke` creates a temporary local database, exercises public vacancy visibility, company registration, vacancy creation, worker registration, application submission, application review, user creation, work order creation, task assignment, evidence upload, task submission, manager approval, and authenticated image access.

Manual UI verification should include `/` as the public vacancy feed, `/cliente` as the reserved project login, `/changelog`, public navigation, mobile menu, vacancy filters, login/register forms, the private `Projeto` and `MVP` workspace tabs for client/developer users, `/api/project/private` and `/api/mvp/private` authorization behavior, and authenticated operational workspace routes for company/manager/employee/contractor users.
