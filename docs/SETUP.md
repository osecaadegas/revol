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

When the app opens, visitors see the public `TrataPro` vacancy marketplace first. The public slogan is `Trabalho certo. Prova feita.` It uses a simple search-first landing, compact market summary, featured vacancy list, candidate/company calls to action and modal-based account access from the topbar `Login / Registar` button and page buttons. Project status, roadmap, scope, modules, documentation structure, changelog, requirements, feedback and deliverables are private workspace information for authenticated client/developer access through `/cliente`.

Use the vacancy filters in the marketplace section to search by company/keyword/contract, cargo or function, location, and radius around known Portuguese cities. Cargo/function and location fields include dropdown suggestions from common operational options, known Portuguese locations and live vacancy data while still accepting free text.

To use the marketplace:

- Trabalhadores create a trabalhador account to apply to vacancies.
- Trabalhadores publish a CV profile with photo, birth date, skills, previous experience and references before submitting applications. In the authenticated marketplace, the CV editor is sectioned into main details, experience and references so the profile is easier to complete.
- Companies create a company account to publish vacancies and review applications.
- Companies can see published trabalhador CV profiles and CV details attached to received applications.

After company registration, use the company account to:

- Publish vacancies.
- Review trabalhador applications.
- Create employees, contractors, client users or developer users directly.
- Generate invite links for employees, contractors, clients or developers.
- Create work orders.
- Create and assign tasks.
- Review submitted evidence.

Use `/cliente` with a `client` or `developer` account to view the private MANIFESTO project dashboard and private MVP development cockpit. Trabalhador and company registration remain on the public `TrataPro` vacancies page.

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
CRON_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
PUBLIC_SITE_URL=
```

`PORT` controls the server port.

`APP_DATA_DIR` controls where `database.json` and private uploads are stored. Use a persistent absolute path in production.

`MAX_UPLOAD_MB` limits each uploaded image.

`APP_STORAGE_DRIVER` selects persistence. Use `local` for development and `supabase` for deployment.

`SUPABASE_URL` is the Supabase project URL.

`SUPABASE_SERVICE_ROLE_KEY` is required only on the server when using Supabase. Do not put it in frontend code.

`SUPABASE_EVIDENCE_BUCKET` defaults to the private bucket created by the migration.

`CRON_SECRET` protects `/api/cron/operational-maintenance`. Set a long random value in production so Vercel Cron or an external scheduler can run evidence cleanup and validation reminders.

`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` enable Google OAuth login.

`GOOGLE_REDIRECT_URI` is optional. If empty, the server derives `/api/auth/google/callback` from the active request origin. In production, set it explicitly if your hosting/proxy origin is not stable.

`PUBLIC_SITE_URL` is optional but recommended in production. Set it to the final public origin, for example `https://your-production-domain`, so canonical URLs, `robots.txt`, `sitemap.xml`, and server-rendered public vacancy detail pages use one stable domain. If empty, the server derives the origin from the request headers.

## SEO Setup

The public marketplace has server-generated SEO basics:

- `/` and `/cliente` receive canonical, Open Graph, Twitter and WebSite/Organization structured metadata.
- `/robots.txt` allows the public site, blocks `/api/`, and points crawlers to `/sitemap.xml`.
- `/sitemap.xml` lists `/`, `/cliente`, and every currently open public vacancy as `/vagas/:id`.
- `/vagas/:id` renders an open vacancy as HTML with visible job content and JobPosting JSON-LD.
- Closed or missing vacancy pages return `404` with `noindex,follow`.

For production, set `PUBLIC_SITE_URL`, deploy, then submit the sitemap URL in Google Search Console:

```text
https://your-production-domain/sitemap.xml
```

## Google Login Setup

Google login uses the server-side OpenID Connect authorization-code flow. Configure OAuth credentials in Google Cloud and add these authorized redirect URIs:

```text
http://localhost:4173/api/auth/google/callback
http://127.0.0.1:4173/api/auth/google/callback
https://your-production-domain/api/auth/google/callback
```

Use the exact local host and port you are running. Then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on the server or Vercel environment.

Behavior:

- Existing active users can sign in with Google when the Google account email matches their app email.
- New users can create an internal `worker` account through the trabalhador registration Google button.
- Google login does not auto-create company, client, developer, manager, employee, or contractor accounts. Those remain controlled by company registration, direct user creation, or invites.
- The Google identity is stored in the existing user `profile.authProviders.google` data, so no extra Supabase table is required.

## Supabase Setup

