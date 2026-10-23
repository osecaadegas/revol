# Requirements Trace

## Indicador de pontualidade (pedido escrito de 23-10-2026)

O pedido do Cliente Zero autoriza este indicador limitado, embora a reputação automática estivesse fora do âmbito original da Fase 1. A pontualidade continua independente do mérito profissional, da remuneração e de decisões disciplinares. `server/punctuality.js` classifica apenas entradas registadas pelo servidor contra um horário publicado da mesma empresa/trabalhador/tarefa ou ordem: até 5 min = 10, até 15 = 8, até 30 = 5, acima = 0. Calcula em segundos, `Europe/Lisbon`, janela móvel de 90 dias, sem turnos futuros, com 20 turnos mínimos para confirmação. Falta de entrada não equivale a atraso. Um turno não pontua duas tarefas. Horários alterados depois de iniciados e horários sem publicação segura ficam pendentes para revisão.

`server/index.js` conserva o snapshot da regra, do horário e da pontuação em `meo_attendance_entries.punctuality`, e o horário inicial em `meo_work_schedules.first_published_start_at`. O perfil do trabalhador mostra média, decomposição, dias, justificações, correções e evolução; a empresa só vê trabalhadores com vínculo confirmado da própria empresa. Justificações pendentes suspendem a pontuação do dia; aprovações excluem-no; recusas exigem razão e só repõem pontos com entrada fiável. Correções horárias e mudanças de regra deixam histórico de auditoria. A migração é `supabase/migrations/20261023142142_punctuality_rating.sql`; ver ativação segura em `docs/SETUP.md`.

Limitação intencional: a entrada existente usa hora do servidor, mas não constitui prova GPS/câmara de presença física. Não há vigilância contínua. O indicador fica desligado por omissão em Supabase até revisão jurídica/privacidade, migração e ativação explícita. O cálculo não decide salários, sanções ou despedimentos.

## Source Documents Read

- `Contrato.pdf`
- `Orcamento_Fase_1_Webapp_Testes.pdf`
- `Manual de Engenharia Bloco I.pdf`
- `Manual de Engenharia Bloco II.pdf`
- `Manual de Engenharia Bloco III.pdf`
- `Manual de Engenharia Bloco IV.pdf`
- `Manual de Engenharia Bloco V.pdf`
- `MANIFESTO 2.0 REVOLUÇÃO 24-07-2026.pdf`

## Current Product Concept

The 2026-10-07 recruitment brief supersedes earlier public marketplace UX and
profile-sharing requirements. See `docs/RECRUITMENT_UPGRADE.md` for coverage.
Published worker profiles are no longer automatically visible to every company:
discovery requires worker opt-in and a verified company, contact/document access
requires an application relationship, and private visibility revokes that access.
Birth date, references and work experience are optional, including first-job
candidates. Admin permissions are independent of company roles.

The public product surface now behaves first like a LinkedIn-style vacancy marketplace. Project status, roadmap, MVP scope, future evolution, requirement traceability, modules, deliverables, feedback, changelog and documentation structure are private workspace information for authenticated client/developer users only.

The existing labor-market and operational evidence workflows remain preserved as MVP modules inside the platform.

Private project information is now restricted to first-class `client` and `developer` accounts. Marketplace and operational roles remain separate.

## Marketplace And Operational Concept

The app must first behave like a public labor-market board:

- Job offers/vacancies are always visible to visitors.
- Applying to a vacancy requires a registered trabalhador account. Internally this remains role `worker`.
- Creating a vacancy requires a registered `company` account.
- Company users can review trabalhador applications.
- The operational work-order/evidence module remains available as a company workspace feature, but it is not the first public concept.

## Implemented Marketplace Requirements

