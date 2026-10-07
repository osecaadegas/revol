# Dark Frontend Design

## Scope

The 2026-10-07 visual brief is implemented inside the existing frontend. No
database migrations, environment changes, authentication changes, new framework,
or runtime dependencies are required. Recruitment and operational API behavior
is unchanged. Server edits are limited to HTML presentation, asset versioning,
and the font MIME type.

## Shared System

- `public/styles.css`: dark neutral surfaces, restrained blue actions, semantic
  statuses, centralized color/spacing/radius tokens and existing-token aliases.
  Existing 8px cards/controls remain consistent; modal radius is 16px.
- Self-hosted Inter v4.1 variable font in `public/fonts/`, with its OFL license.
- Self-hosted subset of Lucide 0.468.0 in `public/vendor/`, with its ISC license.
  Icons do not require a CDN or browser dependency.
- `public/design-system.js`: shared icon renderer, accessible field labels,
  focus containment/restoration, single responsive recruitment navigation and
  native mobile filter dialog. Existing form nodes and listeners are preserved
  when moved into/out of the filter drawer.
- All shared controls, notices, cards, tables, private document sections,
  progress bars, task drawers and long forms use the same dark system.
- `public/logo.svg`, `icon.svg`, `social-card.svg`, PWA colors and shell cache
  reflect the blue/dark identity. Existing logo silhouette is preserved.

## Screens

- Public homepage: compact search-first layout, real counts, clear vacancy
  hierarchy, prominent salary, compact verification indicator, company and
  worker entry points, restrained footer with existing working destinations.
- Desktop result filters move to a side column; mobile filters open a native
  modal drawer with labels, keyboard dismissal and focus restoration.
- Server-rendered job/company/location pages share the theme without requiring
  JavaScript. Open vacancy pages include a sticky mobile application action.
- Login and registration use a consistent dark modal and accessible focus loop.
- Worker/company navigation uses one sidebar on desktop and compact navigation
  above content on mobile. The same controls are moved, not duplicated.
- Worker CV/preferences/documents, saved jobs/searches, privacy/export/deletion,
  applications, messages and notifications retain their existing workflows.
- Company job management, vacancy creation/edit/preview, candidate search/profile,
  application stages, company profile and messaging use shared visual hierarchy.
- Moderation uses denser neutral sections and responsive rows.
- Operations, task detail/evidence, team, audit history, reserved client access,
  private project and MVP screens are included in the shared theme.

## Verification

Run `npm run build`, `npm run smoke` and `npm run test:recruitment`.
For the extended browser review, set `PLAYWRIGHT_MODULE` to an installed
Playwright package and `DESIGN_REVIEW=1`, then run `npm run test:recruitment`.
`PLAYWRIGHT_CHANNEL` defaults to installed Edge.

`server/design-test.js` exercises public/auth, worker, company, admin, operations
and private client screens at 1440, 768, 360, 390 and 430px. It captures screenshots
under ignored `tmp/design-qa/`, checks overflow, asset loading and runtime errors,
tests modal keyboard containment and filter submission/dismissal, and checks
computed direct-text contrast against AA thresholds on desktop screens.
The existing recruitment suite additionally saves profile preferences and edits
vacancies through the browser; API smoke covers operational evidence workflows.
Fixtures are disposable local data, never production records.

## Review Limits

- Automated contrast checks cover rendered text, not a complete WCAG audit or
  screen-reader certification. Disabled/native controls, hover states, image
  content and every possible user-uploaded asset need additional review.
- Native select/date/file controls follow the browser's dark color scheme;
  their popups require physical-device/Safari review.
- Private project content retains its existing information architecture, now
  themed consistently. Existing list-based application stages are not replaced
  with a new Kanban implementation in a visual-only release.
- No placeholder legal/contact links were added: approved privacy, terms,
  cookie and contact pages are not present in the current public route set.
- Google OAuth itself and camera/GPS capture on physical devices were not
  automated by this visual review. Their backend behavior was preserved.
