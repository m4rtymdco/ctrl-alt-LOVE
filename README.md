# Ctrl + Alt + Love

Spotify-style music player. Admins upload songs plus a live photo (image, GIF, or short video). Users play tracks with that artwork.

The same MySQL database works on **XAMPP localhost** and on **Vercel** (point Vercel at a cloud MySQL host — Vercel cannot reach your PC’s XAMPP).

## XAMPP (local)

1. Start **Apache** and **MySQL** in the XAMPP Control Panel.
2. Open phpMyAdmin: http://localhost/phpmyadmin
3. Import `database/schema.sql` (creates `ctrl_alt_love` and 3 demo tracks).
4. Open the app: http://localhost/ctrl+alt+love/
5. Click **User** → enter admin password `ctrlaltlove` to add music and live photos.

If MySQL has a password, edit `php/config.php`.

If large uploads fail, raise `upload_max_filesize` and `post_max_size` in `C:\xampp\php\php.ini` (for example `32M`) and restart Apache.

## Vercel (live)

Vercel runs the Node APIs in `api/`. Create a **cloud MySQL** (Aiven, Railway, PlanetScale, TiDB Cloud, or any host) and import the same `database/schema.sql`.

```bash
npm install
npx vercel
```

In the Vercel project settings, add:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASS`
- `ADMIN_PASSWORD`

Vercel request bodies are limited (~4.5 MB). Keep uploaded audio/photos small on the live site, or use a larger PHP host for big files.

## Admin

Default password: `ctrlaltlove`  
Change it in `php/config.php` locally and in Vercel env vars for production.
