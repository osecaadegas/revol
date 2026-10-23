# Setup Guide

## Planeamento da equipa (23-10-2026)

Depois das migrações anteriores, aplique `supabase/migrations/20261023120000_worker_planning_and_day_off.sql` no mesmo projeto Supabase configurado para esta aplicação. Até lá, a grelha e os pedidos de folga surgem indisponíveis, sem interferir com tarefas ou presenças existentes. No armazenamento local, as coleções são criadas automaticamente. A empresa define horários por dia/trabalhador; as folgas pedidas com menos de 24 horas antes do início do dia em `Europe/Lisbon` são recusadas pelo servidor. A aprovação é explícita e retira o horário planeado nesse dia; não altera tarefas nem justificações de ausência.

Depois desta migração, aplique também `supabase/migrations/20261023140042_schedule_task_link.sql` antes de publicar a versão que guarda `task_id`. A coluna é opcional para preservar horários antigos; novos horários exigem uma tarefa atribuída ao trabalhador e com morada. As notificações de alteração no dispositivo requerem a configuração Web Push já descrita neste documento; os avisos dentro da aplicação não dependem dela. Não existe comprovativo de abertura/leitura do aviso pelo trabalhador.

## Requirements

For the recruitment release, apply
`supabase/migrations/20261007035242_recruitment_upgrade.sql` after the existing
migrations before deploying. This migration has already been applied to the
user-confirmed production project in this session. See
`docs/RECRUITMENT_UPGRADE.md` for administrator setup, optional Resend email
configuration, privacy behavior, new tests and verified deployment details.

The Digital CV and verified-employment change also requires
`supabase/migrations/20261013070041_digital_cv_employment_history.sql` after the
recruitment migration. This new migration has not been claimed as applied to
production. See `docs/DIGITAL_CV_EMPLOYMENT.md` before enabling the workflows.

- Node.js 18 or newer.
- A browser with camera/photo upload support.
- HTTPS in production if point-in-time geolocation is needed. Browsers normally block geolocation on non-secure origins except `localhost`.
- Supabase project for real deployment storage.

The app supports two storage modes:

Task-location previews use the standard Google Maps embed generated from the
saved work address and require no Google Maps API key. The page CSP permits
frames only from `www.google.com` and `maps.google.com`. Opening a task with a
map allows the browser to connect to Google; reflect this third-party processing
in the production privacy notice as applicable.

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

When the app opens, visitors see the public `TrataPro` vacancy marketplace first. The public slogan is `Trabalho certo. Prova feita.` The visible logo assets are `public/logo.svg` for the horizontal wordmark and `public/icon.svg` for the app/icon mark. The page uses a simple search-first landing, compact market summary, featured vacancy list, candidate/company calls to action and modal-based account access from the topbar `Login / Registar` button and page buttons. Project status, roadmap, scope, modules, documentation structure, changelog, requirements, feedback and deliverables are private workspace information for authenticated client/developer access through `/cliente`.

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
MAX_CV_UPLOAD_MB=8
APP_STORAGE_DRIVER=local
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_EVIDENCE_BUCKET=meo-evidence
EVALUATION_REVIEW_MONTHS=12
EMPLOYMENT_DATA_RETENTION_YEARS=6
ACCESS_REQUEST_DAYS=30
CRON_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
PUBLIC_SITE_URL=
```

`PORT` controls the server port.

`APP_DATA_DIR` controls where `database.json` and private uploads are stored. Use a persistent absolute path in production.

`MAX_UPLOAD_MB` limits each uploaded image.

`MAX_CV_UPLOAD_MB` limits each private PDF or DOCX CV upload.

`APP_STORAGE_DRIVER` selects persistence. Use `local` for development and `supabase` for deployment.

`SUPABASE_URL` is the Supabase project URL.

`SUPABASE_SERVICE_ROLE_KEY` is required only on the server when using Supabase. Do not put it in frontend code.

`SUPABASE_EVIDENCE_BUCKET` defaults to the private bucket created by the migration.

`EVALUATION_REVIEW_MONTHS`, `EMPLOYMENT_DATA_RETENTION_YEARS` and
`ACCESS_REQUEST_DAYS` configure review expiry, retention redaction and access-
request expiry. Confirm production values through the DPIA/legal-retention
process; the example values are technical defaults, not legal advice.

`CRON_SECRET` protects `/api/cron/operational-maintenance`. Set a long random value in production so Vercel Cron or an external scheduler can run evidence cleanup and validation reminders.

`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` enable Google OAuth login.

`GOOGLE_REDIRECT_URI` is optional. If empty, the server derives `/api/auth/google/callback` from the active request origin. In production, set it explicitly if your hosting/proxy origin is not stable.

`PUBLIC_SITE_URL` is optional but recommended in production. Set it to the final public origin, for example `https://your-production-domain`, so canonical URLs, `robots.txt`, `sitemap.xml`, and server-rendered public vacancy detail pages use one stable domain. If empty, the server derives the origin from the request headers.

