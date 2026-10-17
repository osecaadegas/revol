# Recruitment Upgrade - 2026-10-07

The user's written recruitment brief expands the original Phase 1 scope. The
existing Node/static application, session authentication, operational evidence,
Google login, and private project workspaces are retained.

## Delivered

- Separate worker/company homepage actions, real vacancies, verified-company
  links, functional search filters, and incremental public vacancy display.
- Homepage HTML includes current vacancy content before JavaScript. Public
  company profiles and non-empty location/profession landing pages render on the
  server. Vacancy URLs contain a readable slug; legacy ID URLs still work.
- JobPosting metadata includes actual salary ranges, employment type, deadline,
  and remote-work fields. Closed/expired vacancies remain readable, have no
  JobPosting markup, show closure and related vacancies, and leave the sitemap.
- Workers have separate vacancies, applications, CV, saved jobs/searches,
  messages, and privacy views. Profile publication requires only professional
  title, location, and skills; birth date, references and experience are optional.
- Structured preferences cover availability/date, experience years, languages,
  certifications, schedules, employment types, work modes, salary, transport,
  preferred professions/locations, coordinates and radius.
- Private PDF CV/certificate upload, authenticated attachment downloads and
  deletion. Five documents per worker, six MB each, PDF signature/EOF validation.
  Documents are never static/public storage URLs. Discovery alone does not grant
  document access; a company must own a related application.
- Privacy defaults to application recipients. Private profiles disappear from
  company access; verified-employer discovery is opt-in. Discovery responses
  omit email, phone, birth date, references, documents, and precise coordinates.
- Saved jobs and searches persist across sessions. Optional email alerts use
  Resend through the existing authorized cron endpoint; no email credentials are
  embedded or invented.
- Companies can publish, preview, edit, close and reopen jobs with structured
  salary/schedule/requirements, deadline and screening questions. Screening
  supports yes/no, numeric, choice and short-text answers and server validation.
- Application stages, timestamps, viewed state/history, company summaries and
  measured application/interview/hire counts. Matching compares declared data,
  exposes reasons and factor count, and never rejects an application.
- Verified companies search limited profiles by profession/location/skill,
  availability, experience, certification, language, transport and distance from
  a selected vacancy with coordinates. They can invite a worker to apply.
- Vacancy-linked messages with unread states and interview invitations;
  candidates accept or request another time through the conversation.
- Company registration requires a checksum-valid, globally unique NIF/NIPC;
  trabalhador registration requires the same fiscal identifier validation.
  Company profile includes NIF, industry, size, description, benefits, website
  and optional logo. Verification is manual: pending/verified/rejected/suspended.
  Companies cannot self-verify. Identity changes reset verified status.
- Moderation interface for company verification, reports, user/job suspension,
  aggregate counts and audit history. Privileges use a server-configured account
  ID allowlist, independent of company-managed roles.
- Workers export their account data and delete their account/documents;
  sessions are revoked and application/message records removed. A non-login
  tombstone preserves foreign-key/audit integrity.
- Auth endpoint rate limiting, same-origin mutation checks, image signature
  checks, safe server-error messages and accessible form labels/focus states.
- Supabase writes now submit only changed rows in an atomic, service-role-only
  function, rejecting stale edits rather than overwriting newer records.
  New IDs use UUIDs; existing IDs are preserved. Reads paginate past the REST
  row limit; public requests only load company/vacancy records.
- Fixed service-worker activation navigation that could leave a blank page.

## Migration And Configuration

`supabase/migrations/20261007035242_recruitment_upgrade.sql` is additive. It adds
JSON recruitment fields to existing companies/jobs/applications, extends the
application-stage constraint, creates private messages/reports tables, allows
PDFs in the existing private bucket, and adds `meo_apply_changes`.

Applied to the user-confirmed project `glixqsvhaczajyledulx`. Rolled-back SQL
checks exercised inserts, updates and stale-edit rejection. Anonymous and
Supabase authenticated roles cannot call the write function. The app continues
to authorize its own sessions and uses the service role only on the server.

Environment variables:

- `PLATFORM_ADMIN_USER_IDS`: comma-separated existing account IDs. Configured in
  production for the account explicitly selected by the user.
- `PUBLIC_SITE_URL`: configured to the current production origin.
- `RESEND_API_KEY` and `EMAIL_FROM`: optional, not configured by this change.
  The sender must be verified with Resend. Until then, email alert choices are
  unavailable and searches can be saved without email.

The existing Vercel cron runs daily. Daily/weekly alerts can use it. The
`instant` preference means the next scheduler run, not realtime delivery; a
frequent authorized scheduler is needed before advertising instant alerts.

## Verification

- `npm run check` / `npm run build`: syntax validation of server/frontend files.
- `npm run smoke`: existing registration, jobs, applications, operational task,
  evidence, access, validation, download and cron regression.
- `npm run test:recruitment`: new registration/profile/privacy, verified search,
  screening, application stages, document authorization, saved jobs/searches,
  messaging/interviews, reports, account deletion, CSRF and SEO regression.
- Set `PLAYWRIGHT_MODULE` to an installed Playwright module to include browser
  checks. `PLAYWRIGHT_CHANNEL` defaults to installed Microsoft Edge. Browser
  checks use disposable local data and exercise desktop/mobile views, profile
  preference saving, vacancy editing/preview and runtime-error detection.
- No seed/demo command is run against production. Test fixtures are local or
  database transactions explicitly rolled back.

## Remaining Work And Limits

- This is not a legal GDPR certification. The data controller must supply
  approved privacy/retention notices and confirm handling of audit/report
  records. File signature checks are not antivirus scanning.
- Email credentials and live delivery are outstanding. No email was sent by
  this implementation. Resend idempotency protects retries within its provider
  window, not an unlimited exactly-once guarantee.
- Employer response-time/rate, vacancy view analytics, traffic-to-registration
  conversion and rich analytics are not presented as measured facts. Add
  event instrumentation and sample thresholds before publishing those metrics.
- No AI description button was added because no AI infrastructure exists.
- Messaging refreshes when its workspace tab is opened; it is not a realtime
  socket/push service. Native push remains outside scope.
- Candidate search is paginated at 30 results per page; large-marketplace query
  optimization remains follow-up work.
- Radius filters need coordinates or a known location; they do not claim exact
  distance for unknown free-text places. Matching uses self-declared data and
  reports only the factors that can be compared.
- Browser verification covers Chromium desktop/mobile viewports, not physical
  iPhone/Android devices or Safari. Google OAuth remains dependent on the
  existing production credentials; no interactive Google login was automated.
- Global distributed abuse limits and malware scanning need infrastructure;
  auth throttling currently protects each Node instance. Full CV/company photo
  galleries and detailed funnel analytics are not part of this release.

References: [Google JobPosting guidance](https://developers.google.com/search/docs/appearance/structured-data/job-posting),
[Supabase private access](https://supabase.com/docs/guides/storage/security/access-control),
[Resend email API](https://resend.com/docs/api-reference/emails/send-email).
