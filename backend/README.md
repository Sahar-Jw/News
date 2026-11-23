# News CMS Backend (NestJS + TypeORM + PostgreSQL)

Implements the SRS "نظام إدارة الموقع الإخباري والمحتوى الرقمي" v1.0: 9 tables, one unified `news` table, JWT + DB-backed RBAC, key-value site settings, file storage on disk.

## Quick start
```bash
npm install
cp .env.example .env        # fill DB_*, JWT_SECRET, SEED_ADMIN_PASSWORD
npm run build
npm run migration:run:prod  # creates the 9 tables
npm run seed:prod           # permissions, roles, default settings, first admin
npm run start:prod          # http://localhost:3001/api
```
> **PostgreSQL:** create an empty database first (`createdb nn`). The files in `src/database/migrations/` were written for MySQL, so generate a fresh PostgreSQL initial migration (`npm run typeorm -- migration:generate src/database/migrations/InitialSchema`) before running `migration:run`.

Dev: `npm run start:dev`, `npm run migration:run`, `npm run seed` (ts-node).
Checks: `npm run typecheck`, `npm run build`.

The seed is idempotent and additive: it creates permissions, roles, default settings, reference cities, and (when configured) the first admin. It never overwrites settings or permissions edited from the UI. For local preview only, set `SEED_DEMO_DATA=true` and provide a unique `DEMO_USERS_PASSWORD` of at least 8 characters before running the seed. This adds bilingual placeholder news for the homepage sections, a sample contact message, and two active accounts: `editor@example.test` and `reader@example.test` (both use `DEMO_USERS_PASSWORD`). Demo records are clearly marked as samples; review or remove them before exposing a demo installation publicly. Demo content and accounts are skipped by default. Operational audit logs and uploaded media are intentionally not fabricated.

## cPanel notes
- Node.js App: startup file `dist/main.js`, set the env vars from `.env.example` in the app settings.
- Run `npm run migration:run:prod` and `npm run seed:prod` from the cPanel terminal (or set `RUN_MIGRATIONS_ON_START=true` once).
- `sharp` is an optional dependency. If it can't install on shared hosting the app still works; images are validated but not resized/compressed.
- Images are resized on upload: a picture wider than 1920 px is scaled down (never up) and saved at high quality (`IMAGE_QUALITY`, default 92, allowed 60-100); a picture that is already small enough is stored exactly as uploaded, a PNG is only repacked losslessly. Animated images are stored as uploaded.
- Keep `STORAGE_DIR` outside the public web root. Files are served only through `GET /api/files/*`.
- Passwords use `bcryptjs` (pure JS, no native build).

## File storage: local disk or S3

Uploaded files are stored either on disk (`STORAGE_DIR`, e.g. a mounted volume) or in an S3-compatible bucket.
The driver is `s3` as soon as `S3_BUCKET` is set (or `STORAGE_DRIVER=s3`), otherwise `local`.
URLs never change: files are always served through `GET /api/files/*`, so private files (CVs) keep their permission check.

```dotenv
STORAGE_DRIVER=s3                 # optional: s3 | local (default: s3 when S3_BUCKET is set)
S3_ENDPOINT=https://<provider endpoint>
S3_BUCKET=<generated bucket id>   # the real bucket name/ID, not the friendly label
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_REGION=us-east-1               # optional
# S3_FORCE_PATH_STYLE=true        # default true (needed by most S3-compatible providers)
# S3_SEED=false                   # disable the one-time upload of storage-seed/ (the images committed in the repo)
```

On the first start with an empty bucket, the images shipped in `storage-seed/` (Docker image) are uploaded once and a
`.seeded` marker object is written; later starts skip it, so images deleted from the admin panel never come back.

## Conventions
- Prefix `/api`. Errors: `{statusCode, error, message, timestamp}`. Lists: `{data, meta:{page,limit,total,totalPages,from,to}}`.
- Auth: `Authorization: Bearer <jwt>` or the `access_token` HttpOnly cookie set by `/auth/login`.
- Admin tables share query params: `q, from, to, page, limit(10|20|all), sortDir`, plus module filters. Export: `GET .../export?format=csv|xlsx&columns=a,b` (+ the same filters). No columns -> 400.
- Permission checks are server-side on every route (`@Permissions(...)` = any of). Role permissions are cached for at most 60 s.

