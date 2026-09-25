# Render Deployment Guide — PUPBC CareLink

Setup: **Render Free** (backend = Docker, frontend = Static Site) + **Supabase Postgres** + **Brevo SMTP**.

| Service | Render name | URL |
|---|---|---|
| Backend (Laravel 8, Docker, Singapore) | `pupbc-carelink-api` | `https://pupbc-carelink-api.onrender.com` |
| Frontend (React/Vite, static CDN) | `pupbc-carelink` | `https://pupbc-carelink.onrender.com` |

Lahat ng config ay nasa [`render.yaml`](../render.yaml).

---

## Step 1 — Supabase

1. **Palitan ang database password** (na-leak ito sa lumang git history):
   Project Settings → Database → **Reset database password**. I-save ang bagong password.
2. Pindutin ang **Connect** (itaas ng dashboard) → **Session pooler**. I-check:
   - Host: `aws-0-ap-southeast-2.pooler.supabase.com` (kung iba, palitan ang `DB_HOST` sa `render.yaml`)
   - Port: `5432`
   - User: `postgres.nwfltsdypjmqbsnuoccy`
3. **Table Editor** → may `users` at `migrations` table na ba? May row na ba na `role = nurse`?
   - Oo → hindi na kailangang mag-seed (laktawan ang Step 6).
   - Wala → gagawin ng deploy ang tables; mag-seed sa Step 6.

## Step 2 — Brevo (email)

Bina-block ng Render Free ang SMTP ports 25/465/587, kaya Brevo sa port **2525** ang gamit.

1. Mag-sign up sa [brevo.com](https://www.brevo.com) (Free plan, 300 emails/day).
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender**: `pupbinancarelink@gmail.com`. I-click ang verification link na papasok sa Gmail na iyon.
3. **SMTP & API → SMTP** tab → **Generate a new SMTP key**. Kopyahin:
   - **Login** (hal. `xxxxxx@smtp-brevo.com`) → `MAIL_USERNAME`
   - **SMTP key** → `MAIL_PASSWORD`

## Step 3 — APP_KEY

Sa terminal (Node lang ang kailangan):

```bash
node -e "console.log('base64:'+require('crypto').randomBytes(32).toString('base64'))"
```

Kopyahin ang buong output (kasama ang `base64:`).

## Step 4 — Bagong GitHub repo (walang lumang history)

1. GitHub → **New repository** → pangalan hal. `pupbc-carelink` → **Private** → huwag lagyan ng README.
2. Sa project folder:

```bash
git checkout --orphan deploy
git add -A
git commit -m "PUPBC CareLink initial commit"
git remote add deploy https://github.com/<USERNAME>/pupbc-carelink.git
git push deploy deploy:main
```

Sa bagong repo, 1 commit lang, kaya hindi kasama ang lumang password. Ang lumang `main` mo ay nasa local pa rin.
Sa susunod na update: mag-commit sa `deploy` branch at `git push deploy deploy:main`. Automatic magre-redeploy ang Render.

## Step 5 — Render Blueprint

1. [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint** → i-connect ang GitHub → piliin ang bagong repo.
2. Hihingin ng Render ang mga `sync: false` values:

| Key | Value |
|---|---|
| `APP_KEY` | output ng Step 3 |
| `DB_USERNAME` | `postgres.nwfltsdypjmqbsnuoccy` |
| `DB_PASSWORD` | bagong Supabase password (Step 1) |
| `MAIL_USERNAME` | Brevo SMTP login |
| `MAIL_PASSWORD` | Brevo SMTP key |
| `SEED_NURSE_PASSWORD` | malakas na password para sa nurse account |

`JWT_SECRET` at `KIOSK_DEVICE_TOKEN` ay automatic na gine-generate.

3. **Apply**. Mga 5–10 min ang unang build ng backend.
4. Kung **iba ang URL** na binigay ng Render (kapag taken na ang pangalan), i-update:
   - Frontend → Environment → `VITE_API_URL` = `https://<backend-url>/api` → **Save, rebuild, and deploy**
   - Backend → Environment → `APP_URL`, `FRONTEND_URL`, `SANCTUM_STATEFUL_DOMAINS`

## Step 6 — Seed (kung empty ang DB lang)

Walang Shell ang Render Free, kaya:

1. Backend → **Environment** → Add `SEED_ON_BOOT` = `true` → Save (magre-redeploy).
2. Kapag **Live** na, **burahin ang `SEED_ON_BOOT`** → Save. (Kung hindi, mare-reset ang nurse password sa bawat restart.)

Gumagawa ang seeder ng:
- Nurse: `nurse@pupbc.edu.ph` / `SEED_NURSE_PASSWORD`
- Demo student: `2021-00001-BN-0` / birthday `2002-05-15` / `student`

## Step 7 — I-check

1. `https://pupbc-carelink-api.onrender.com/api/health` → dapat `"database": "connected"`.
2. `https://pupbc-carelink.onrender.com` → dapat lumabas ang landing page.
3. Nurse login sa `/carelink-portal`.
4. Mag-register ng student → dapat may OTP email.
5. Kiosk: Backend → Environment → kopyahin ang `KIOSK_DEVICE_TOKEN` → ilagay sa kiosk page kapag hiningi.

---

## Troubleshooting

| Problema | Ayos |
|---|---|
| Unang request ay mabagal o nag-timeout | Natutulog ang Free backend pagkatapos ng 15 min; ~1 min bago magising. I-refresh. |
| `"database": "down"` | Mali ang `DB_USERNAME`/`DB_PASSWORD`/`DB_HOST`. Tingnan ang **Logs** ng backend. |
| Walang OTP email | Na-verify ba ang sender sa Brevo? Tama ba ang SMTP login/key? Tingnan ang Brevo → Transactional → Logs. |
| 404 kapag nag-refresh sa `/login` | Dapat may `routes` rewrite sa `render.yaml` (meron na). |
| CORS error | Dapat tama ang `FRONTEND_URL`. Pinapayagan na rin ang lahat ng `*.onrender.com`. |
| Kiosk: "not configured" (503) | Walang `KIOSK_DEVICE_TOKEN` sa backend env. |
| Nawala ang profile pictures | Ephemeral ang disk ng Render Free; nabubura ang uploads sa redeploy o restart. Known limitation. |

## Bakit ganito ang setup

- **Docker backend**: walang native PHP runtime ang Render.
- **`--no-reload` sa `php artisan serve`**: kung wala ito, binabasa ng Laravel 8 serve ang `.env` imbes na ang Render env vars.
- **Port 5432 (session pooler)**: iwas sa prepared-statement errors ng transaction pooler (6543) sa Laravel/PDO.
- **Singapore**: pinakamalapit na Render region sa Supabase (Sydney); walang Render region sa Australia.
- **Static site frontend**: libre, hindi natutulog, nasa CDN.
- **`migrate --force` sa bawat boot**: walang pre-deploy step ang Render Free, at kailangang sabay ang bagong code at schema (hal. `users.status` na `active` → `NULL`). **Babala:** kung may teammate na gumagamit ng parehong Supabase gamit ang lumang code, hindi na siya makaka-login bilang nurse pagkatapos ng migration. I-update muna ang code nila.
- **Auto-expire ng appointments**: walang cron sa Render Free, kaya ang unang API request ng araw ang nag-e-expire ng mga lumang pending appointment (`ExpireStaleAppointments` middleware).
- **`EMAIL_TEST_MODE=false`**: kapag `true`, lahat ng email ay napupunta sa `EMAIL_TEST_RECIPIENT` (pang-staging lang).
