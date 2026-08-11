# Supabase Reset To Current Schema

Use this only when the Supabase project contains old prototype tables and should be reset to the current LuisTrata/MEO schema.

## What This Deletes

The reset script drops these old public tables if they exist:

```text
audit_logs
companies
company_members
evidences
invitations
profiles
task_assignments
task_blocks
tasks
validations
work_order_photos
work_orders
```

It also drops any partial current `meo_*` install before recreating the current tables.

The script creates these current tables:

```text
meo_app_meta
meo_companies
meo_users
meo_sessions
meo_invites
meo_work_orders
meo_tasks
meo_evidences
meo_audit_logs
meo_job_offers
meo_job_applications
```

It creates or updates the private `meo-evidence` storage bucket. It does not delete the old `evidencias` bucket or storage objects; remove those manually only after confirming nothing needs to be kept.

The current user and invite role set is:

```text
manager
employee
contractor
worker
company
client
developer
```

## How To Run

1. Open the Supabase Dashboard for the target project.
2. Go to SQL Editor.
3. Open `supabase/admin/reset_to_current_schema.sql`.
4. Paste the full file into the SQL Editor.
5. Run it once.
6. Open Table Editor and confirm the `meo_*` tables exist and the old tables are gone.
7. Start the app with:

```text
APP_STORAGE_DRIVER=supabase
SUPABASE_URL=<project URL>
SUPABASE_SERVICE_ROLE_KEY=<server-only service role key>
SUPABASE_EVIDENCE_BUCKET=meo-evidence
```

## Why This Is Not A Normal Migration

This reset is intentionally kept under `supabase/admin/`, not `supabase/migrations/`, because it drops data. Normal deployment migrations should never reset a live database unexpectedly.

The app server uses the Supabase service-role key for REST reads/writes after the schema exists. That key is not enough to run arbitrary DDL through PostgREST. Run this reset through SQL Editor, a direct database connection, or a Supabase Management API personal access token with database write permissions.
