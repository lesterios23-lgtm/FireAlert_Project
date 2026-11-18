# Frontend sa `firealerts.site`, API sa `api.firealerts.site`

Ito ang para sa case mo: **naka-live na ang React frontend** sa main domain, at
ang backend lang ang kulang.

```
domains/
├── firealerts.site/
│   └── public_html/          <- React build (nandiyan na, huwag gagalawin)
└── api.firealerts.site/
    ├── firealert/            <- Laravel app (i-upload)
    └── public_html/          <- index.php + .htaccess + storage link
```

Isang mahalagang bagay bago magsimula:

> ⚠️ Ang build na naka-live ngayon ay tumatawag sa `/api/v1` ng **parehong**
> domain. Kailangan i-rebuild ang frontend na naka-point sa
> `https://api.firealerts.site/api/v1` — kung hindi, 404 ang login.

---

## 1. Gumawa ng subdomain

hPanel → **Websites** → **Add website** → piliin ang hosting plan →
ilagay ang `api.firealerts.site` → **Empty website** (PHP/HTML).

Hintayin ang SSL (ilang minuto). Kapag may warning pa sa browser, hPanel →
**SSL** → **Install**.

---

## 2. PHP version + limits

**Manage site (api.firealerts.site) → PHP Configuration → PHP 8.3 → Update**

Sa **PHP Options** tab:
`upload_max_filesize=20M`, `post_max_size=24M`, `memory_limit=256M`

---

## 3. Database

**Databases → Management → Create a New MySQL Database And Database User → Create**

Isulat: **name**, **username**, **password**.

Tapos **Databases → phpMyAdmin → Enter phpMyAdmin → Import** →
`FireAlert_Backend\database\schema\mysql-schema.sql` → **Go** (22 tables).

---

## 4. Build sa PC

```powershell
deploy\hostinger\build-release.cmd -ApiUrl https://api.firealerts.site/api/v1 -Zip
```

Ang `-ApiUrl` ang nagsisiguro na `https://api.firealerts.site/api/v1` ang
tatawagin ng bagong React build. **Huwag na i-edit ang
`FireAlert_Frontend\.env`** — ang `-ApiUrl` ang masusunod.

Lalabas ang:
- `release\firealert` + `firealert.zip` → backend
- `release\api-public` → 2 files para sa subdomain `public_html`
- `release\public_html` → **HUWAG gamitin** (para 'yon sa one-domain setup)

I-check sa dulo ng output: `API base in the bundle: https://api.firealerts.site/api/v1`

---

## 5. Upload ng backend

```powershell
scp -P 65002 release\firealert.zip u123456789@185.185.185.185:~/domains/api.firealerts.site/
```

```bash
cd ~/domains/api.firealerts.site
unzip -o firealert.zip && rm firealert.zip
ls
```

Dapat may `firealert/` at `public_html/` sa loob ng `api.firealerts.site`.

---

## 6. `.env`

Gawa ng `firealert/.env` mula sa `deploy/hostinger/backend.env.production.example`.
Ito ang mga importante:

```
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.firealerts.site
FRONTEND_URL=https://firealerts.site,https://www.firealerts.site

DB_DATABASE=...
DB_USERNAME=...
DB_PASSWORD=...

SESSION_DRIVER=file
CACHE_STORE=file
QUEUE_CONNECTION=sync
FILESYSTEM_DISK=local

APP_KEY=...
JWT_SECRET=...
```

Click **Deploy** kung File Manager ang gamit.

---

## 7. Install (SSH)

```bash
cd ~/domains/api.firealerts.site/firealert
composer2 install --no-dev --optimize-autoloader --no-interaction
php artisan key:generate        # skip kung may APP_KEY na
php artisan jwt:secret          # skip kung may JWT_SECRET na
php artisan migrate --force
php artisan db:seed --class=ReferenceDataSeeder --force
php artisan optimize
chmod -R 775 storage bootstrap/cache
```

---

## 8. `public_html` ng subdomain

Upload ang **laman** ng `release\api-public` sa `~/domains/api.firealerts.site/public_html/`:
- `index.php`
- `.htaccess`

Tapos ang storage link:

```bash
cd ~/domains/api.firealerts.site/public_html
ln -s ../firealert/storage/app/public storage
ls -la storage
```

---

## 9. I-upload ang bagong frontend build

Sa **File Manager**, buksan ang `domains/firealerts.site/public_html` →
**Upload** → piliin ang **lahat ng laman** ng `FireAlert_Frontend\build`
(`index.html`, `static/`, `favicon.ico`, `logo192.png`, `logo512.png`,
`manifest.json`, `robots.txt`, `service-worker.js`, `asset-manifest.json`) →
**Replace**.

Hard-refresh ang browser (`Ctrl + F5`).

---

## 10. Test

| Buksan | Dapat |
|---|---|
| `https://api.firealerts.site/up` | `{"status":"up"}` |
| `https://firealerts.site` | login page |
| Login | pumasok |
| Mag-submit ng report | gumana |
| Profile photo | lumabas |

Kung 404 ang `/api/v1/auth/login` sa browser console, hindi pa naka-rebuild ang
frontend (step 4 at 9).

---

## Kung magbabago ka ng `.env` mamaya

Ang `php artisan optimize` (step 7) ay nag-cache ng config, kaya **hindi
agad** nababasa ang bagong `.env` value. Pagkatapos mag-edit ng `.env`, laging:

```bash
cd ~/domains/api.firealerts.site/firealert
php artisan optimize
```

Halimbawa kapag dinagdag mo ang `https://www.firealerts.site` sa
`FRONTEND_URL`, o pinalitan ang `DB_PASSWORD`.