| Requirement | Implementation |
| --- | --- |
| Public vacancies visible without login | `/api/jobs/public`, public homepage board in `public/app.js` |
| Public vacancy discovery works like a labor-market board | Shared marketplace filters in `public/app.js` for keyword/company/contract, cargo/function and location dropdown suggestions, free-text entries, and known-city radius |
| Public homepage is simple and organized | `/` renders a search-first public vacancy page with concise market summary, featured vacancies, candidate/company calls to action and a visible topbar `Login / Registar` modal trigger before any private project entry |
| Public brand is professional and simple | Public marketplace uses `TrataPro`, slogan `Trabalho certo. Prova feita.`, visible `logo.svg` wordmark, `TP` SVG icon, updated PWA icon and server-generated SEO site names |
| Trabalhador registration required to apply | `/api/register/worker`, `/api/job-offers/:id/apply` requires internal role `worker` |
| Company registration required to create vacancies | `/api/register/company`, `/api/job-offers` requires `company` or legacy `manager` |
| Unique fiscal identity for public accounts | Trabalhador NIF and company NIF/NIPC are required at registration, checksum-validated and unique across both account types; identifiers remain outside public profiles and CV exports |
| Company can manage received applications | `/api/applications/:id`, company marketplace view |
| Trabalhador can track submitted applications | `jobApplications` in `/api/bootstrap`, reorganized trabalhador marketplace workspace in `public/app.js` |
| Trabalhador CV profile required for applications | Sectioned trabalhador marketplace CV form in `public/app.js`, `PATCH /api/workers/profile`, and server-side application gate before `/api/job-offers/:id/apply` |
| Published trabalhador CVs visible to companies | Company marketplace receives `workerProfiles`, application cards include published trabalhador CV details, and profile photos are served by authenticated `/api/workers/:id/profile-photo` |
| Supabase-ready marketplace persistence | `meo_job_offers`, `meo_job_applications`, `profile` and company metadata migrations |
| SEO-ready public vacancy discovery | `/robots.txt`, `/sitemap.xml`, dynamic homepage metadata, branded social preview metadata, noindex reserved routes, noindex static 404s, and server-rendered `/vagas/:id` detail pages with JobPosting JSON-LD for open vacancies |

## Implemented MANIFESTO Portal Requirements

| Requirement | Implementation |
| --- | --- |
| Public client access only | `/cliente` exposes reserved login controls without project details or trabalhador/company registration tabs, is marked `noindex,follow`, and is excluded from `/sitemap.xml` |
| Private project dashboard | Authenticated `Projeto` workspace tab for `client` and `developer` users; content is served by `/api/project/private` |
| Private data not in public bundle | Detailed project copy is generated server-side in `server/private-project.js`, not embedded in `public/app.js` |
| Main public navigation | Unauthenticated visitors see `Vagas` and `Area do Cliente`; project, MVP, roadmap and documentation links stay private |
| Project status dashboard | Data-driven `projectPhases` and `renderProjectStatusSection()` |
| Roadmap | Data-driven `roadmapSteps` and responsive `renderRoadmapSection()` |
| MVP development cockpit | Private `MVP` workspace tab for `client` and `developer` users loads server-rendered `/api/mvp/private` readiness from marketplace, accounts, tasks, evidence and audit data |
| MVP scope separation | `mvpScope` with included and out-of-scope sections |
| MVP versus future platform | `platformComparison` section |
| Module architecture | Data-driven `modules` cards with status, progress and requirement IDs |
| Engineering documentation foundation | Manual block cards and traceability model without exposing private PDFs |
| Requirement traceability | `requirements` data model rendered as responsive table |
| Acceptance criteria | `acceptanceCriteria` data model with status labels |
| Deliverables | `deliverables` grouped into completed, in development and pending |
| Private versioning/changelog | `productVersion` and `versionHistory` render inside the authenticated project workspace |
| Documentation center | Document groups with public/private visibility notes |
| Client area | `/cliente` public access gate, with private dashboard after authentication |
| First-class project roles | `client` and `developer` role values in API validation, UI labels, invites, user creation, Supabase migration and reset SQL |
| Change requests and feedback foundations | Empty-state structures for future formal request and feedback tracking |

## Operational Phase 1 Requirements

