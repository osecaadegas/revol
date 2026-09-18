# Agent Operating Notes

This repository implements the Phase 1 "Motor de Evidencia Operacional" webapp from the source PDFs in the repository root.

## Source Of Truth

1. Read `docs/REQUIREMENTS_TRACE.md` before changing behavior.
2. Read `docs/PROGRESSIVE_BUILD_PLAN.md` before planning new work.
3. Read `docs/SETUP.md` before changing runtime, storage, or deployment assumptions.
4. The binding Phase 1 scope is the contract annex and budget. The manuals and manifesto are concept/future references only.

## Documentation Rule

Every implementation change must update at least one relevant document:

- `docs/PROGRESSIVE_BUILD_PLAN.md` for roadmap, status, and next build steps.
- `docs/REQUIREMENTS_TRACE.md` for requirement coverage or acceptance criteria changes.
- `docs/SETUP.md` for setup, environment, deployment, or operational changes.
- `docs/CHANGELOG.md` for completed changes.

## Scope Guardrails

Do not add future-phase features unless explicitly approved in a written change request. Out of scope for Phase 1: native mobile apps, advanced offline sync, native push notifications, continuous location tracking, AI photo analysis, Tiers, reputation scores, blockchain, billing, subscriptions, payroll, accounting, multi-company SaaS commercialization, and external integrations.

## Technical Guardrails

- Keep frontend, API, and persistence separated.
- Keep photos private. Do not expose `data/uploads` as static files.
- Enforce access on the server, not only in the UI.
- Record important actions in the audit history.
- Preserve mobile-first usability.
