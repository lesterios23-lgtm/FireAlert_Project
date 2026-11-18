# FireAlert sa Hostinger — simpleng steps

Sundan lang ang bilang. Walang branch, walang pipiliin.

> Kung **may frontend na sa main domain** at backend lang ang kulang, gamitin ang
> [`SUBDOMAIN.md`](SUBDOMAIN.md) — doon ang tamang steps.

Palitan ang tatlong ito:
- `example.com` → domain mo
- `u123456789` → hosting user mo
- `65002` → port na nakalagay sa SSH Access page

---

## 1. Build (sa PC, sa repo folder)

```powershell
deploy\hostinger\build-release.cmd -Zip
```

Lalabas: `release\firealert.zip` at `release\public_html.zip`

---

## 2. SSH

**Websites → Manage site → SSH Access → Enable**

Kopyahin ang SSH command na nasa card (may copy icon). Ganito ang itsura:

```powershell
ssh -p 65002 u123456789@185.185.185.185
```

Password = FTP password ng domain mo.

---

## 3. PHP

**PHP Configuration → PHP 8.3 → Update**

Tapos **PHP Options** tab:
- `upload_max_filesize` = `20M`
- `post_max_size` = `24M`
- `memory_limit` = `256M`

---

## 4. Database

**Databases → Management → Create a New MySQL Database And Database User → Create**

Isulat ang **name**, **username**, **password**.

---

## 5. Schema

**Databases → phpMyAdmin → Enter phpMyAdmin → Import**

Piliin ang `FireAlert_Backend\database\schema\mysql-schema.sql` → **Go**

Dapat 22 tables.

---

## 6. Backend

```powershell
scp -P 65002 release\firealert.zip u123456789@185.185.185.185:~/domains/example.com/
```

```bash
cd ~/domains/example.com
unzip -o firealert.zip && rm firealert.zip
ls
```

Dapat may `firealert/` at `public_html/`.

---

## 7. `.env`

**File Manager** → buksan ang `firealert/.env` (gawa mula sa `deploy/hostinger/backend.env.production.example`)

Ilagay:
- `APP_URL=https://example.com`
- `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
- `APP_KEY` at `JWT_SECRET` (galing sa PC, tingnan ang README step 7)
- `APP_DEBUG=false`

Click **Deploy**.

---

## 8. Install (SSH)

```bash
cd ~/domains/example.com/firealert
composer2 install --no-dev --optimize-autoloader --no-interaction
php artisan migrate --force
php artisan db:seed --class=ReferenceDataSeeder --force
php artisan optimize
chmod -R 775 storage bootstrap/cache
```

---

## 9. Frontend

```powershell
scp -P 65002 release\public_html.zip u123456789@185.185.185.185:~/domains/example.com/
```

```bash
cd ~/domains/example.com
unzip -o public_html.zip && rm public_html.zip
cd public_html
ln -s ../firealert/storage/app/public storage
ls -la storage
```

---

## 10. Test

| Buksan | Dapat |
|---|---|
| `https://example.com/up` | `up` |
| `https://example.com` | login page |
| Login, submit report na may photo | gumana |
| Profile photo | lumabas |
| Refresh sa `/dashboard` | hindi 404 |

---

Kung may error: copy-paste mo lang sa akin ang mensahe, sasabihin ko agad ang fix.