## Endpoints
| Area | Routes |
|---|---|
| Auth | `POST /auth/register` (inactive), `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` |
| Public | `GET /public/home?lang`, `/public/news`, `/public/news/:id`, `/public/categories`, `/public/search?q`, `/public/sections/:CODE`, `/public/cities`, `POST /public/contact` |
| News (admin) | `GET/POST /admin/news`, `GET/PATCH/DELETE /admin/news/:id`, `POST /admin/news/bulk-delete`, `GET /admin/news/categories`, `GET /admin/news/export` |
| Users | `/admin/users` (CRUD, `:id/activate`, `bulk-delete`, `export`), `/profile` (GET/PATCH, `POST /profile/avatar`, `/profile/cv`, `/profile/password`) |
| Access | `/admin/roles` CRUD, `GET /admin/permissions`, `GET/PUT /admin/roles/:id/permissions` |
| Settings | `GET /admin/settings`, `GET /admin/settings/categories`, `PATCH /admin/settings/:id`, `POST /admin/settings/:id/file` |
| Other | `/admin/cities`, `/admin/messages` (`:id` marks read, `export`), `/admin/audit-logs` (read-only, `export`), `GET /files/*` |

### News create/update
JSON or `multipart/form-data` (field `images`, up to 20 files, 5 MB each, content-sniffed JPG/PNG/WEBP/GIF).
- Fields: `title, subject, mainCategory, subcategory, topics (array | JSON | comma list), body (HTML), rating (1-5, TESTIMONIALS only), isFeatured, publishAt, status, language, visibility`.
- Special sections: send `section=SERVICES` (STATISTICS, BREAKING, SERVICES, PARTNERS, EXPERTS, TEAM, TESTIMONIALS, COMPANY_OVERVIEW). The category is pinned. Reserved codes are rejected in the regular form.
- Update: `keepImages` = existing paths to keep (omit = keep all); everything else is removed after the save succeeds.
- Permissions: `news.publish` to change status or publish time (new items publish immediately by default); `news.category.create` for a brand-new category value; `news.category.change` to change the main category.
- Body HTML is whitelist-sanitised server-side.

## Behaviour decisions (SRS section 26 proposals, implemented as written)
- Eligibility is computed at query time (no cron): `published` (publish_at <= now) or `scheduled` with publish_at <= now.
- Scheduling in the past -> 400. Published with a future time -> 400 (use `scheduled`).
- View count +1 on detail open; same visitor (IP+UA) ignored for 30 min (in-memory, per instance).
- A record stays reachable at `/public/news/:id` in its own language; lists follow the UI language only.
- Related articles: same language + main category, at least 1 shared topic, max 4.
- Deleting a role that has users -> 409. Removing/deleting the last holder of `permissions.assign` -> 409.
- Anti-escalation: you can only assign a role/permission whose permission set is a subset of yours; you can't edit your own account from `/admin/users`.

## Naming notes
The SRS mixes names (`permissions_role` / `role_permissions`, `settings_site` / `site_settings`, `logs_audit` / `audit_logs`). This code uses the ERD names: `role_permissions`, `site_settings`, `audit_logs`.

## Dashboard-managed forms (Settings → Forms & requests)

Forms are data, not code. **Forms** tab = builder (any field type; add / edit / delete / reorder; conditional fields; attachments with allowed types / count / size; statuses; categories). **Requests** tab = review, sort, classify, change status, contact the applicant by e-mail, export to Excel. Public page: `/ar/forms?slug=<slug>` (list at `/ar/forms`).

