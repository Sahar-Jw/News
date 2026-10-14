# News CMS Backend (NestJS + TypeORM + MySQL)

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
Dev: `npm run start:dev`, `npm run migration:run`, `npm run seed` (ts-node).
Checks: `npm run typecheck`, `npm run build`.

The seed is idempotent and additive: it creates permissions, roles, default settings, reference cities, and (when configured) the first admin. It never overwrites settings or permissions edited from the UI. For local preview only, set `SEED_DEMO_DATA=true` and provide a unique `DEMO_USERS_PASSWORD` of at least 8 characters before running the seed. This adds bilingual placeholder news for the homepage sections, a sample contact message, and two active accounts: `editor@example.test` and `reader@example.test` (both use `DEMO_USERS_PASSWORD`). Demo records are clearly marked as samples; review or remove them before exposing a demo installation publicly. Demo content and accounts are skipped by default. Operational audit logs and uploaded media are intentionally not fabricated.

## cPanel notes
- Node.js App: startup file `dist/main.js`, set the env vars from `.env.example` in the app settings.
- Run `npm run migration:run:prod` and `npm run seed:prod` from the cPanel terminal (or set `RUN_MIGRATIONS_ON_START=true` once).
- `sharp` is an optional dependency. If it can't install on shared hosting the app still works; images are validated but not resized/compressed.
- Keep `STORAGE_DIR` outside the public web root. Files are served only through `GET /api/files/*`.
- Passwords use `bcryptjs` (pure JS, no native build).

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
- Permissions: `news.publish` to change status; `news.category.create` for a brand-new category value; `news.category.change` to change the main category.
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
