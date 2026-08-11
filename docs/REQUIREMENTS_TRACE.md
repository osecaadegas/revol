# Requirements Trace

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

The public product surface now behaves first like a LinkedIn-style vacancy marketplace. Project status, roadmap, MVP scope, future evolution, requirement traceability, modules, deliverables, feedback, changelog and documentation structure are private workspace information for authenticated client/developer users only.

The existing labor-market and operational evidence workflows remain preserved as MVP modules inside the platform.

Private project information is now restricted to first-class `client` and `developer` accounts. Marketplace and operational roles remain separate.

## Marketplace And Operational Concept

The app must first behave like a public labor-market board:

- Job offers/vacancies are always visible to visitors.
- Applying to a vacancy requires a registered `worker` account.
- Creating a vacancy requires a registered `company` account.
- Company users can review worker applications.
- The operational work-order/evidence module remains available as a company workspace feature, but it is not the first public concept.

## Implemented Marketplace Requirements

| Requirement | Implementation |
| --- | --- |
| Public vacancies visible without login | `/api/jobs/public`, public homepage board in `public/app.js` |
| Public vacancy discovery works like a labor-market board | Shared marketplace filters in `public/app.js` for keyword/company/contract, cargo/function, location, and known-city radius |
| Public homepage feels like a job network | `/` renders a modern LinkedIn-like landing with compact top search, expanded desktop filters, candidate/company entry cards, market metrics, subtle live motion, vacancy feed, quick filters, polished job cards and account actions before any private project entry |
| Worker registration required to apply | `/api/register/worker`, `/api/job-offers/:id/apply` requires `worker` |
| Company registration required to create vacancies | `/api/register/company`, `/api/job-offers` requires `company` or legacy `manager` |
| Company can manage received applications | `/api/applications/:id`, company marketplace view |
| Worker can track submitted applications | `jobApplications` in `/api/bootstrap`, worker marketplace view |
| Supabase-ready marketplace persistence | `meo_job_offers`, `meo_job_applications`, `profile` and company metadata migrations |

## Implemented MANIFESTO Portal Requirements

| Requirement | Implementation |
| --- | --- |
| Public client access only | `/cliente` exposes reserved login controls without project details or worker/company registration tabs |
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
| Mobile-first webapp accessible from phone, tablet, and computer | `public/index.html`, `public/styles.css`, responsive app shell |
| Frontend separated from backend/API | Static frontend in `public/`, REST API in `server/index.js` |
| Authentication | `/api/setup`, `/api/auth/login`, `/api/auth/google/start`, `/api/auth/google/callback`, `/api/session`, bearer sessions and same-origin session cookie |
| Role separation | `worker` applies to jobs; `company/manager` manage marketplace and operations; `employee/contractor` execute tasks; `client/developer` view private project/MVP information |
| Three profiles: manager, employee, contractor | Server roles `manager`, `employee`, `contractor`; role UI and API checks |
| Manager manages users | Direct user creation, activation toggle, invite links |
| Secure invite associated to company and role | `/api/invites`, token-bound company/role acceptance |
| Work orders with address/location text, description, optional initial photos | `/api/work-orders`, UI work order form, private evidence records |
| Task creation with assignee and deadline | `/api/tasks`, manager task form |
| Operational states | `planned`, `assigned`, `in_progress`, `blocked`, `pending_validation`, `approved`, `rejected` |
| Block justification | Status change to `blocked` requires reason |
| Photo evidence | `/api/tasks/:id/evidence`, stored privately in local uploads or Supabase Storage |
| Timestamp and user recording | Audit log plus evidence/task metadata |
| Point-in-time location request with user permission | Browser geolocation button; records granted/denied/unavailable status |
| No continuous location tracking | No background watcher or repeated location polling exists |
| Manager approval/rejection | `/api/tasks/:id/decision`; rejection requires reason |
| Basic task history | `auditLogs` collection and History UI |
| Basic search and filtering | Frontend filters by text, status, assignee |
| Simple dashboard | Dashboard cards and operations list |
| Iterative MVP status | Private `MVP` tab shows live module readiness, pending validation and recent audit events from authenticated server HTML |
| Private photo access | `/api/evidence/:id/file` checks authenticated access before reading local/Supabase private storage |
| Production build/startup without critical error | `npm run check` and `npm run smoke` |

## Persistence

The server supports `APP_STORAGE_DRIVER=local` for development and `APP_STORAGE_DRIVER=supabase` for real deployment. The Supabase mode uses relational tables prefixed with `meo_`, including marketplace vacancies and applications, RLS enabled on all app tables, and a private storage bucket for evidence files.

Dirty Supabase projects with old prototype tables must be reset through `supabase/admin/reset_to_current_schema.sql`. The reset removes old unprefixed public tables and recreates the current `meo_*` model.

## Explicit Non-Goals For Phase 1

These are documented in the source PDFs as excluded or future-phase concepts and are intentionally not implemented:

- Native Android/iOS apps and app store publishing.
- Full offline operation and advanced synchronization.
- Native push notifications.
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

1. Manager creates or invites an authorized user.
2. Manager creates a work order.
3. Manager creates a task with responsible user and deadline.
4. Responsible user logs in and sees only assigned tasks.
5. Responsible user starts task.
6. Responsible user can block task only with justification.
7. Responsible user uploads photo evidence and optional point-in-time location.
8. Responsible user submits task for validation.
9. Manager approves or rejects.
10. Rejection requires reason.
11. The history shows the main actions.
12. Evidence images are not publicly accessible.
