# FireAlert → Hostinger: checklist ng gagawin

Isang pahina lang ito. Ang buong paliwanag ay nasa [README.md](README.md).

Domain sa halimbawang ito: `example.com` · Hosting user: `u123456789`

---

## Bago umalis sa computer

- [ ] `deploy\hostinger\build-release.cmd -Zip`
      (hindi kailangan ng `pwsh` — Windows PowerShell 5.1 ang gamit nito)
- [ ] Kopyahin ang `release/firealert.zip` at `release/public_html.zip`
- [ ] Gumawa ng random na `APP_KEY` at `JWT_SECRET`:
      `php artisan key:generate --show` at `php artisan jwt:secret --show`
      (kung walang SSH, ito lang ang paraan para magkaroon ng secrets)

---

## Sa hPanel

- [ ] **Websites → Manage site → SSH Access → Enable**
      → kopyahin ang SSH command, port, username, at host key fingerprints
- [ ] **PHP Configuration** → PHP **8.3** → **Update**
- [ ] **PHP Configuration → PHP Options**:
      `upload_max_filesize=20M`, `post_max_size=24M`,
      `max_execution_time=120`, `memory_limit=256M`
- [ ] **Databases → Management** → piliin ang website →
      **Create a New MySQL Database And Database User** → **Create**
      (isulat ang DB name, username, password)
- [ ] **Databases → phpMyAdmin → Enter phpMyAdmin** → **Import** →
      `database/schema/mysql-schema.sql` → **Go**
      (dapat 22 tables)

---

## Upload

- [ ] **File Manager**, nasa website folder (kapatid ng `public_html`, hindi sa loob):
      upload `firealert.zip` → right-click → **Extract here** → delete ang zip
- [ ] Gumawa ng `firealert/.env` mula sa
      `deploy/hostinger/backend.env.production.example`
      → ilagay ang `APP_URL`, DB name/user/password, `APP_KEY`, `JWT_SECRET`
      → **Deploy** (kung may Deploy button)
- [ ] Sa `public_html`: upload `public_html.zip` → **Extract here** → delete ang zip
      (kung naging `public_html/public_html`, i-cut at i-paste pataas)

---

## SSH commands (copy-paste)

```bash
cd ~/domains/example.com/firealert
php -v
composer2 install --no-dev --optimize-autoloader --no-interaction
php artisan migrate --force          # "Nothing to migrate" ang expected
php artisan db:seed --class=ReferenceDataSeeder --force
php artisan optimize
chmod -R 775 storage bootstrap/cache
cd ../public_html
ln -s ../firealert/storage/app/public storage
```

Walang SSH? `-WithVendor` sa build, i-import ang
`deploy/hostinger/reference-data.sql`, at gamitin ang
`deploy/hostinger/tools/storage-link.php` (delete pagkatapos).

Kung may error na `Class "Knuckles\Scribe\Config\AuthIn" not found`, ibig sabihin
luma ang `config/scribe.php` sa server — i-upload ang bago, tapos
`php artisan config:clear`.

---

## Test

- [ ] `https://example.com/up` → 200
- [ ] Login page lumalabas
- [ ] Admin login gumagana
- [ ] Report na may photo → na-submit
- [ ] Profile photo → lumalabas (test ng `storage` symlink)
- [ ] Refresh sa `/dashboard` → hindi 404

May error? Tingnan ang
`firealert/storage/logs/laravel-YYYY-MM-DD.log` at ang
**Websites → Manage site → Error logs**.