- **Field types:** text, long text, number, e-mail, phone, link, date, dropdown, single / multiple choice, checkbox, attachment, section heading, note. A new type = one entry in `modules/forms/field-schema.ts` + one renderer in `frontend/src/components/site/dynamic-form.tsx`.
- **Editing a form never loses data:** each request stores a snapshot of the fields it answered.
- **New-request notification:** e-mail to the form's staff addresses (no answers inside), receipt to the applicant, unread banner + toast on every management page.
- **Personal-data protection:** consent stored with a timestamp; every value validated server-side, unknown keys dropped; attachments under `private/forms/` (content-sniffed, random names, served only to users with `forms.submissions.read` **and** `forms.submissions.sensitive`); fields marked "sensitive" are AES-256-GCM encrypted (`FORMS_ENCRYPTION_KEY`) and masked for staff without `forms.submissions.sensitive`; answers never enter the audit log (it records who opened / changed which request); e-mails carry no answers; honeypot + rate limit on the public endpoint; per-form retention (auto-delete after N days); per-request erasure; Excel export has its own permission and honours the masking.
- **Integrations:** per form, signed webhooks (`X-Signature: sha256=<HMAC-SHA256 of the body>`) on *new request* and *status change*; https only, private addresses refused; only non-sensitive answers are sent. This is the hook for the chamber's own systems / databases.
- **New permissions:** `forms.read|create|update|delete`, `forms.submissions.read|update|contact|export|delete|sensitive`, `backups.read|create|download|delete` (run `npm run seed:prod`; the technical admin gets them).
- **Migration:** `1766800000000-AddDynamicForms` (`npm run migration:run:prod`).

```dotenv
FORMS_ENCRYPTION_KEY=   # long random secret. Keep a copy elsewhere: if lost, "sensitive" answers cannot be read again
```

## Backups

Settings → Forms & requests → Backups, or automatic (default every 24 h, keep 14). A backup = the whole database (`backup-….json.gz`) + the uploaded files when they are on local disk (`backup-….files.tar.gz`; with S3 enable bucket versioning). Encrypted when `BACKUP_ENCRYPTION_KEY` is set. **Copy `BACKUP_DIR` off the server** and keep the key somewhere else.

```dotenv
BACKUP_DIR=./backups          # with S3 file storage the backups are uploaded to the bucket (<S3_PREFIX>/.backups/, never served) and this is only a work folder; BACKUP_STORAGE=local keeps them here instead. On local storage it MUST be a mounted persistent volume (e.g. mount a volume at /app/backups): on the container's own disk every redeploy / restart erases the backups (the Backups page warns when it is not)
BACKUP_ENABLED=true           # false = no automatic backup
BACKUP_INTERVAL_HOURS=24
BACKUP_KEEP=14
BACKUP_ENCRYPTION_KEY=        # needed to restore
BACKUP_INCLUDE_FILES=true
```

Dashboard download: **Download** = a ZIP with one folder holding `backup-X.sql` (a restorable script); **Download encrypted** = the same ZIP protected with the password `BACKUP_ENCRYPTION_KEY` (AES-256, opens in 7-Zip / WinRAR / WinZip). To restore from it: extract, then `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backup-X.sql` (or run the file in pgAdmin) on a database that already has the tables. It first empties every table and runs in ONE transaction.

Restore (REPLACES all data; stop the API, run the migrations of the same version first):
```bash
# an encrypted backup downloaded with "Download encrypted" can be decrypted anywhere you have the key:
# BACKUP_ENCRYPTION_KEY=... node dist/database/decrypt-backup.js backup-X.json.gz backup-X.plain.json.gz   (npm run backup:decrypt -- <in> <out>)
BACKUP_ENCRYPTION_KEY=... npm run backup:restore:prod -- /path/backup-YYYYMMDD-HHMMSS.json.gz --yes
tar -xzf backup-….files.tar.gz -C "$STORAGE_DIR"   # an encrypted archive must be decrypted first (AES-256-GCM: "DCCBK1" | iv 12 B | data | tag 16 B)
```
It runs in one transaction: a wrong key, a damaged file or a missing table changes nothing.

## The old hard-coded forms are now dashboard forms

Membership, trainer application, course registration, incubator, EXPO (exhibitor / visitor / information) and Get2Trade (booking / inquiry) are forms of **Settings → Forms & requests → Forms**, with these slugs: `membership`, `trainer-application`, `course-registration`, `incubator-application`, `expo-exhibitor`, `expo-visitor`, `expo-info`, `get2trade-booking`, `get2trade-inquiry`. Their public pages keep their layout (texts, conditions, tabs); only the form inside is drawn from the form definition, so fields, labels, required / optional, options, attachments, statuses and categories are edited from the dashboard.

