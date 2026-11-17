# Deploying FireAlert on Hostinger (shared hosting)

This guide deploys both halves of the system on a single Hostinger domain:

| URL | Served by |
| --- | --- |
| `https://example.com/` | React single-page app (static build) |
| `https://example.com/api/v1/...` | Laravel API (PHP) |
| `https://example.com/up` | Laravel health check |

**TL;DR (Tagalog):** i-upload ang Laravel app sa `firealert/` (kapatid ng
`public_html`), i-import ang `database/schema/mysql-schema.sql` sa phpMyAdmin,
ilagay ang `.env`, tapos i-upload ang React `build/` sa loob ng `public_html`.
Buong detalye nasa ibaba.

---

## 0. What you need

- Hostinger plan with **PHP 8.3+** (Laravel 13 requires it) and **MySQL/MariaDB**.
  Premium/Business/Cloud plans are fine. SSH access is optional but recommended.
- A domain pointed at Hostinger.
- PHP 8.3 and Composer on your computer (for building the release).
- Node.js 18+ on your computer (for building the React app).

> The React app is **built on your computer**, not on the server. Shared
> hosting is not meant for `npm run build`.

---

## 1. Create the database

1. hPanel → **Databases** → **Management** → **Create new database**.
2. Note the four values it gives you:

   | Field | Example |
   | --- | --- |
   | Database name | `u123456789_firealert` |
   | Username | `u123456789_firealert` |
   | Password | *(the one you set)* |
   | Host | `localhost` |

3. Keep this page open, you need the values in step 4.

---

## 2. Import the schema

`php artisan migrate` normally loads `database/schema/mysql-schema.sql`, but on
shared hosting the `mysql` command-line client is not always callable from PHP.
Importing the same file through phpMyAdmin is the reliable path.

1. hPanel → **Databases** → **phpMyAdmin**.
2. Select the database you just created (left sidebar).
3. Open the **Import** tab.
4. Choose `FireAlert_Backend/database/schema/mysql-schema.sql` and click **Import**.

The file creates all 22 tables and records the migrations as already run, so
`php artisan migrate` will later say *"Nothing to migrate"*.

> If phpMyAdmin reports `Unknown collation: 'utf8mb4_0900_ai_ci'`, your server is
> MariaDB. The committed schema already uses `utf8mb4_unicode_ci`; re-download
> the latest file from the repository.
>
> If you ever regenerate the dump with `php artisan schema:dump`, run this in
> `FireAlert_Backend` so it stays MariaDB-compatible:
>
> ```powershell
> (Get-Content database\schema\mysql-schema.sql -Raw) -replace 'utf8mb4_0900_ai_ci', 'utf8mb4_unicode_ci' |
>   Set-Content database\schema\mysql-schema.sql -NoNewline
> ```

---

## 3. Upload the backend

The Laravel application must live **outside** the web root so that `.env`,
`vendor/` and `app/` are never downloadable.

```
/home/u123456789/domains/example.com/
├── firealert/        <- upload the Laravel application here
└── public_html/      <- the web root (steps 5 and 6 fill this)
```

