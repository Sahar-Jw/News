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
BACKUP_DIR=./backups          # mount as a volume
BACKUP_ENABLED=true           # false = no automatic backup
BACKUP_INTERVAL_HOURS=24
BACKUP_KEEP=14
BACKUP_ENCRYPTION_KEY=        # needed to restore
BACKUP_INCLUDE_FILES=true
```

Restore (REPLACES all data; stop the API, run the migrations of the same version first):
```bash
BACKUP_ENCRYPTION_KEY=... npm run backup:restore:prod -- /path/backup-YYYYMMDD-HHMMSS.json.gz --yes
tar -xzf backup-….files.tar.gz -C "$STORAGE_DIR"   # an encrypted archive must be decrypted first (AES-256-GCM: "DCCBK1" | iv 12 B | data | tag 16 B)
```
It runs in one transaction: a wrong key, a damaged file or a missing table changes nothing.