- **Migration `1767100000000-MoveLegacyFormsToDynamicForms`** (run `migration:run:prod`, then `seed:prod`): creates the nine definitions; copies every existing request (answers, status, notes, dates, attachments, linked course / space) into the new requests table; copies the staff notification e-mail from the old settings; gives the new permissions to every role that had the matching old ones. Idempotent. The old tables are left untouched as an archive; the old admin tabs now open the new Requests screen filtered to that form.
- **Rules that still apply (server-side):** course registration needs an open course with seats left (checked under a lock) and one registration per e-mail and course; Get2Trade booking needs the booking switch open, an available space big enough for the people count, an existing package, a start date not in the past, a full duration (number + unit) and no other request in progress for the same e-mail and space; incubator needs the "I confirm" box; trainer application and membership allow one request in progress per e-mail (trainer) / none (membership); the EXPO / incubator forms ignore an identical repeat within 10 minutes.
- **Keep these field keys** when editing those forms: `space`, `package`, `people`, `duration_value`, `duration_unit` (Get2Trade rules), and the form slugs (the pages load them by slug). Other fields can be renamed, added or deleted freely.
- **Removed public endpoints:** `POST /public/membership/apply`, `/public/training/courses/:id/register`, `/public/training/trainer-applications`, `/public/incubator/apply`, `/public/expo/apply`, `/public/get2trade/bookings`. All requests now go to `POST /public/forms/<slug>/submit`.
- **Course seat counts** (public course pages, "full" status) now count the requests of the `course-registration` form.
- Reference numbers change format (`FRM-YYYY-00042`); old references stay only in the archive tables.

## Contact form and the form editor

