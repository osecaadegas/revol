# Digital CV And Verified Employment - 2026-10-13

This written change request extends the recruitment product beyond the original
Phase 1 operational-evidence scope. It is implemented inside the existing Node,
vanilla JavaScript, local JSON and Supabase architecture.

## Delivered

- One deterministic, stable CV profile ID per worker account.
- A responsive four-step CV editor covering personal/contact details, skills,
  qualifications, certifications, education, declared work history, languages,
  licences, locations, job preferences and shift availability.
- Immutable CV version snapshots on every explicit save, plus preview and
  server-generated PDF export.
- Private PDF and DOCX uploads. DOCX text can produce review-only field
  suggestions; PDF remains a private manual-review source. Imported data never
  changes the worker profile until the worker applies, reviews and saves it.
- Private file reads through authenticated API routes only. CV documents use
  the existing private `meo-evidence` bucket in Supabase and private
  `data/uploads` paths locally.
- Separate employment relationship records with worker/company confirmation,
  factual dates and status, and chronological verified-history rendering.
- Verified-employer evaluation reports with five structured criteria, optional
  evidence context, factual night/weekend/overtime experience, attributable
  authors, review expiry and retention dates.
- A strict separation between employment facts and subjective reports.
  Confidential evaluations never enter profile discovery, public routes, CV
  previews or PDF exports.
- Worker correction, context, dispute, restriction, deletion and access-request
  workflows. Company responses remain attributable and do not erase the
  original request.
- Dedicated report/document access logs and the existing application audit log
  for views, submissions, changes and deletions.
- Retention maintenance through the existing authenticated cron route. Review
  expiry marks reports as expired; end-of-retention redacts criteria and free
  text while keeping a minimal retention event.
- Company workspaces for employment confirmation, structured evaluations,
  worker requests and documented access requests.

## Authorization Boundary

The application still uses its established server-side session system rather
than Supabase Auth. The new public-schema tables therefore enable RLS, revoke
all `anon` and `authenticated` privileges, and grant access only to the
server-held `service_role`. The Node API then applies worker ownership,
originating-company, verified-company, confirmed-employment and hired-
application checks before returning or modifying a row. The service key must
remain server-only.

Only verified companies can confirm employment, submit evaluations or record a
cross-company access request. A company-created employment link additionally
requires an accepted/hired application. An evaluation requires a fully verified
employment relationship owned by that company.

## Cross-Company Sharing Safety Gate

Cross-company report visibility is deliberately unavailable. A verified
company may record a request with a concrete purpose and declared lawful basis,
but its state is `pending_dpia` and no API route converts that request into
report access. Workers may reject a request. Enabling sharing requires a later
written change after an independently reviewed GDPR DPIA, lawful-basis design,
role/access review, privacy notices and production authorization tests.

Worker consent is not represented as a universal lawful basis. The request
record supports `legitimate_interest`, `legal_obligation` and
`pre_contract_steps` as declarations for review, not as a legal determination.

## Evaluation Guardrails

There is no personality profile, blacklist, cross-company score, aggregate
reputation score, automated rejection or automatic applicant ranking. Free-text
evaluation context rejects common protected-characteristic, protected-absence,
optional-overtime-refusal and contractual-hours language. This input check is a
defence-in-depth control, not a substitute for employer training and moderation.

## Migration And Configuration

Apply `supabase/migrations/20261013070041_digital_cv_employment_history.sql`
after `20261007035242_recruitment_upgrade.sql`. It creates:

- `meo_cv_profiles`, `meo_cv_versions`, `meo_cv_documents`
- `meo_company_verifications`, `meo_company_memberships`
- `meo_employment_relationships`
- `meo_employer_evaluation_reports`, `meo_evaluation_criteria`
- `meo_company_access_grants`, `meo_worker_disputes`
- `meo_report_access_logs`, `meo_data_retention_actions`

Optional configuration with production defaults:

```text
MAX_CV_UPLOAD_MB=8
EVALUATION_REVIEW_MONTHS=12
EMPLOYMENT_DATA_RETENTION_YEARS=6
ACCESS_REQUEST_DAYS=30
```

The migration increases the existing private bucket limit to 8 MB and allows
PDF and DOCX in addition to the existing evidence/profile image types.

## Verification

Run:

```text
npm run check
npm run test:professional
npm run test:recruitment
npm run smoke
```

`test:professional` covers CV versions, review-only DOCX extraction, private
downloads, PDF exclusion of evaluations, company verification, bilateral
employment confirmation, evaluation ownership, cross-company denial, protected
context rejection, disputes, access logs and the DPIA sharing gate.

## Remaining Production Work

- Apply the migration to the target Supabase project and run database advisors.
- Run Supabase database tests/advisors against a linked non-production project;
  the local repository has no linked Supabase environment.
- Complete an independent GDPR DPIA and employment-law/privacy review before
  considering any cross-company report access.
- Establish controller/processor responsibilities, privacy notices, moderation,
  fraud investigation and data-subject request operating procedures.
- Decide and document production retention periods with counsel rather than
  accepting defaults without review.
- Perform browser-assisted accessibility and mobile regression checks with the
  production-like identity and storage configuration.
