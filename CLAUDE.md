# CLAUDE.md — HighBrainnet

Guidance for working in this repo. Read this first; then see `CONTEXT/` for product/spec
detail and `PROGRESS.md` for the dated work log.

## What this is

**HighBrainnet** — an online mathematics class platform for a Hat Yai (Songkhla) tutoring
business. Students buy courses, watch DRM video lessons, take quizzes/mock exams, and the
single teacher/admin manages everything through an admin panel. Target users: ประถมปลาย /
มัธยมต้น / มัธยมปลาย.

- **Backend:** Node.js + Express + Prisma + PostgreSQL (REST API under `/api/v1`)
- **Frontend:** static HTML pages + Tailwind (CDN) + vanilla JS — no build step
- **Brand color:** `#85B2D5` (HighBrainnet Blue)
- **Video:** Bunny.net (DRM) · **Payment:** GB Prime Pay QR PromptPay · **Notify:** Line

## Repo layout

```
/                     student-facing pages (index, courses, course-detail, cart,
                      checkout, login, my-courses, player, quiz, exam-results)
admin/                admin pages (dashboard, courses, course-edit, quiz-creator,
                      payments, reports)
assets/
  css/styles.css      design system (CSS vars incl. --brand) — single source of brand color
  js/api.js           HBN.api — fetch client, auth, session (localStorage 'hbn.session')
  js/cart.js          HBN.cart — localStorage cart ('hbn.cart')
  js/ui.js            HBN.ui — toast, bahts(), levelName(), navbar auth-state rendering
  js/main.js          shared DOM interactions (menu, tabs, modals, lucide icons)
backend/
  src/
    routes/           express routers (index.js mounts all under /api/v1; admin.routes.js
                      is the full ADMIN surface, guarded by requireAuth + requireRole)
    controllers/      thin — parse req, call service, send res
    services/         business logic + all Prisma access
    validators/       zod schemas (used by validate() middleware)
    middleware/       auth, validate, rateLimit, errorHandler
    config/           env.js (zod-validated), prisma.js
  prisma/             schema.prisma, migrations, seed.js
  tests/              jest + supertest (uses a separate test DB via tests/env.js)
CONTEXT/              product spec & design docs (CONTEXT, ARCHITECTURE, TASKS, SECURITY,
                      TESTING, AGENTS, README)
DEPLOY.md, docker-compose.yml, nginx/   deployment
PROGRESS.md           dated work log (what was done, what remains)
```

## Run locally

Postgres must be running on `localhost:5432` (see `backend/.env` → `DATABASE_URL`).
Node v22.

```bash
# Backend (terminal 1) — http://localhost:4000
cd backend
npm install
npm run prisma:migrate     # first time / after schema change
npm run prisma:seed        # creates levels + admin account
npm run dev                # nodemon; or: npm start

# Frontend (terminal 2) — http://localhost:5173
cd <repo root>
python3 -m http.server 5173
# open http://localhost:5173/index.html
```

**⚠️ Serve the frontend on port 5173** (or 3000). The frontend origin must be listed in
`backend/.env` → `CORS_ORIGIN` or every API call is blocked by CORS. Default allows
`http://localhost:5173,http://localhost:3000`. The frontend calls the API at
`http://localhost:4000/api/v1` (override via `window.HBN_API_BASE`).

### Commands

```bash
cd backend
npm test               # jest --runInBand (55 tests). Use this to verify backend changes.
npm run lint           # eslint src
npm run prisma:studio  # browse the DB
npm run prisma:seed    # re-seed levels + admin
```

### Test accounts (dev DB)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@highbrainnet.local` | `Admin1234!` |
| Student (demo, enrolled in math-primary-entrance) | `demo@student.com` | `Demo12345!` |

Register more students at `login.html#signup`. Password policy: min 8 chars.

## Conventions

- **Backend layering:** route → `validate(schema)` → controller → service → Prisma.
  Put logic and all DB access in services; keep controllers thin. Add zod schemas in
  `validators/`. Thai user-facing error messages via `ApiError`.
- **API responses:** lists return `{ items, total, take, skip }`; single resources return a
  named key (`{ course }`, `{ quiz }`, `{ lesson }`…). Errors: `{ error: { message, details } }`.
- **Soft delete:** entities carry `isDeleted` + `deletedAt`. Public reads exclude deleted;
  admin reads (`asAdmin`) include them. Every soft-deletable entity has a `…/restore`
  endpoint. Course versioning is "approach B" (versions + upgrade price).
- **Frontend:** every page loads `api.js, cart.js, ui.js, main.js`. Guard private pages with
  `if (!HBN.api.requireLogin()) return;`. Admin pages check `HBN.api.currentUser().role === 'ADMIN'`.
  Auth-state navbar uses `data-auth-only` / `data-guest-only` / `data-user-name` / `data-logout`
  / `data-cart-badge` (wired by ui.js). New exported `HBN.api.*` methods **must** be added to the
  export object at the bottom of `api.js` (a function defined but not exported = runtime crash).
- **Brand color** lives in TWO places — change both when re-theming:
  1. `assets/css/styles.css` `:root` CSS vars (`--brand`, `--brand-dark`, `--brand-deeper`,
     `--brand-soft`, `--brand-glow`, `--shadow-brand`) + a few inline gradients.
  2. A per-page `tailwind.config` script (right after the Tailwind CDN `<script>`) that remaps
     the `orange-*` utility scale to the brand blue, so inline `orange-*` classes render brand.
     `amber-*` is intentionally kept gold (stars, medals, achievements, warnings); `green/red`
     are semantic (success/error).

## Gotchas (these have bitten us — see PROGRESS.md)

- **Mock mode:** `BUNNY_MOCK=true` and `GBP_MOCK=true` in dev. Video **playback cannot work in
  dev** (mock CDN host `mock.b-cdn.net` is fake → CORS error on the .m3u8); upload/sync flow is
  simulated. QR generation works (mock returns a valid EMVCo string). Real Bunny.net + GB Prime
  Pay credentials are needed for production.
- **QR library:** checkout uses `qrcode@1.5.1/build/qrcode.min.js` from jsDelivr.
  Do NOT use `@1.5.3` — that version has no `build/` dir (404 → blank QR).
- **Auth rate limiting** is real (in-memory). Hammering `/auth/login` returns
  "Too many auth attempts"; restart the backend to reset during testing.
- **Single-device sessions:** logging in elsewhere can kick a session; admin can unlock devices.
- **Static-server caching:** hard-refresh (Cmd/Ctrl+Shift+R) after editing CSS.

## Verifying UI changes

Pattern used here: run backend (mock) + a static server, then drive the real Chrome with
`playwright-core` (`channel:'chrome'`, no Chromium download). Provision a throwaway student via
the register API + admin enrollment to exercise student pages, then delete all of that user's
rows (orders, payments, quiz attempts/results, badges, enrollment, user) to leave the dev DB at
baseline. Don't commit test data.

## Git / GitHub

- Remote: `https://github.com/Bahruddeen4214/e-Learning` (private). Branch: `master`.
- `.gitignore` excludes `node_modules/`, `.env`, `.DS_Store`, `**/.claude/settings.local.json`.
  Never commit `backend/.env` (real secrets) — `.env.example` is the template.
- Commit/push only when asked.