| Requirement | Implementation |
| --- | --- |
| Mobile-first webapp accessible from phone, tablet, and computer | `public/index.html`, `public/styles.css`, responsive app shell, and a contextual PWA installation action for Android/iOS without a separate native app |
| Frontend separated from backend/API | Static frontend in `public/`, REST API in `server/index.js` |
| Public SEO shell | Server-generated canonical/social metadata, robots, sitemap, noindex reserved-route handling and public vacancy detail pages in `server/index.js`; SPA remains in `public/app.js` |
| Authentication | `/api/setup`, `/api/auth/login`, `/api/auth/google/start`, `/api/auth/google/callback`, `/api/session`, bearer sessions and same-origin session cookie |
| Role separation | Public `Trabalhador` accounts use internal role `worker` to apply to jobs; `company/manager` manage marketplace and operations; `employee/contractor` execute tasks; `client/developer` view private project/MVP information |
| Three profiles: manager, employee, contractor | Server roles `manager`, `employee`, `contractor`; role UI and API checks |
| Manager manages users | Direct user creation, activation toggle, invite links |
| Secure invite associated to company and role | `/api/invites`, token-bound company/role acceptance |
| Work orders with address/location text, description, optional initial photos | `/api/work-orders`, UI work order form, private evidence records |
| Cliente Zero: multi-person work-order planning | Existing work orders now include assigned employee/contractor/verified-worker IDs, expected dates and an independent simple status; only managers can change the order state, and the assigned team can see it before any task exists |
| Cliente Zero: order completion and accountability | Start/completion timestamps and mandatory reasons for blocked/rejected states are retained in the order and audit history; tasks remain optional sub-units |
| Task creation with assignee and deadline | `/api/tasks`, manager task form; recruited workers require a verified relationship with the assigning company |
| Worker planning and task access | Conditional `Tarefas` worker navigation; scheduled start, planning notes, fixed work address/GPS and relationship-bound authorization |
| Recruitment correspondence | Existing application and interview messages, relabelled `Correspondência` without changing their recruitment context or stored history |
| Direct worker/company conversations | `Conversas` UI plus `/api/direct-chat`; a verified relationship is required and each conversation is restricted to the worker and one explicitly selected company member |
| Direct-message persistence and audit | `meo_direct_conversations`, `meo_direct_messages`, unread/read timestamps, rate limiting and company-scoped audit events |
| Operational states | `planned`, `assigned`, `in_progress`, `blocked`, `pending_validation`, `approved`, `rejected` |
| Operational setback | The worker-facing `Contratempo` action requires a reason; the internal compatible `blocked` status creates a high-priority, company-only alert identifying the worker, work order, task and reason. Only a company manager can resolve an active setback, with a required factual resolution. The original reason, resolution, author and date remain in the audit trail and are visible to the assigned worker. Direct status changes cannot bypass resolution; the company alert clears when resolved, and the worker sees a contextual in-app notice with direct task access until opening that resolution. |
| Photo evidence | `/api/tasks/:id/evidence`, stored privately in local uploads or Supabase Storage; final task validation requires at least three GPS-authenticated photos |
| Timestamp and user recording | Audit log plus evidence/task metadata, capture/upload timestamps, SHA-256 file hash and authenticity checks |
| Point-in-time location request with user permission | Browser geolocation button; final task evidence requires granted GPS and records coordinates, accuracy and GPS timestamp |
| No continuous location tracking | No background watcher or repeated location polling exists |
| Manager approval/rejection | `/api/tasks/:id/decision`; rejection requires reason; pending validation tasks receive a 12-hour validation deadline, manager reminder cards, reminder audit entries, and auto-approval after expiry |
| Basic task history | `auditLogs` collection and History UI |
| Basic search and filtering | Frontend filters by text, status, assignee |
| Simple dashboard | Dashboard cards and operations list |
| Iterative MVP status | Private `MVP` tab shows live module readiness, pending validation and recent audit events from authenticated server HTML |
| Private photo access | `/api/evidence/:id/file` checks authenticated access before reading local/Supabase private storage; `/api/evidence/:id/download` provides an audited watermarked download while the seven-day retention window is active; `/api/cron/operational-maintenance` deletes expired evidence from app storage |
| Production build/startup without critical error | `npm run check` and `npm run smoke` |

## Digital CV And Verified Employment Change Request

| Requirement | Implementation |
| --- | --- |
| Stable worker profile and professional multi-step CV | Deterministic worker CV profile ID plus four-step editor in `public/professional-profile-ui.js` |
| Upload PDF/DOCX without silent overwrite | Private `meo_cv_documents`; DOCX suggestions require explicit review and a later save; PDF is manual review |
| Preview, versioning and PDF export | `meo_cv_versions`, in-workspace preview and authenticated `/api/professional/cv.pdf` |
| Secure private documents | Authenticated `/api/professional/documents/:id/file`, private local/Supabase storage, hashes and access logs |
| Verified employment history | `meo_employment_relationships` with worker/company confirmations and verified chronological CV display |
| Employer eligibility | Verified company plus verified own employment relationship; company-created relationships require accepted/hired application evidence |
| Structured professional evaluation | 25 standard observable-behaviour questions in seven categories, accessible visual integer 0-10 rating controls with no preselection, optional work-related comments, standard-only category averages and an explicit draft no-data state |
| Company-specific questions and historical integrity | Company question catalogue plus immutable question/scoring snapshots in each assessment; later edits or archiving cannot alter submitted history |
| Drafts and immutable dates | Private company drafts, automatic Portugal-local evaluation date and one record per company/worker/relationship/day; submitted ratings cannot be edited or superseded |
| Separate facts and opinion | Employment and evaluation tables/routes/UI remain separate; evaluations never enter CV/PDF/public discovery |
| Worker response and data rights | `meo_worker_disputes` correction/context/dispute/restriction/deletion/access workflow with company response |
| Access and sharing history | `meo_report_access_logs`, access-request history and existing audit actions |
| Retention and review expiry | Configured report review/retention dates, cron expiry and end-of-retention redaction with `meo_data_retention_actions` |
| Cross-company privacy gate | Report disclosure remains unavailable pending independent DPIA validation; the company request form is hidden from normal navigation while sharing is disabled, while protected records and worker data-rights visibility remain available |
| Database authorization | RLS on every new table; `anon`/`authenticated` grants revoked; server service role only, followed by custom-session row authorization in the API |

