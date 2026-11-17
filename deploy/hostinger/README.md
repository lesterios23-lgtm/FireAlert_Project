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
Buong detalye nasa ibaba. Ang mga menu path ay sinuri sa Hostinger support docs
(Nobyembre 2026) — nakalista ang sources sa [dulo ng guide](#hostinger-docs-used).

> Sabay gamitin: **[CHECKLIST.md](CHECKLIST.md)** — isang pahinang checklist sa
> Tagalog para sa araw ng deployment.

---

## 0. What you need

- **Hostinger Web Premium or higher.** PHP 8.3+ and MySQL/MariaDB are included.
  - **SSH is included on Premium Web and up, but not on Single Web.** If you
    only have Single, use the File Manager paths in this guide.
  - New websites are created on **PHP 8.3** by default, which is exactly what
    Laravel 13 needs.
- A domain pointed at Hostinger.
- PHP 8.3 and Composer on your computer (only for building the release).
- Node.js 18+ on your computer (only for building the React app).

> The React app is **built on your computer**, not on the server. Shared
> hosting is not meant for `npm run build`.

---

## 1. Turn on SSH access (recommended, 2 minutes)

SSH lets you run `composer2` and `php artisan` on the server, which is how the
backend is meant to be installed.

1. Go to **[Websites](https://hpanel.hostinger.com/websites)** → hover your
   domain → **Manage site**.
2. In the sidebar, open **SSH Access** (under the Advanced group).
3. In **SSH status**, click **Enable**.

The **SSH details** card then shows everything you need:

| Field | Notes |
| --- | --- |
| IP address / host | the server to connect to |
| Port | often `65002`, sometimes `22` — **use what the card says** |
| Username | `u123456789` |
| Host key fingerprints | ED25519, ECDSA, RSA — use to verify the server |
| SSH command | one-click copy; the easiest way to connect |

### Connect from Windows

Open **PowerShell** (or Windows Terminal) and paste the copied command, which
looks like:

```powershell
ssh -p 65002 u123456789@185.185.185.185
```

The first connection asks you to trust the host:

```
The authenticity of host '[185.185.185.185]:65002' can't be established.
ECDSA key fingerprint is SHA256:Eze2ImXw1MWfgAMbcWxfc2EQwAkgTHOEPsNwSnEAHAQ.
Are you sure you want to continue connecting (yes/no)?
```

Compare that fingerprint with the matching one (here: **ECDSA**) on the SSH
Access page. Type `yes` only if they match. Then enter the password.

- The password is **your main domain's FTP password**.
- Forgot it? [Change the FTP password](https://www.hostinger.com/support/5634574-how-to-change-your-ftp-password-on-hostinger-dashboard/)
  or [set a separate SSH password](https://www.hostinger.com/support/6440760-how-to-change-an-ssh-password-on-hostinger-dashboard/).
- Nothing appears while you type — that is normal. Paste with right-click.
- Success looks like `u123456789@...:~$`.

You land in your home folder and can only work **inside it** (Hostinger's SSH
is restricted to the home directory and below).

> **No SSH client?** Use the browser terminal: **Websites → Manage site →
> Files → File Manager → Terminal icon** in the toolbar, or press `Ctrl` + the
> backtick key (`` ` ``). It runs over SSH, so SSH must be enabled first, and it
> opens in your website's folder.

---

## 2. Set the PHP version and upload limits

1. **Websites → Manage site → PHP Configuration**.
2. Select **PHP 8.3** (or newer) and click **Update**. It applies in a couple of
   minutes and covers every website on the plan.
3. Open the **PHP Options** tab on the same page and set:

| Setting | Value | Why |
| --- | --- | --- |
| `upload_max_filesize` | `20M` | evidence photos |
| `post_max_size` | `24M` | must be larger than the upload limit |
| `max_execution_time` | `120` | photo processing |
| `memory_limit` | `256M` | Composer + image handling |

Defaults are often 2M, which rejects every photo upload. You cannot set a value
higher than your plan's limit; the plan maximum is applied instead.

Verify from SSH after the change:

```bash
php -v        # must report 8.3 or newer
```

---

## 3. Create the database

1. **Websites → Manage site → Databases → Management**.
2. Make sure the correct website is selected in the drop-down on the left.
3. Under **Create a New MySQL Database And Database User**, enter a database
   name, username, and password, then click **Create**.

Notes from Hostinger:

- The `u123456789_` prefix is fixed and cannot be changed.
- One database = one user. Extra users need a VPS.
- The password needs at least 8 characters, with uppercase, lowercase, and a
  number.

Write down the four values:

| Field | Example |
| --- | --- |
| Database name | `u123456789_firealert` |
| Username | `u123456789_firealert` |
| Password | *(the one you set)* |
| Host | `localhost` |

---

## 4. Import the schema

`php artisan migrate` normally loads `database/schema/mysql-schema.sql`, but
importing the same file through phpMyAdmin is the reliable path on shared
hosting.

1. **Websites → Manage site → Databases → phpMyAdmin** → **Enter phpMyAdmin**
   next to your database. (Alternatively: Databases → Management → select the
   database → **phpMyAdmin**.)
2. Confirm the database is **empty** (Hostinger recommends this before every
   import).
3. Open the **Import** tab.
4. Choose `FireAlert_Backend/database/schema/mysql-schema.sql`
   (`.sql` or `.sql.zip`, up to 256 MB), leave the other import settings alone,
   and click **Go**.

The file creates all 22 tables and records the migrations as already run, so
`php artisan migrate` will later say *"Nothing to migrate"*.

> **MariaDB note.** Hostinger runs MariaDB, which rejects MySQL 8's
> `utf8mb4_0900_ai_ci`. The committed schema already uses
> `utf8mb4_unicode_ci`. If you ever regenerate the dump with
> `php artisan schema:dump`, run this in `FireAlert_Backend` so it stays
> compatible:
>
> ```powershell
> (Get-Content database\schema\mysql-schema.sql -Raw) -replace 'utf8mb4_0900_ai_ci', 'utf8mb4_unicode_ci' |
>   Set-Content database\schema\mysql-schema.sql -NoNewline
> ```

If phpMyAdmin complains about `SUPER privilege`, the dump contains statements
that need root rights. The schema in this repository does not.

---

## 5. Build the release on your computer

```powershell
deploy\hostinger\build-release.cmd -Zip
```

`pwsh` (PowerShell 7) is **not** required and not installed by default on
Windows — the `.cmd` wrapper uses the built-in Windows PowerShell 5.1. Using
`pwsh` also works if you happen to have it:

```powershell
pwsh -File deploy/hostinger/build-release.ps1 -Zip
```

That produces:

```
release/
├── firealert/       -> the Laravel application (upload next to public_html)
├── public_html/     -> the web root (Laravel public + React build)
├── firealert.zip
└── public_html.zip
```

`vendor/` is left out on purpose because Composer runs on the server. On a plan
without SSH, add `-WithVendor` and upload everything as-is.

> Use `-SkipBuild` to reuse an existing React build, e.g. when only backend
> files changed: `deploy\hostinger\build-release.cmd -SkipBuild -Zip`

---

## 6. Upload the backend

The Laravel application must live **outside** the web root so `.env`,
`vendor/` and `app/` are never downloadable:

```
/home/u123456789/domains/example.com/
├── firealert/        <- the Laravel application
└── public_html/      <- the web root
```

### Over SSH (predictable)

From your computer, in the repository folder:

```powershell
# One-time: make sure the remote folder exists.
ssh -p 65002 u123456789@185.185.185.185 "mkdir -p ~/domains/example.com"

scp -P 65002 release/firealert.zip u123456789@185.185.185.185:~/domains/example.com/
```

Back on the server:

```bash
cd ~/domains/example.com
unzip -o firealert.zip && rm firealert.zip
ls -la        # firealert/ appears next to public_html/
```

The archive already contains the top-level `firealert/` folder, so extract it
**in the website folder**, not inside `firealert/` again.

### With File Manager

1. **Websites → Manage site → Files → File Manager**.
2. Stay in the **website folder** (the path bar shows your domain, and
   `public_html` is listed inside it). Do not open `public_html` yet.
3. Click **Upload → Upload files** and pick `firealert.zip`.
4. Right-click the uploaded file → **Extract here**.
5. Delete the `.zip` afterwards.

> New File Manager behaviour: **uploads and extractions apply immediately**.
> Only file *edits* wait for the **Deploy** button. If your File Manager has a
> `Deploy` button in the top-right, deploy pending edits before testing.

---

## 7. Create the backend `.env`

Copy `deploy/hostinger/backend.env.production.example` to `firealert/.env` and
fill in:

- `APP_URL` — `https://example.com` (https, exact domain)
- `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
- leave `APP_DEBUG=false`; `true` leaks stack traces and DB credentials to
  anyone who triggers an error

Generate the two secrets on the server (step 8) or locally:

```bash
php artisan key:generate --show     # copy the base64:... value into APP_KEY
php artisan jwt:secret --show       # copy into JWT_SECRET
```

In File Manager, open `firealert/.env`, click **Open in editor**, paste, then
press **Deploy** — otherwise the change is not live.

---

## 8. Install dependencies and prepare the app (SSH)

```bash
cd ~/domains/example.com/firealert

php -v                     # 8.3 or newer
composer2 --version         # Composer 2 is pre-installed on Premium/Business/Cloud
```

Hostinger ships both Composer 1 (deprecated) and Composer 2. On PHP 8+ you must
use **`composer2`**, not `composer`:

```bash
composer2 install --no-dev --optimize-autoloader --no-interaction
```

If Composer runs out of memory:

```bash
COMPOSER_MEMORY_LIMIT=-1 composer2 install --no-dev --optimize-autoloader --no-interaction
```

The install finishes by running `php artisan package:discover`. That is safe
with `--no-dev`: `config/scribe.php` (Scribe is a dev-only package) returns an
empty array when its classes are missing, so production boots without it.

Then prepare the application:

```bash
php artisan key:generate        # skip if you already filled APP_KEY
php artisan jwt:secret          # skip if you already filled JWT_SECRET
php artisan migrate --force     # should say "Nothing to migrate"
php artisan db:seed --class=ReferenceDataSeeder --force
php artisan optimize

chmod -R 775 storage bootstrap/cache
```

`ReferenceDataSeeder` inserts the 3 roles and 6 report statuses. Set
`FIREALERT_ADMIN_EMAIL` and `FIREALERT_ADMIN_PASSWORD` in `.env` **before**
running it if you want the first administrator created automatically; remove
those two lines afterwards.

Do **not** run `php artisan storage:link` here: it would create the link inside
`firealert/public/`, which this layout never serves. The link goes in the web
root — see step 10.

### Without SSH

1. On your computer, inside `FireAlert_Backend`:

   ```bash
   composer install --no-dev --optimize-autoloader
   ```

   Then build with `-WithVendor` and upload `vendor/` too. (Do not use
   `--no-dev` in your only working copy if you still run the tests locally.)

2. Import `deploy/hostinger/reference-data.sql` in phpMyAdmin instead of the
   seeder. It is idempotent.

3. Create the administrator after going live by registering normally, then
   promoting the account in phpMyAdmin → SQL:

   ```sql
   UPDATE users SET role_id = 3, is_manager = 1 WHERE email = 'you@example.com';
   ```

4. There is no `artisan` without SSH, so `APP_KEY` and `JWT_SECRET` must be
   generated locally (step 7) and pasted into `.env`.

---

## 9. Build the frontend (if you did not use the release script)

```bash
cd FireAlert_Frontend

# Optional, read at build time:
#   REACT_APP_GOOGLE_MAPS_API_KEY=...
#   REACT_APP_GOOGLE_CLIENT_ID=...

npm ci
npm run build
```

Upload **the contents of `FireAlert_Frontend/build/`** into `public_html/`.
Keep `REACT_APP_API_URL` empty: the production build then calls `/api/v1` on the
same domain. Values are baked in at build time; editing files on the server does
nothing.

The release script does this for you and merges the result with Laravel's
`public/` files.

---

## 10. Upload the web root and create the uploads link

`public_html/` must contain:

1. Laravel's public files **except** its own `index.php` and `.htaccess`
2. The React build
3. `deploy/hostinger/public_html/index.php` → `public_html/index.php`
4. `deploy/hostinger/public_html/.htaccess` → `public_html/.htaccess`

`index.php` boots Laravel from `../firealert`. `.htaccess` sends `/api/*` to
Laravel, serves real files directly, and sends every other path to
`index.html`, so client-side routes survive a page refresh.

`release/public_html/` already has exactly this. Upload it:

```bash
# from your computer
scp -P 65002 release/public_html.zip u123456789@185.185.185.185:~/domains/example.com/
```

```bash
# on the server — merges into the existing public_html, overwriting the defaults
cd ~/domains/example.com
unzip -o public_html.zip && rm public_html.zip
```

With File Manager: open `public_html`, upload `public_html.zip`, right-click →
**Extract here**, then delete the zip. If the extractor creates a nested
`public_html/public_html`, open that folder, select everything (`Ctrl + A`),
**Cut**, go up one level and **Paste**.

Finally create the uploads symlink **inside the web root** (profile photos are
written to `firealert/storage/app/public`):

```bash
cd ~/domains/example.com/public_html
ln -s ../firealert/storage/app/public storage
ls -la storage      # -> ../firealert/storage/app/public
```

Without SSH, upload `deploy/hostinger/tools/storage-link.php` to
`public_html/`, set a random `TOKEN` in the file, open
`https://example.com/storage-link.php?token=YOUR-TOKEN`, then **delete the
file**.

> Do not upload `public/vendor/scribe` or generated API docs unless you want the
> API documentation public.

---

## 11. Verify

1. `https://example.com/up` → **200 OK**
2. `https://example.com/` → the React login page
3. Log in with the administrator account
4. Submit a report with a photo
5. Open the evidence photo (streamed by the API)
6. Upload a profile photo (tests the `public_html/storage` symlink)
7. Refresh an inner page such as `/dashboard` (tests the SPA fallback)

API smoke test:

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

# upload the changed files, or pull from git if the server has a clone
composer2 install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan optimize

php artisan up
```

For frontend-only changes, rebuild locally and re-upload the contents of
`release/public_html/`. Browsers cache `index.html`, so hard-refresh once.

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `500` on every page | `firealert/storage/logs/laravel-YYYY-MM-DD.log`; usually missing `APP_KEY`, wrong DB password, or `storage`/`bootstrap/cache` permissions |
| `Unknown collation: 'utf8mb4_0900_ai_ci'` | MariaDB server; use the committed schema (`utf8mb4_unicode_ci`) |
| `SQLSTATE[HY000] [1045]` | wrong `DB_USERNAME`/`DB_PASSWORD`, or `DB_HOST` is not `localhost` |
| `/api/v1/...` returns `404` | `.htaccess` missing, renamed `htaccess.txt`, or `mod_rewrite` off |
| Refresh on an inner page → `404` | the SPA fallback rule in `.htaccess` is missing |
| Login works, profile photos `403` | the `public_html/storage` symlink is missing or broken |
| Everyone gets logged out after a deploy | `JWT_SECRET` changed; old tokens are invalid |
| Changed `.env` but nothing changed | `php artisan optimize:clear`, then `php artisan optimize` |
| Photos over 2 MB rejected | PHP upload limits (step 2) |
| Google sign-in does nothing | add `https://example.com` to the OAuth client's authorized JavaScript origins, or set `REACT_APP_GOOGLE_CLIENT_ID` before building |
| White page after deploy | re-upload `release/public_html/`; check the browser console for failed `static/...` requests |
| `composer2: command not found` | plan without Composer (Single); build with `-WithVendor` instead |
| `Class "Knuckles\Scribe\Config\AuthIn" not found` | the server has an old `config/scribe.php`; upload the current one (it bails out when Scribe is absent), then `php artisan config:clear` |
| File Manager edits do nothing | pending edits must be applied with **Deploy** |

Logs:

```bash
tail -n 100 ~/domains/example.com/firealert/storage/logs/laravel-$(date +%F).log
```

Hostinger also shows website errors in **Websites → Manage site → Error logs**.

---

## Option B: separate API subdomain

If you prefer `api.example.com` for the backend:

1. **Websites → Manage site → Subdomains** → create `api` with document root
   `domains/example.com/firealert/public`.
2. Hostinger serves `firealert/public` directly, so Laravel's own
   `index.php`/`.htaccess` are used — no custom front controller there.
3. Set `APP_URL=https://api.example.com` and rebuild the frontend with
   `REACT_APP_API_URL=https://api.example.com/api/v1`.
4. Because the origins differ, allow the frontend origin in CORS:
   `php artisan vendor:publish --tag=cors`, then
   `'allowed_origins' => ['https://example.com']` and
   `php artisan config:cache`.

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

## Hostinger docs used

Verified against these pages (November 2026):

| Topic | Article |
| --- | --- |
| Enable SSH | https://www.hostinger.com/support/1583645-how-to-enable-ssh-access-in-hostinger/ |
| Connect over SSH | https://www.hostinger.com/support/1583245-how-to-connect-to-a-hosting-plan-via-ssh-in-hostinger/ |
| SSH password | https://www.hostinger.com/support/6440760-how-to-change-an-ssh-password-on-hostinger-dashboard/ |
| FTP password | https://www.hostinger.com/support/5634574-how-to-change-your-ftp-password-on-hostinger-dashboard/ |
| Browser terminal | https://www.hostinger.com/support/how-to-use-the-terminal-in-hostinger-file-manager/ |
| File Manager | https://www.hostinger.com/support/4548688-basic-actions-in-the-file-manager-in-hostinger/ |
| Composer (`composer2`) | https://www.hostinger.com/support/5792078-how-to-use-composer-at-hostinger/ |
| Composer issues | https://www.hostinger.com/support/5792082-how-to-solve-common-composer-issues-at-hostinger/ |
| PHP version | https://www.hostinger.com/support/1575755-how-to-change-the-php-version-of-your-hostinger-hosting-plan/ |
| PHP parameters | https://www.hostinger.com/support/4622479-how-to-change-values-of-php-parameters-in-hostinger/ |
| Create MySQL DB | https://www.hostinger.com/support/1583542-how-to-create-a-new-mysql-database-in-hostinger/ |
| Open phpMyAdmin | https://www.hostinger.com/support/1583545-how-to-access-phpmyadmin-at-hostinger/ |
| Import with phpMyAdmin | https://www.hostinger.com/support/1884149-how-to-import-a-database-with-phpmyadmin-in-hostinger/ |
| Database engine (MariaDB) | https://www.hostinger.com/support/1583226-which-database-management-system-is-used-at-hostinger/ |
| File permissions | https://www.hostinger.com/support/1583479-how-to-fix-file-permissions-in-hostinger/ |
| Error logs | https://www.hostinger.com/support/1583298-where-to-find-your-website-s-error-logs-in-hostinger/ |

---

## Building the release

`deploy/hostinger/build-release.cmd` assembles the two upload folders (no
PowerShell 7 needed):

```powershell
deploy\hostinger\build-release.cmd
```

Options:

| Flag | Effect |
| --- | --- |
| `-Zip` | also create `firealert.zip` and `public_html.zip` |
| `-WithVendor` | include `vendor/` (plans without SSH) |
| `-SkipBuild` | reuse the existing React build |

`.env`, logs, tests, `node_modules`, and database backups are never included.
`bootstrap/cache/` is emptied too, because stale `packages.php`/`services.php`
manifests list dev-only providers and break a `--no-dev` install.

### What was verified before shipping this guide

- `composer install --no-dev --optimize-autoloader` in the built release: OK
- `php artisan optimize` (config/route/view cache) without dev packages: OK
- `php artisan route:list --path=api/v1`: 44 routes
- HTTP kernel against the same release: `/up` 200, `/api/v1/auth/me` 401 JSON,
  `/api/v1/does-not-exist` 404 JSON, `POST /api/v1/auth/login` 422
- Schema import on a fresh database: 22 tables, 23 migrations recorded,
  `migrate` → "Nothing to migrate"
- `reference-data.sql` imported twice: 3 roles, 6 statuses (idempotent)

### If the build script does not run

**`pwsh` is not recognized**

`pwsh` is PowerShell 7, which Windows does not ship. Nothing to install — use
the bundled wrapper, which calls Windows PowerShell 5.1:

```powershell
deploy\hostinger\build-release.cmd -Zip
```

or call it directly:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\hostinger\build-release.ps1 -Zip
```

**"running scripts is disabled on this system"**

The `.cmd` wrapper already passes `-ExecutionPolicy Bypass`. To allow scripts
for your own account permanently:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

**Node / npm errors**

| Error | Fix |
| --- | --- |
| Warnings become errors (`Failed to compile`) | `CI` is set; run `set CI=` (cmd) or `$env:CI=''` (PowerShell) first |
| `ENOENT package.json` | run the script from the repository root, or use the `.cmd` |
| Broken `node_modules` | delete `FireAlert_Frontend\node_modules`, re-run (the script runs `npm ci` automatically) |
| `npm ci` peer conflicts | `npm install --legacy-peer-deps`, then re-run with `-SkipBuild` |
| No Node at all | the Laravel side does not need Node, but the React build does: build once on a machine with Node 18+ and copy the `release/` folder |

The three ESLint warnings in this project are pre-existing and non-blocking.

**ZIP creation fails (`tar: Cannot connect to C:`)**

Skip `-Zip`; both folders are already staged:

```powershell
deploy\hostinger\build-release.cmd -SkipBuild
```

Then upload them **as folders**:

- SSH: `scp -r -P 65002 release/firealert u123456789@host:~/domains/example.com/`
- File Manager: **Upload → Upload folder**

Do **not** use `Compress-Archive`: Windows PowerShell skips dotfiles such as
`.htaccess` when zipping. If you zip with another tool, confirm `.htaccess` is
inside the archive before uploading.

**Build completely by hand (no script)**

1. `cd FireAlert_Frontend` → `npm ci` → `npm run build`
2. Create `release\firealert` = copy of `FireAlert_Backend` **without**
   `node_modules`, `vendor`, `tests`, `.git`, `.env`, `storage\logs\*`,
   `bootstrap\cache\*`, `database\backups`
3. Create `release\public_html` = copy of `FireAlert_Backend\public` **without**
   `index.php`, `.htaccess`, `storage`, `vendor`
4. Copy the contents of `FireAlert_Frontend\build` over `release\public_html`
5. Copy `deploy\hostinger\public_html\index.php` and `.htaccess` into
   `release\public_html`
