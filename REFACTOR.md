# Refactor tracking

Phased restructure of `frontend/`, `admin/`, and `backend/`. Do not change production Mongo DB name (`test` on VPS).

## Do-not-break checklist

After each phase, verify:

- [x] `GET /api/items` or `/api/admin-items` returns products (local smoke 200 on :5001)
- [ ] Signup/login + OTP email path (needs EMAIL_* env) — retest on VPS after deploy
- [ ] Cart add/update — retest on VPS after deploy
- [ ] Checkout COD and Instamojo online path — retest on VPS after deploy
- [ ] Instamojo callback URL still reaches backend (watch double `/api` with `SERVER_BASE_URL`)
- [ ] Admin login at `/admin/login` and panel load — local `next build` OK; retest live
- [ ] Shiprocket rate quote (if credentials present)

## Deploy notes

- PM2 process: `ecom-backend` → entry `server.js` (thin bootstrap)
- Production Mongo: `mongodb://127.0.0.1:27017/test`
- Keep `.env` only on server; never commit secrets
- Frontend build: `VITE_API_URL`; Admin: `NEXT_PUBLIC_API_BASE_URL` ending with `/api`

## Backup

- VPS dump location historically: `/root/mongo_backup_*` and `/root/mongo_backup_test.tgz`
- Local copy: `mongo_backup_test.tgz` in repo root (gitignored)

## Phases

0. Safety rails (this file) — done
1. Backend: config, models, middleware, utils — done (`src/config`, `src/models`, `src/middleware`, `src/utils`)
2. Backend: services + routes — done (`services/email.js`, `services/instamojo.js`, `src/routes/*`; thin `server.js` → `src/app.js`)
3. Frontend: api + auth + Checkout split — done
4. Frontend: product cache + routes/layout — done (lazy Checkout/Profile)
5. Admin: api-client + panel split — done
6. Admin: dashboard nested routes — done (`/admin/dashboard/*`, soft `/pannel` redirect)

Monolith backup before route split: `backend/server.pre-split.js.bak` (gitignored).
