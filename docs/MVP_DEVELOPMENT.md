# MVP Development

## Purpose

This document is the working guide for the active phase named `Desenvolvimento do MVP`.

The goal of this phase is to make the Phase 1 product testable as one connected loop:

1. Public visitors can discover open vacancies.
2. Trabalhadores can register and apply.
3. Companies can register, publish vacancies and review applications.
4. Company/manager users can create operational accounts.
5. Company/manager users can create work orders and assigned tasks.
6. Responsible users can update task states and submit at least three private GPS-authenticated photo evidence files.
7. Managers can approve or reject submitted tasks within the 12-hour validation window.
8. Managers receive dashboard reminders for pending validation tasks.
9. The company can review the audit history.

## Current Build Surface

The authenticated workspace includes an `MVP` tab for `client` and `developer` users. It is private and not rendered for public visitors, trabalhadores, companies, managers, employees or contractors.

The tab loads server-rendered private HTML from `GET /api/mvp/private`. That endpoint requires `client` or `developer` access and calculates its status from company data:

| Area | Data source | Ready condition |
| --- | --- | --- |
| Mercado publico | `jobOffers` | At least one open vacancy exists |
| Contas e permissoes | `users` | At least one employee or contractor exists for operational task assignment |
| Ordens e tarefas | `workOrders`, `tasks` | At least one work order and one task exist |
| Evidencias | `evidences` | At least one private evidence file exists |
| Auditoria | `auditLogs` | At least five audit events exist |

These checks are not contractual completion percentages. They are workspace readiness signals for iterative testing.

## Implementation Map

| Capability | Frontend | API |
| --- | --- | --- |
| Public vacancies and filters | `public/app.js` marketplace/public board renderers | `GET /api/jobs/public` |
| Trabalhador registration and applications | `register-worker`, `apply-job` forms | `POST /api/register/worker`, `POST /api/job-offers/:id/apply` |
| Company registration and vacancies | `register-company`, `create-job` forms | `POST /api/register/company`, `POST /api/job-offers`, `PATCH /api/job-offers/:id` |
| Operational accounts | `team` view | `POST /api/users`, `PATCH /api/users/:id`, `POST /api/invites` |
| Work orders and tasks | `orders`, `tasks` views | `POST /api/work-orders`, `POST /api/tasks`, `PATCH /api/tasks/:id/status` |
| Evidence and validation | task drawer | `POST /api/tasks/:id/evidence`, `PATCH /api/tasks/:id/status`, `POST /api/tasks/:id/decision`, `GET /api/evidence/:id/file`, `GET /api/evidence/:id/download` |
| Scheduled maintenance | manager dashboard reminders | `GET|POST /api/cron/operational-maintenance` |
| Audit | `history` view and MVP audit panel | `auditLogs` in `GET /api/bootstrap`, `GET /api/export/basic` |
| MVP cockpit | `MVP` tab loading shell | `GET /api/mvp/private` |

## Iteration Order

Use this order when testing or extending the MVP:

1. Create or confirm a company/manager account.
2. Create or invite at least one `client` or `developer` account from `Equipa`.
3. Publish one open vacancy from the company `Vagas` tab.
4. Create or invite one employee/contractor from `Equipa`.
5. Create one work order and one task from `Ordens` / `Tarefas`.
6. Log in as the assigned responsible user, open the task, start it, authorize GPS, upload at least three final photos and submit for validation.
7. Log back in as manager/company, approve or reject the task before the 12-hour deadline.
8. Verify the manager dashboard shows pending validation reminders until a decision is recorded.
9. Log in as client/developer and verify the private `MVP` cockpit reflects the flow.
10. Confirm the action appears in `Historico`.
11. Run `npm run smoke` after API or workflow changes.

## Guardrails For Future Agents

- Keep this phase private to `client` and `developer`.
- Do not expose project documents, requirement details, private MVP cockpit copy or private evidence in public JavaScript.
- Do not add future-phase features such as payments, AI image analysis, native apps, blockchain, scoring or advanced offline sync without written approval.
- Keep server-side role checks in place for every write operation.
- Update this file, `docs/PROGRESSIVE_BUILD_PLAN.md`, `docs/REQUIREMENTS_TRACE.md` and `docs/CHANGELOG.md` when the MVP workflow changes.

## Acceptance Criteria

- Public vacancies remain visible without login.
- Applying requires a trabalhador account.
- Publishing vacancies requires company/manager access.
- Creating operational users, work orders and tasks requires company/manager access.
- Evidence files remain private and load only through authenticated API access.
- Submitting a task for validation requires at least three non-expired GPS-authenticated task evidence photos.
- Retained evidence can be downloaded with a watermark for seven days.
- Pending validation tasks auto-approve after the 12-hour employer validation window expires.
- Manager users see validation reminder cards and audit entries for tasks awaiting approval.
- Rejecting a task requires a reason.
- Main actions create audit entries.
- The private `MVP` tab shows live readiness signals and routes users to the correct existing workflows.
- `GET /api/mvp/private` returns `401` without authentication.