Easiest way: run the release script on your computer (see
[Building the release](#building-the-release)), then upload the `firealert`
folder with hPanel **File Manager** (compress it to a ZIP first, upload, then
**Extract**) or over SSH with `scp`/`rsync`.

If your plan only lets you upload inside `public_html`, see
[Fallback: app inside public_html](#fallback-app-inside-public_html).

---

## 4. Create the backend `.env`

1. Copy `deploy/hostinger/backend.env.production.example` to `firealert/.env`.
2. Fill in `APP_URL`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`.
3. Leave `APP_DEBUG=false`. Leaving it on `true` exposes stack traces and
   database credentials to anyone who triggers an error.

Generate the secrets either on the server (step 6) or locally:

```bash
php artisan key:generate --show     # copy the base64:... value into APP_KEY
php artisan jwt:secret --show       # copy into JWT_SECRET
```

---

## 5. Install PHP dependencies

### With SSH (recommended)

```bash
cd ~/domains/example.com/firealert
php -v                                   # must be 8.3 or newer

composer install --no-dev --optimize-autoloader --no-interaction
```

If `composer` is not on the PATH, upload `composer.phar` to your home folder:

```bash
php ~/composer.phar install --no-dev --optimize-autoloader --no-interaction
```

If `php` is not 8.3, switch the version in hPanel → **Advanced** → **PHP
Configuration**, then reconnect.

### Without SSH

Run this on your computer inside `FireAlert_Backend`:

```bash
composer install --no-dev --optimize-autoloader
```

Then upload the whole folder **including `vendor/`**. Both machines run PHP 8.3,
so the dependencies are compatible. (Do not run `--no-dev` inside your only
working copy if you still need to run the test suite locally.)

---

## 6. Prepare the application

Run these on the server, in `firealert/`:

```bash
php artisan key:generate        # skip if you already filled APP_KEY
php artisan jwt:secret          # skip if you already filled JWT_SECRET
php artisan migrate --force     # should say "Nothing to migrate"
php artisan db:seed --class=ReferenceDataSeeder --force
php artisan optimize
```

Do **not** run `php artisan storage:link` here: it would create the link inside
`firealert/public/`, which this layout does not serve. Create it in the web root
instead (step 8):

```bash
cd ~/domains/example.com/public_html
ln -s ../firealert/storage/app/public storage
```

`ReferenceDataSeeder` inserts the 3 roles and 6 report statuses. Set
`FIREALERT_ADMIN_EMAIL` and `FIREALERT_ADMIN_PASSWORD` in `.env` **before**
running it if you want the first administrator created automatically.

If you have no SSH:

- Import `deploy/hostinger/reference-data.sql` through phpMyAdmin instead of
  running the seeder.
- Create the administrator after going live by registering normally and
  promoting the account:

```sql
UPDATE users SET role_id = 3, is_manager = 1 WHERE email = 'you@example.com';
```

- Create the storage symlink once: upload
  `deploy/hostinger/tools/storage-link.php` to `public_html/`, open
  `https://example.com/storage-link.php?token=CHANGE-ME`, then **delete the
  file**.

Finally, permissions:

```bash
chmod -R 775 storage bootstrap/cache
```

---

## 7. Build and upload the frontend

On your computer:

```bash
cd FireAlert_Frontend

# Optional: Google Maps key, read at build time.
#   REACT_APP_GOOGLE_MAPS_API_KEY=...
# Leave REACT_APP_API_URL empty: production then calls /api/v1 on the same domain.

npm ci
npm run build
```

Upload **the contents of `FireAlert_Frontend/build/`** into `public_html/`:

```
public_html/
├── index.html          <- from build/
├── static/             <- from build/
├── asset-manifest.json
├── favicon.ico
├── logo192.png
├── logo512.png
├── manifest.json
├── robots.txt
├── service-worker.js
└── ...
```

> Keep `REACT_APP_API_URL` empty for this setup. It is baked in at build time;
> changing the file on the server does nothing. If you use a separate API
> subdomain, see [Option B](#option-b-separate-api-subdomain).

---

## 8. Finalise the web root

Inside `public_html/` you need:

1. Laravel's public files (`storage` contents are **not** needed, only the
   `storage` symlink), **except** its `index.php` and `.htaccess`.
2. The React build (step 7).
3. `deploy/hostinger/public_html/index.php` → `public_html/index.php`
4. `deploy/hostinger/public_html/.htaccess` → `public_html/.htaccess`

`index.php` boots Laravel from `../firealert`. `.htaccess` sends `/api/*` to
Laravel, serves real files directly, and sends every other path to
`index.html` so client-side routes survive a page refresh.

Create the uploads symlink inside the web root (profile photos are written to
`firealert/storage/app/public`):

```bash
cd ~/domains/example.com/public_html
ln -s ../firealert/storage/app/public storage
```

Without SSH use `deploy/hostinger/tools/storage-link.php` (see step 6).

Do **not** upload `public/vendor/scribe` or generated API docs in production
unless you actually want them public.

---

## 9. Set the PHP limits for photo uploads

hPanel → **Advanced** → **PHP Configuration**:

| Setting | Value |
| --- | --- |
| `upload_max_filesize` | `20M` |
| `post_max_size` | `24M` |
| `max_execution_time` | `120` |
| `memory_limit` | `256M` |

The report form sends evidence photos; the defaults (often 2M) reject them.

---

## 10. Verify

Open these in order:

1. `https://example.com/up` → **200 OK**
2. `https://example.com/` → the React login page
3. Log in with the administrator account
4. Submit a report with a photo
5. Open the evidence photo (tests the storage symlink)
6. Upload a profile photo (also tests `public_html/storage`)

Quick API smoke test:

```bash
curl -i https://example.com/api/v1/auth/login \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"your-password"}'
```

Expect `200` with an `access_token`.

---

## Updating an existing deployment

```bash
cd ~/domains/example.com/firealert
php artisan down
git pull            # or upload the changed files
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan optimize
php artisan up
```

For frontend-only changes, rebuild locally and re-upload `build/` contents.
Browsers cache `index.html`, so hard-refresh once after deploying.

---

## Option B: separate API subdomain

If you prefer `api.example.com` for the backend:

1. hPanel → **Subdomains** → create `api` with document root
   `domains/example.com/firealert/public`.
2. Add the subdomain's public folder to `public/.htaccess` (Hostinger serves it
   directly; no custom front controller needed).
3. Set `APP_URL=https://api.example.com` and rebuild the frontend with
   `REACT_APP_API_URL=https://api.example.com/api/v1`.
4. Because the origins differ, allow the frontend origin in CORS:

```bash
php artisan vendor:publish --tag=cors
```

Then edit `config/cors.php`:

```php
'allowed_origins' => ['https://example.com'],
'supports_credentials' => false,
```

and run `php artisan config:cache`.

---

## Fallback: app inside `public_html`

Only if you cannot create folders next to `public_html`:

1. Upload the Laravel app to `public_html/firealert`.
2. In `public_html/index.php`, change `$appPath` to `__DIR__.'/firealert'`.
3. Add this as the **first** rule in `public_html/.htaccess` so the app folder
   is never served:

```apache
RewriteRule ^firealert/ - [F,L]
```

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `500` on every page | `storage/logs/laravel.log`; usually missing `APP_KEY`, wrong DB password, or `storage`/`bootstrap/cache` permissions |
| `Unknown collation: utf8mb4_0900_ai_ci` | MariaDB server; use the committed schema (it uses `utf8mb4_unicode_ci`) |
| `SQLSTATE[HY000] [1045]` | wrong `DB_USERNAME`/`DB_PASSWORD`, or `DB_HOST` is not `localhost` |
| `/api/v1/...` returns `404` | `.htaccess` missing, `mod_rewrite` off, or the file was uploaded as `htaccess.txt` |
| Refresh on an inner page → `404` | the SPA fallback rule in `.htaccess` is missing |
| Login works, photos return `403` | the `public_html/storage` symlink is missing or broken |
| Everyone gets logged out after a deploy | `JWT_SECRET` changed; tokens signed with the old secret are invalid |
| Changed `.env` but nothing changed | run `php artisan optimize:clear`, then `php artisan optimize` again |
| Photos over 2 MB rejected | PHP upload limits (step 9) |
| Google sign-in button does nothing | add `https://example.com` to the authorized JavaScript origins of the OAuth client in Google Cloud Console |
| White page after deploy | re-upload `build/` contents; check the browser console for failed `static/...` requests |

Logs:

```bash
tail -n 100 ~/domains/example.com/firealert/storage/logs/laravel-$(date +%F).log
```

---

## Building the release

`deploy/hostinger/build-release.ps1` assembles the two upload folders on your
computer:

```powershell
pwsh -File deploy/hostinger/build-release.ps1
```

It produces:

```
release/
├── firealert/     -> upload next to public_html
└── public_html/   -> upload as the web root
```

Use `-Zip` to also create `firealert.zip` and `public_html.zip` for the File
Manager, and `-WithVendor` to include `vendor/` (for plans without SSH).

After the first build you can skip the React compilation with `-SkipBuild`, for
example when only backend files changed:

```powershell
pwsh -File deploy/hostinger/build-release.ps1 -SkipBuild -Zip
```
