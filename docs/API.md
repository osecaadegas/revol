# API Contract

Authenticated JSON calls can use:

```text
Authorization: Bearer <session-token>
Content-Type: application/json
```

Login, setup, and invite acceptance also set an HttpOnly same-origin `meo_session` cookie. The cookie is required for browser-native requests that cannot attach bearer headers, such as evidence image previews and opening the basic JSON export in a new tab.

## Public Endpoints

`GET /api/health`

Returns server status and the active storage driver.

`GET /api/setup/status`

Returns whether the app has at least one active user.

`POST /api/setup`

Creates the first company and manager. Only allowed before initialization.

`POST /api/auth/login`

Body: `email`, `password`.

`GET /api/jobs/public`

Returns open vacancies visible without authentication. The frontend applies keyword, cargo/function, location, and radius filters client-side.

`POST /api/register/worker`

Creates a worker account and session. Workers can apply to vacancies.

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

Returns current user, company, accessible users, work orders, tasks, evidence metadata, audit log, manager invite list, vacancies, and relevant applications.

`POST /api/job-offers`

Company/manager only. Creates a public vacancy. Important fields: `title`, `position`, `location`, `contractType`, `salary`, `schedule`, `description`, and `requirements`.

`PATCH /api/job-offers/:id`

Company/manager only. Updates `title`, `position`, `location`, `contractType`, `salary`, `schedule`, `description`, `requirements`, or closes/reopens a company vacancy through `status`.

`POST /api/job-offers/:id/apply`

Worker only. Submits one application to an open vacancy.

`PATCH /api/applications/:id`

Company/manager only. Updates application review status.

`POST /api/users`

Manager only. Creates an active user.

`PATCH /api/users/:id`

Manager only. Updates active status or role.

`POST /api/invites`

Manager only. Creates an invite token bound to the manager company and selected role.

`POST /api/work-orders`

Manager only. Creates a work order with optional initial photos.

`POST /api/tasks`

Manager only. Creates an assigned task with deadline.

`PATCH /api/tasks/:id/status`

Manager or assigned responsible. Supports operational state changes. Blocking requires `blockReason`. Submitting for validation requires at least one photo evidence record.

`POST /api/tasks/:id/evidence`

Manager or assigned responsible. Uploads one image as evidence with optional note and location status.

`POST /api/tasks/:id/decision`

Manager only. Approves or rejects a task pending validation. Rejection requires reason.

`GET /api/evidence/:id/file`

Returns the image file only when the current user can access the related task or work order. The file is read from local private storage or Supabase private Storage depending on `APP_STORAGE_DRIVER`.

`GET /api/export/basic`

Manager only. Returns company operational data as JSON.