See `docs/DIGITAL_CV_EMPLOYMENT.md` for boundaries and production prerequisites.

## Persistence

The server supports `APP_STORAGE_DRIVER=local` for development and `APP_STORAGE_DRIVER=supabase` for real deployment. The Supabase mode uses relational tables prefixed with `meo_`, including marketplace vacancies and applications, RLS enabled on all app tables, and a private storage bucket for evidence files. Evidence records now include retention expiry and are deleted from app storage after seven days by authenticated maintenance or the protected scheduled maintenance endpoint.

Dirty Supabase projects with old prototype tables must be reset through `supabase/admin/reset_to_current_schema.sql`. The reset removes old unprefixed public tables and recreates the current `meo_*` model.

## Explicit Non-Goals For Phase 1

These are documented in the source PDFs as excluded or future-phase concepts and are intentionally not implemented:

- Native Android/iOS apps and app store publishing.
- Full offline operation and advanced synchronization.
- Native push notifications (Web Push opt-in para eventos importantes é uma
  extensão posteriormente solicitada; não implica app nativa).
- Continuous/background location tracking.
- AI photo analysis.
- Tiers, integrity scores, reputation, professional passports, automated disputes.
- Blockchain, advanced hashes, decentralized infrastructure, distributed consensus.
- Billing, payroll, accounting, payments, credit, insurance, arbitration.
- External software integrations.
- Commercial multi-company SaaS marketplace/subscription operation.
- Advanced dashboards, complex metrics, and complete data export/audit tooling.
- Legal, labor, fiscal, or complete GDPR consulting documents.

## Acceptance Flow

### 2026-10-20 change request: unified planning and attendance

- Order form can create a planned order and one private task per selected member
  in one request. Server validates team membership or verified worker
  employment, task dates and optional fixed worksite coordinates.
- An active, verified worker opens on a private Profile with company-specific
  evaluations, assigned tasks and factual clock-in/out actions. The server
  authenticates every punch and rejects other roles, manipulated task IDs,
  duplicate open shifts and mismatched clock-outs.
- Absence justifications require a verified relationship and a valid date;
  PDF/PNG/JPEG attachments use private storage and authorised download routes.
  Managers see only their company's records. Access and changes are audited.
- Production acceptance is conditional on migration
  `20261020180000_work_attendance_and_justifications.sql` in the actual
  TrataPro database. Without it the new actions fail closed but recruitment,
  orders and existing tasks remain available.
- Precise worker GPS attendance verification is explicitly not delivered.
  Fixed worksite coordinates are planning data only. This requires a separate
  lawful-basis/DPIA review, accuracy and dispute rules before implementation.

### 2026-10-23 change request: weekly worker schedule and day-off approval

- Managers can publish one start time, work address and optional note per worker/day in a weekly grid. Only verified active employment for that date is accepted server-side.
- A worker sees only their own forthcoming schedule and leave requests. A request remains pending until the originating company approves or rejects it; another company and the worker cannot decide it.
- A request must reach the server at least 24 hours before the beginning of the requested day in `Europe/Lisbon`; duplicates are rejected. Approval removes a conflicting daily schedule and prevents re-scheduling that approved day.
- Schedule changes, requests and decisions are audited. Existing task assignments, clock entries and absence justifications remain separate and unchanged.

1. Manager creates or invites an authorized user.
2. Manager creates a work order with team and expected dates; assigned people can see it without a separate task.
3. Manager creates an optional task with responsible user, planned start, work location, notes and deadline; an external worker must have a verified relationship with that company.
4. Responsible user logs in and sees only assigned tasks.
5. Responsible user starts task.
6. The responsible user can communicate a setback only with a reason; company administrators receive a contextual operational alert.
7. Responsible user uploads at least three final photo evidence files with granted point-in-time GPS.
8. Responsible user submits task for validation; the employer receives a 12-hour validation window and sees validation reminders in the manager dashboard.
9. Manager/company approves or rejects before the validation deadline; pending tasks auto-approve after the deadline.
10. Rejection requires reason.
11. The history shows the main actions.
12. Evidence images are not publicly accessible.
13. Authorized parties can download retained evidence with a watermark for seven days.
14. Scheduled maintenance can delete expired evidence and create validation reminder audit entries through `/api/cron/operational-maintenance`.
