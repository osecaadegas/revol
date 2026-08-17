# API Contract

Authenticated JSON calls can use:

```text
Authorization: Bearer <session-token>
Content-Type: application/json
```

Login, Google callback, setup, and invite acceptance also set an HttpOnly same-origin `meo_session` cookie. The cookie is required for browser-native requests that cannot attach bearer headers, such as evidence image previews, worker profile photos, watermarked evidence downloads, and opening the basic JSON export in a new tab.

## Public Endpoints

`GET /api/health`

Returns server status and the active storage driver.

`GET|POST /api/cron/operational-maintenance`

Protected scheduled maintenance endpoint. Requires `Authorization: Bearer <CRON_SECRET>`. Deletes expired seven-day evidence files, auto-approves tasks past the 12-hour validation deadline, and writes employer validation reminder audit entries for submitted and near-due pending tasks. Intended for Vercel Cron or an external scheduler.

`GET /api/setup/status`

Returns whether the app has at least one active user.

`POST /api/setup`

Creates the first company and manager. Only allowed before initialization.

`POST /api/auth/login`

Body: `email`, `password`.

`GET /api/auth/google/start`

Starts Google OAuth. Query params: `intent=login|worker` and optional same-origin `next` path. `intent=login` signs in an existing active account by matching the verified Google email. `intent=worker` may create a new `worker` account when no matching user exists.

`GET /api/auth/google/callback`

Handles the Google authorization-code callback, creates the normal app session cookie, links Google identity metadata into `user.profile.authProviders.google`, and redirects back to the `next` path with `auth=google` or `auth_error=<code>`.

`GET /api/jobs/public`

Returns open vacancies visible without authentication. The frontend applies keyword, cargo/function, location, and radius filters client-side.

`POST /api/register/worker`

Creates a worker account and session with an unpublished CV draft. Workers must publish the CV before applying to vacancies.

`POST /api/register/company`

Creates a company profile, company user, and session. Companies can publish vacancies.

`GET /api/invites/:token`

Returns invite metadata for an unused invite.

`POST /api/invites/:token/accept`

Creates a user from an invite.

## Authenticated Endpoints

`GET /api/session`

Returns current user.

`POST /api/auth/logout`

Expires the current token.

`GET /api/bootstrap`

Returns current user, company, accessible users, work orders, tasks, evidence metadata, audit log, manager invite list, validation alerts, vacancies, relevant applications, and published worker CV profiles for company/manager review.

For `client` and `developer` accounts, operational records are not exposed directly through this payload. Their private project progress view is delivered through `GET /api/project/private` and `GET /api/mvp/private`.

`GET /api/project/private`

Client/developer only. Returns the private MANIFESTO project dashboard HTML. Project status, roadmap, requirements, acceptance criteria, deliverables, documentation structure, feedback and changelog are served here instead of being embedded in the public static JavaScript bundle.

`GET /api/mvp/private`

Client/developer only. Returns the private MVP development cockpit HTML. Live marketplace, account, task, evidence and audit readiness is calculated server-side from company data instead of being embedded in the public static JavaScript bundle.

`PATCH /api/workers/profile`

Worker only. Saves and publishes the worker CV profile. Required fields before publishing are professional title, location, birth date, at least one skill, at least one previous experience entry, and at least one reference. Optional profile photo is stored in private local/Supabase storage and served through the authenticated photo endpoint.

`GET /api/workers/:id/profile-photo`

Returns a worker profile photo only to the owning worker or to authenticated company/manager users when that worker CV is published.

`POST /api/job-offers`

Company/manager only. Creates a public vacancy. Important fields: `title`, `position`, `location`, `contractType`, `salary`, `schedule`, `description`, and `requirements`.

`PATCH /api/job-offers/:id`

Company/manager only. Updates `title`, `position`, `location`, `contractType`, `salary`, `schedule`, `description`, `requirements`, or closes/reopens a company vacancy through `status`.

`POST /api/job-offers/:id/apply`

Worker only. Submits one application to an open vacancy. The server requires the worker CV profile to be published before accepting the application.

`PATCH /api/applications/:id`

Company/manager only. Updates application review status.

`POST /api/users`

Company/manager only. Creates an active managed user. Allowed managed roles are `manager`, `employee`, `contractor`, `client`, and `developer`.

`PATCH /api/users/:id`

Company/manager only. Updates active status or managed role.

`POST /api/invites`

Company/manager only. Creates an invite token bound to the current company and selected managed role.

`POST /api/work-orders`

Manager only. Creates a work order with optional initial photos.

`POST /api/tasks`

Manager only. Creates an assigned task with deadline.

`PATCH /api/tasks/:id/status`

Manager or assigned responsible. Supports operational state changes. Blocking requires `blockReason`. Submitting for validation requires at least three non-expired task evidence photos with accepted authenticity metadata and granted GPS. When submitted, the server stamps `completedAt` and `validationDueAt` twelve hours later. Pending tasks past `validationDueAt` are auto-approved on the next authenticated maintenance pass.

`POST /api/tasks/:id/evidence`

Manager or assigned responsible. Uploads one or more task evidence images with optional note. Final task evidence requires browser-granted point-in-time GPS. The server records capture/upload time metadata, GPS, SHA-256 file hash, authenticity checks, seven-day expiry, and private storage location.

`POST /api/tasks/:id/decision`

Manager only. Approves or rejects a task pending validation before the twelve-hour validation deadline. Rejection requires reason.

`GET /api/evidence/:id/file`

Returns the original image file only when the current user can access the related task or work order and the seven-day retention window has not expired. The file is read from local private storage or Supabase private Storage depending on `APP_STORAGE_DRIVER`.

`GET /api/evidence/:id/download`

Returns an authenticated watermarked SVG download that embeds the retained original image plus visible evidence id, task/order, user, capture/upload time, GPS and hash. The SVG also includes a structured JSON `<metadata id="luistrata-evidence-metadata">` block with the full evidence, task, work order, GPS, hash and authenticity record. The download is audited.

`GET /api/export/basic`

Manager only. Returns company operational data as JSON.