`PLATFORM_ADMIN_USER_IDS` and `PLATFORM_ADMIN_EMAILS` are optional,
comma-separated allowlists for the private recruitment administration area.
Email matching is case-insensitive. Keep both variables server-only and use only
accounts whose email ownership has been verified operationally.

## SEO Setup

The public marketplace has server-generated SEO basics:

- `/` receives canonical, Open Graph, Twitter, branded large social preview and WebSite/Organization structured metadata.
- `/cliente` remains reachable as the reserved access gate, but it is marked `noindex,follow` and is not listed in the sitemap.
- `/robots.txt` allows the public site, blocks `/api/`, and points crawlers to `/sitemap.xml`.
- `/sitemap.xml` lists `/` and every currently open public vacancy as `/vagas/:id`.
- `/vagas/:id` renders an open vacancy as HTML with visible job content, branded social preview metadata and JobPosting JSON-LD.
- Closed or missing vacancy pages return `404` with `noindex,follow`.
- Unknown static-like paths such as `/data/*` and `/tmp/*` return a noindex 404 instead of the public homepage.

The public social preview asset is `public/social-card.svg` and is referenced through the configured public origin.

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
- New Google trabalhador accounts must provide a valid, unused NIF in the
  registration form before leaving for Google authorization. It is submitted to
  TrataPro in a same-origin POST, kept in a short-lived signed HttpOnly same-site
  cookie and is not included in the URL or OAuth `state` sent to Google.
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
9. Run `supabase/migrations/20261007035242_recruitment_upgrade.sql`.
10. Run `supabase/migrations/20261013070041_digital_cv_employment_history.sql`.
11. Run `supabase/migrations/20261013074216_unique_registration_nif.sql`.
12. Run `supabase/migrations/20261017073331_professional_evaluation_history.sql`.
13. Run `supabase/migrations/20261020090000_worker_task_planning.sql`.
14. Run `supabase/migrations/20261020123000_evaluation_rating_scale_0_10.sql`.
15. Run `supabase/migrations/20261020160000_direct_worker_company_chat.sql`.
16. Run `supabase/migrations/20261020170000_merit_work_order_core.sql` before deploying the Cliente Zero work-order UI/API.
17. Run `supabase/migrations/20261020180000_work_attendance_and_justifications.sql` for factual clock-in/out and private absence justifications. This migration was not applied by this development turn: the Supabase projects connected to Codex did not contain the TrataPro `meo_*` schema. Apply it in the actual TrataPro project, never in an unrelated project. Until then the new attendance actions are disabled while existing routes continue to load.
18. Confirm the private storage bucket `meo-evidence` exists and remains private.
19. Set these environment variables on the host:

```text
APP_STORAGE_DRIVER=supabase
SUPABASE_URL=<your Supabase project URL>
SUPABASE_SERVICE_ROLE_KEY=<server-only service role key>
SUPABASE_EVIDENCE_BUCKET=meo-evidence
```

20. Start or redeploy the Node app.

The unified order form uses the existing `POST /api/work-orders` endpoint with
an optional `task` plan. It atomically creates one task per selected team member,
retaining the existing one-assignee-per-task permissions. The fixed worksite
coordinates are optional and must be checked by the manager; an address alone
is not a precision GPS point. Attendance uses server timestamps and stores no
worker coordinates. GPS-based attendance checks remain disabled pending a
specific Portuguese labour-law assessment, DPIA, proportionality decision,
worker information and an approved correction/appeal policy. Geolocation is
not a reliable proof of presence by itself (device error and spoofing).

Absence documents are private PDFs or PNG/JPEG images (maximum `MAX_UPLOAD_MB`),
served only to the worker or a company manager with the same verified
employment relationship. Configure a documented retention and deletion policy
and malware-screening procedure before processing real medical certificates;
workers should not type diagnoses into the optional reason. Existing
employment-report retention settings do not yet cover attendance records.

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

Before enabling worker task planning in an existing Supabase environment, run
`supabase/migrations/20261020090000_worker_task_planning.sql`. It adds the
verified-employment reference, scheduled start, planning notes and fixed work
location fields used by the task API. These GPS coordinates describe the work
site selected by the company and are not background or continuous tracking.

Os alertas de `Contratempo` não exigem SQL novo: utilizam `meo_tasks.status`
e `meo_tasks.block_reason`, ambos presentes no esquema inicial. O painel da
empresa consulta `/api/operational-alerts` a cada 30 segundos enquanto está
visível e ao regressar ao separador. Se não aparecer um alerta, confirme que
a tarefa foi efetivamente colocada em `Contratempo` com uma razão, que a sessão
é de um gestor da mesma empresa e que as migrações de base necessárias à
criação da tarefa já foram aplicadas. A ausência de migrações de outras
funcionalidades é um problema distinto e deve ser tratada pela ordem indicada
na secção Supabase Setup.