For a dirty Supabase project that already contains old prototype tables, run the reset procedure in `docs/SUPABASE_RESET.md` instead of the normal migration sequence below.

1. Create a Supabase project.
2. Open the SQL editor.
3. Run `supabase/migrations/20260810000000_initial_phase1_schema.sql`.
4. Run `supabase/migrations/20260810010000_marketplace_jobs.sql`.
5. Run `supabase/migrations/20260810020000_job_offer_position.sql`.
6. Run `supabase/migrations/20260811000000_project_viewer_roles.sql`.
7. Run `supabase/migrations/20260812000000_evidence_validation_retention.sql`.
8. Run `supabase/migrations/20260817000000_worker_cv_profiles.sql`.
9. Confirm the private storage bucket `meo-evidence` exists.
10. Set these environment variables on the host:

```text
APP_STORAGE_DRIVER=supabase
SUPABASE_URL=<your Supabase project URL>
SUPABASE_SERVICE_ROLE_KEY=<server-only service role key>
SUPABASE_EVIDENCE_BUCKET=meo-evidence
```

11. Start or redeploy the Node app.

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

Do not expose `data/uploads/` through a static web server. Images must be served through authenticated API routes such as `/api/evidence/:id/file` and `/api/workers/:id/profile-photo`, which check access before returning private files.

In `APP_STORAGE_DRIVER=supabase`, operational records are stored in Supabase tables prefixed with `meo_`, and photos are stored in the private Supabase bucket. Evidence photos are retained for seven days from upload, then deleted by the app during authenticated maintenance passes or the protected scheduled maintenance endpoint. Trabalhador CV profile photos remain private profile assets and are not part of the seven-day evidence retention cleanup. Backups should be configured in Supabase.

## Production Notes

This build is ready for a Phase 1 test environment on a persistent Node host or on a Node host backed by Supabase.

For production:

- Run behind HTTPS.
- Use `APP_STORAGE_DRIVER=supabase` for serverless or production-like deployment.
- Configure Supabase backups.
- Restrict server filesystem access.
- Use strong passwords and remove inactive users quickly.
- Review privacy/labor notices before using real trabalhador data.

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

Set the Supabase environment variables before deploying. If Google login is enabled, also set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and optionally `GOOGLE_REDIRECT_URI`. Do not use local filesystem persistence on Vercel.

Set `PUBLIC_SITE_URL` to the final production URL before deploying if the project uses preview URLs or custom domains. This keeps canonical URLs and sitemap links stable.

Set `CRON_SECRET` before deploying. `vercel.json` schedules `/api/cron/operational-maintenance` daily at 07:00 UTC, which is compatible with broad Vercel plan limits. The endpoint can also be called more frequently by an external scheduler or a Vercel Pro cron if stricter reminder timing is required. The request must send:

```text
Authorization: Bearer <CRON_SECRET>
```

If the public page shows a database setup warning, verify that `supabase/admin/reset_to_current_schema.sql` has been run and that the Vercel environment variables are set for the active deployment environment.

If a browser still shows an old public layout after deployment, reload once after the new service worker activates. The app shell uses network-first service-worker fetching and no-store headers for `index.html`, `app.js`, `styles.css`, `manifest.webmanifest`, and `service-worker.js` so stale public pages are not kept as the default.

## Verification

Run:

```bash
npm run build
npm run check
npm run smoke
```

`npm run build` runs deploy-time syntax validation. The production app uses the root `server.js` serverless entrypoint and does not require a generated static build directory.

`npm run check` validates JavaScript syntax.

`npm run smoke` creates a temporary local database, exercises public vacancy visibility, company registration, vacancy creation, trabalhador registration, trabalhador CV publishing, application submission, application review, user creation, work order creation, task assignment, GPS-required multi-photo evidence upload, three-photo validation enforcement, task submission, manager approval, scheduled maintenance authorization, employer validation reminders, authenticated image access, and watermarked evidence download.

Manual UI verification should include `/` as the public vacancy feed, `/cliente` as the reserved project login, `/changelog`, public navigation, mobile menu, vacancy filters, login/register forms, the authenticated trabalhador marketplace/CV workspace, the private `Projeto` and `MVP` workspace tabs for client/developer users, `/api/project/private` and `/api/mvp/private` authorization behavior, and authenticated operational workspace routes for company/manager/employee/contractor users.

Manual SEO verification should include `/robots.txt`, `/sitemap.xml`, one open `/vagas/:id` URL, and one missing `/vagas/:id` URL.
