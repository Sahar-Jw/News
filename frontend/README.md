# News CMS Frontend (Next.js, static export)

Bilingual (Arabic RTL / English LTR) public site + admin panel for the NestJS backend. Everything is fetched in the browser from the API, so `next build` produces plain static files (`out/`) that run on cPanel shared hosting.

## Run
```bash
npm install
cp .env.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:3001/api
npm run dev                    # http://localhost:3000  (backend must be running)
```
Production: `npm run build` -> upload the contents of `out/` to `public_html` (the `.htaccess` is included).
`NEXT_PUBLIC_API_URL` is baked in at build time, so rebuild when the API URL changes.

## Backend settings that must match
- `CORS_ORIGINS` = the exact origin of this site (e.g. `https://sanabilalsham.org`).
- Auth uses the HttpOnly cookie set by `/auth/login` (`credentials: 'include'`, no token in JS).
  - Same site (site and API on the same domain/subdomains): `COOKIE_SAMESITE=lax`, `COOKIE_SECURE=true` over HTTPS.
  - Different domains: `COOKIE_SAMESITE=none` and `COOKIE_SECURE=true` (HTTPS required).
- The API also needs the new `GET /public/settings` endpoint (included in the updated backend zip).

## Routes
| Route | What |
|---|---|
| `/` | redirects to `/ar/` (or the last chosen language) |
| `/{ar,en}/` | home: ticker, hero, featured, latest, team, services, testimonials (+Facebook page), partners, experts, statistics, company, contact. Order/visibility/titles come from `sections_home` settings |
| `/{lang}/news/?category=&subcategory=&page=` | list with filters |
| `/{lang}/news/view/?id=` | article: gallery, rich body, topics, share, related, view count |
| `/{lang}/search/?q=` | search (min 2 chars) |
| `/{lang}/login`, `/register` | not linked from the navigation (open by URL) |
| `/{lang}/privacy`, `/terms`, `/sitemap` | text from settings category `pages` (`privacy_ar` ... JSON `{"title","body"}`) |
| `/{lang}/profile` | own profile (avatar, CV, password) |
| `/{lang}/admin` | dashboard |
| `/{lang}/admin/news`, `/admin/sections/{CODE}` | unified tables for regular news and the 8 special sections |
| `/{lang}/admin/news/edit?id=` / `?section=CODE` / `?new=1` | create/edit form |
| `/{lang}/admin/{users,roles,settings,cities,messages,audit,profile}` | management pages |

The news detail uses `?id=` (not `/news/123`) because a static export cannot create pages for ids that don't exist yet.

The shared top bar, navigation, and footer wrap every public page (including login and registration); the admin area uses its own dashboard navigation. News publishes immediately by default, while scheduled news becomes published when its scheduled time arrives.

## How it follows the SRS
- Every admin table uses one `DataTable`: global search, column filters, date range, page size 10/20/all, server-side paging, row numbers, checkbox + select-all + confirmed bulk delete, CSV/Excel export and print with a column picker.
- Menu items and buttons are hidden by permission (UI hint only; the API enforces every permission and returns 403).
- Special-section forms pin the main category. Changing a category / adding a new one needs `news.category.change` / `news.category.create`.
- Images: thumbnails, zoom, remove/undo existing, add new (marked "New"); nothing is saved until you press Save.
- Optional settings (phone, social links, Facebook page, map, logo ...) are hidden when empty. Partners show logos only.
- RTL/LTR switches `lang`/`dir` on `<html>`; layout uses logical properties (`start/end`).