- **Contact form:** every "contact us" box (home page, contact page, One-Stop, services, women's committee) is the dashboard form `contact`. Migration `1767200000000-MoveContactFormToDynamicForms` creates it, copies the existing messages into the requests table (the old `contact_messages` table stays as an archive) and gives the new permissions to whoever had `messages.read` / `messages.export`. `POST /public/contact` was removed; the Messages page now shows the `contact` requests (read, status, reply by e-mail, export).
- **Not forms of the dashboard (on purpose):** newsletter subscription (it has e-mail verification and topic preferences) and the account forms (register, login, forgot / reset password).
- **Form editor (Settings → Forms & requests → Forms → Edit):** only the inputs: add one (pick its type), edit its label / required / options / allowed files, move it, delete it. A second tab shows the form exactly as a visitor sees it, to fill in and send for real. Everything else about a form (title, address, statuses, categories, notification e-mails, retention, webhooks) is unchanged and is still available through the API (`PATCH /admin/forms/:id`); the screen simply does not offer it.
- **Request details** show the applicant's answers inside the form's own inputs (read only), with attachments below.

## Audit log screen

Settings → Audit log (`audit.read`) follows the layout of the task-management system's audit log: one row per action with date, user, action, type and details; a search box, a type filter, an action filter and a date range; the "N changes" link opens the fields that changed as before → after (a created or deleted record shows its main fields). The screen does not show IP, browser, route, result columns or raw JSON; those are still stored and are in the Excel export.

- **Action kinds:** the ~35 raw action codes the services write are grouped into create / update / delete / login / logout / failed attempt / password / export / download / data access / other (`modules/audit/audit-kinds.ts`). Filter with `?kind=`.
- **Hidden by default:** the system's `unlogged_request` safety-net rows are never listed, and `read` (someone opened personal data) is listed only when the "Data access" kind is chosen.
- **Filter lists** (`GET /admin/audit-logs/facets`) contain only the types and kinds that exist in the log.

## When the database is down

Symptoms in the API log: `ECONNREFUSED <db-host>:5432`, then `the database system is not yet accepting connections` / `starting up`. That is the **PostgreSQL server**,
not the API: it is stopped, restarting or in crash recovery, and every request that needs data fails until it is back.

- The API answers such requests with **503 Service Unavailable** (message "temporarily unavailable", `Retry-After: 15`) and writes **one** line every 30 s to the log
  instead of a stack trace per request. It reconnects by itself when the database returns; no API restart is needed. At start-up it waits for the database for ~2.5 minutes.
- `GET /api/health` = the API is up; `GET /api/health/ready` = the API can reach the database (503 otherwise). Use them as the hosting panel's health check / uptime monitor.
- Look at the **database** container's own log first: `PANIC`, `invalid page`, `could not write`, `No space left on device`, `Out of memory` / OOM kill, `database system was interrupted`.
  Check the data volume: it must be a persistent volume and have free space. A database that comes back empty or old means a new / restored volume.
- Data is restored from the Backups screen in Settings (or `npm run backup:restore:prod`).
- Start the database and wait until `GET /api/health/ready` answers 200 before starting the API after a full restart.

## A new or restored database (and `DB_SYNCHRONIZE`)

The migrations in `src/database/migrations` start from an existing schema (there is no "create every table" migration), so a **brand-new empty database** gets its tables from the
entity classes once, with TypeORM's *synchronize*:

1. Start the API once with `DB_SYNCHRONIZE=true` against the empty database: it creates every table. **Then remove `DB_SYNCHRONIZE` from the environment.**
2. Import the data (data-only `INSERT`s; the dump's `CREATE TABLE` lines are not needed). After the import, restart the API.
3. The migration history is recorded automatically in that same first start (see "Migrations" below), so later versions can add migrations safely.

`DB_SYNCHRONIZE=true` is honoured **only while the database has no `users` table**. On a database that already has tables it is ignored (a warning is logged), because synchronizing
a database with data can drop columns with their data, or fail half-way (`column "created_at" of relation "roles" contains null values`) and stop the API from starting.
The string `false` never switches it on.

`npm run schema:check` (dev) / `npm run schema:check:prod` (built app) is **read-only**: it prints the SQL TypeORM *would* run to make the database match the entities, and runs
nothing. Lines starting with `!!` are DROPs - look at them carefully. Use it after importing a dump to see what differs.

## Migrations (how every future change to the database is made)

After the first version, the database is changed **only by migrations** (`src/database/migrations`). Which ones already ran on a database is stored **in that database**,
in the table `typeorm_migrations` (one row per migration). On start with `RUN_MIGRATIONS_ON_START=true` TypeORM runs the migrations that have no row yet, oldest first, each
once. That only works if the table is correct, so:

- **A database created by synchronize** (a new empty one): its history is recorded automatically in the same start - every migration shipped with that version is marked
  as applied without being run (the tables already contain their result). Only migrations added in later versions run.
- **A database that has tables but no history** (built by synchronize before this version, or restored from a dump without the `typeorm_migrations` rows):
  `RUN_MIGRATIONS_ON_START=true` is now **ignored with a warning**, because it would run all the old migrations again. Record the history once:
  1. Set `MIGRATIONS_BASELINE=all` (every migration of the code is marked as applied) - or a timestamp, e.g. `MIGRATIONS_BASELINE=1767500000000`: migrations up to that
     timestamp are marked as applied and the newer ones stay pending and run normally. Use the timestamp when the dump is older than the code (the last name in the
     dump's `typeorm_migrations` rows tells you).
  2. Restart the API once, then **remove `MIGRATIONS_BASELINE`**. Without a shell, the setting is the way; with one: `npm run migration:baseline:prod -- all` (add `--dry` to only look).
- `npm run migration:status:prod` is **read-only**: tables yes/no, how many migrations are recorded, and which are pending.
- When you restore a backup, the `typeorm_migrations` rows come with it (the dump has them) - then nothing needs to be recorded, only check `migration:status:prod`.

### Adding a migration

1. New file `src/database/migrations/<timestamp>-<Name>.ts`, class `<Name><timestamp>` with `name = '<Name><timestamp>'` (the file name and the class must agree - the history
   stores that name). Use a timestamp **newer than the last one** (`Date.now()`), so it runs last.
2. Write it so it can be repeated (`IF NOT EXISTS`, `IF EXISTS`, `UPDATE ... WHERE`), like the existing ones, and give it a `down`.
3. Change the entity class in the same commit, so a brand-new database (created from the entities) and an upgraded one end up identical.
4. Before the upgrade take a backup (Settings > Backups). Set `RUN_MIGRATIONS_ON_START=true`, deploy, check the log and `migration:status:prod`.
   Each start runs all pending migrations in one transaction: if one fails nothing is applied and the API logs the error.
5. Never use `DB_SYNCHRONIZE` for this, and avoid `REINDEX` / heavy rewrites in a migration on the hosted CuminDB (a `REINDEX` crashed it before).