Para retomar uma tarefa com contratempo, um gestor da empresa abre a tarefa e
usa «Resolver e retomar tarefa» com uma explicação concreta. O endpoint
autenticado `POST /api/tasks/:id/resolve-setback` rejeita trabalhadores e outras
empresas; a atualização direta do estado enquanto está bloqueada é rejeitada.
A resolução e o motivo original ficam no audit log já existente, sem migração
adicional. O trabalhador vê a resolução no detalhe e no histórico da tarefa.

Cliente Zero (Fase 1) exige a migração aditiva
`supabase/migrations/20261020170000_merit_work_order_core.sql` antes de
publicar o código novo em Vercel. A migração acrescenta equipa, datas e estado
às ordens existentes sem eliminar dados. Até ser aplicada e validada no projeto
Supabase usado pelo site, não publicar esta versão do servidor em produção:
novas ordens iriam tentar escrever colunas ainda inexistentes. Não executar o
script de reset para obter estas colunas; esse script é destrutivo e destina-se
apenas a uma instalação nova ou reposição deliberada.

## Production Notes

### Notificações importantes no dispositivo (Web Push, opt-in)

Esta extensão Web Push foi pedida expressamente depois do âmbito inicial da
Fase 1. Não é uma app nativa e não faz vigilância em segundo plano. Execute a
migração aditiva `supabase/migrations/20261023180000_important_web_push.sql`
no mesmo projeto Supabase da aplicação. Gere **uma única vez** as chaves VAPID
com `npx web-push generate-vapid-keys --json` e configure
`WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY` e `WEB_PUSH_SUBJECT`
(`mailto:contacto@dominio-da-empresa.pt`) nas variáveis do servidor/Vercel.
Guarde a chave privada apenas no servidor; não a coloque no repositório nem no
frontend. Se rodar as chaves, cada dispositivo terá de voltar a ativar os
avisos. Sem as três variáveis, o botão de ativação fica oculto e os avisos
dentro da aplicação continuam a funcionar.

O utilizador ativa/desativa os avisos por dispositivo no botão com o sino.
No iPhone/iPad, deve primeiro instalar a aplicação no ecrã principal e aceitar
a permissão apresentada pelo iOS. O navegador e o sistema operativo podem
atrasar ou suprimir entregas; o push é complementar, não substitui o registo
de mensagens, horários, decisões ou contratempos na aplicação. O conteúdo
no ecrã bloqueado não inclui nomes, motivos, moradas ou texto de mensagens.

Teste com duas contas e dois dispositivos: confirme que só o destinatário
recebe cada categoria de aviso, que desligar os avisos e terminar sessão
impede novas entregas e que uma falha do serviço push não impede a gravação
da ação principal.

This build is ready for a Phase 1 test environment on a persistent Node host or on a Node host backed by Supabase.

For production:

- Run behind HTTPS.
- Use `APP_STORAGE_DRIVER=supabase` for serverless or production-like deployment.
- Configure Supabase backups.
- Restrict server filesystem access.
- Use strong passwords and remove inactive users quickly.
- Review privacy/labor notices before using real trabalhador data.
- Review the baseline security headers before adding third-party scripts or embedded content. The app currently sets CSP, frame-denial, referrer, permissions and content-type protection headers from the Node server and mirrors them in `vercel.json` for Vercel-served static assets.

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
npm run test:professional
```

`npm run build` runs deploy-time syntax validation. The production app uses the root `server.js` serverless entrypoint and does not require a generated static build directory.

`npm run check` validates JavaScript syntax.

`npm run smoke` creates a temporary local database, exercises public vacancy visibility, company registration, vacancy creation, trabalhador registration, trabalhador CV publishing, application submission, application review, user creation, work order creation, task assignment, GPS-required multi-photo evidence upload, three-photo validation enforcement, task submission, manager approval, scheduled maintenance authorization, employer validation reminders, authenticated image access, and watermarked evidence download.

Manual UI verification should include `/` as the public vacancy feed, `/cliente` as the reserved project login, `/changelog`, public navigation, mobile menu, vacancy filters, login/register forms, the authenticated trabalhador marketplace/CV workspace, the private `Projeto` and `MVP` workspace tabs for client/developer users, `/api/project/private` and `/api/mvp/private` authorization behavior, and authenticated operational workspace routes for company/manager/employee/contractor users.

Manual SEO verification should include `/robots.txt`, `/sitemap.xml`, one open `/vagas/:id` URL, and one missing `/vagas/:id` URL.
