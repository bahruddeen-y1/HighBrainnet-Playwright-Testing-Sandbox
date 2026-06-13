# HighBrainnet — Backend API

> Sprint 1–2 (Project Setup + Database + Auth) เสร็จแล้ว

ระบบหลังบ้านของ HighBrainnet — แพลตฟอร์มคลาสออนไลน์คณิตศาสตร์
อ้างอิงรายละเอียดเชิงระบบ: `../CONTEXT/`

## Tech Stack
- **Runtime:** Node.js 18+
- **Framework:** Express 4
- **ORM:** Prisma 5 + PostgreSQL 14+
- **Auth:** JWT (access + refresh) + bcrypt cost 12
- **Validation:** Zod
- **Logging:** Winston + Morgan
- **Security:** Helmet, CORS, rate limiting

## โครงสร้าง folder
```
backend/
├─ prisma/
│  └─ schema.prisma         # Database schema ทั้งระบบ
├─ src/
│  ├─ config/               # env, prisma client
│  ├─ controllers/          # HTTP layer
│  ├─ middleware/           # auth, errorHandler, rateLimit, validate
│  ├─ routes/               # Express routers
│  ├─ services/             # Business logic
│  ├─ utils/                # tokens, logger, ApiError, fingerprint
│  ├─ validators/           # Zod schemas
│  ├─ app.js
│  └─ server.js
└─ tests/
```

## เริ่มต้นใช้งาน

### 1. ติดตั้ง dependencies
```bash
npm install
```

### 2. ตั้ง PostgreSQL
สร้าง database และ user (ตัวอย่างใช้ Postgres ที่รันบนเครื่อง)
```sql
CREATE USER highbrainnet WITH PASSWORD 'dev_password' CREATEDB;
CREATE DATABASE highbrainnet OWNER highbrainnet;
```

### 3. ตั้งค่า environment
```bash
cp .env.example .env
# แก้ค่า DATABASE_URL, JWT secrets ตามต้องการ
```

ค่าสำคัญ:
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — อย่างน้อย 32 chars (production ใช้ random 64 chars)
- `BCRYPT_COST` — default 12 ตาม SECURITY.md

### 4. Run migration
```bash
npx prisma migrate dev
```

### 5. Start dev server
```bash
npm run dev      # ผ่าน nodemon
# หรือ
npm start
```

Server จะรันที่ `http://localhost:4000` — health check: `GET /api/v1/health`

## API endpoints (ปัจจุบัน)

### System / Auth

| Method | Path | Auth | คำอธิบาย |
|---|---|---|---|
| GET  | `/api/v1/health`           | — | Health check |
| POST | `/api/v1/auth/register`    | — | สมัครสมาชิก (ต้องมี `pdpaConsent: true`) |
| POST | `/api/v1/auth/login`       | — | เข้าสู่ระบบ (kick session เก่าอัตโนมัติ) |
| POST | `/api/v1/auth/refresh`     | — | ขอ access token ใหม่ |
| POST | `/api/v1/auth/logout`      | ✅ | ล้าง session + refresh tokens |
| GET  | `/api/v1/auth/me`          | ✅ | ข้อมูล user ปัจจุบัน |

### Public (Student / Visitor)

| Method | Path | คำอธิบาย |
|---|---|---|
| GET | `/api/v1/levels`                  | 3 ระดับชั้น |
| GET | `/api/v1/courses?level=&levelKey=&q=` | คอร์สที่ visible + ไม่ถูกซ่อน |
| GET | `/api/v1/courses/:slug`           | รายละเอียดคอร์ส + current version |
| GET | `/api/v1/courses/:slug/tree`      | โครงสร้างเต็ม chapter + lesson (เฉพาะ visible) |

### Student (Bearer + enrollment required)

| Method | Path | คำอธิบาย |
|---|---|---|
| GET  | `/api/v1/lessons/:id/play`     | Signed Bunny DRM URL (token + IP lock + 2h expire) |
| POST | `/api/v1/lessons/:id/watch`    | บันทึก `positionSeconds` + auto-complete เมื่อ ≥ 90% |
| GET  | `/api/v1/lessons/:id/progress` | resumeAt, isWatched, isCompleted, completedAt |

### Orders / Payments (Bearer)

| Method | Path | คำอธิบาย |
|---|---|---|
| POST | `/api/v1/orders` (header `Idempotency-Key`) | สร้าง order — items: course / package / upgrade |
| GET  | `/api/v1/orders` | ประวัติคำสั่งซื้อของตัวเอง |
| GET  | `/api/v1/orders/:id` | รายละเอียด + payments |
| POST | `/api/v1/orders/:id/payment` | เรียก GB Prime Pay → QR PromptPay |

### Packages (public + auth-free read)

| Method | Path | คำอธิบาย |
|---|---|---|
| GET | `/api/v1/packages?q=` | ดู package ทั้งหมด พร้อม savings |
| GET | `/api/v1/packages/:slug` | รายละเอียด + courses ภายใน |

### Quizzes (Bearer + enrollment required)

| Method | Path | คำอธิบาย |
|---|---|---|
| GET  | `/api/v1/quizzes/lesson/:lessonId` | quiz ของบทเรียน (pre/post) |
| GET  | `/api/v1/quizzes/course/:courseId` | mock exams ของคอร์ส |
| GET  | `/api/v1/quizzes/:id` | คำถาม (ซ่อนเฉลย) + จำนวนครั้งที่เคยทำ |
| POST | `/api/v1/quizzes/:id/start` | เริ่ม attempt (บันทึกเวลาเริ่มฝั่ง server) |
| POST | `/api/v1/quizzes/:id/submit` | ตรวจอัตโนมัติ + คืนเฉลย/คำอธิบายทันที + บังคับ time limit |
| GET  | `/api/v1/quizzes/:id/results` | ประวัติคะแนนย้อนหลังทุกครั้ง |

Admin: `POST /admin/lessons/:id/quizzes`, `POST /admin/courses/:id/quizzes` (mock exam),
`GET/PATCH/DELETE /admin/quizzes/:id`, `POST /admin/quizzes/:id/questions` (+`/reorder`),
`PATCH/DELETE /admin/questions/:id`

- Question types: `MULTIPLE_CHOICE` (เช็ค key ใน options), `TRUE_FALSE`, `SHORT_ANSWER` (normalize trim+lowercase)
- Mock exam timer บังคับฝั่ง server: เกิน `timeLimitMinutes` + grace 30s → score 0 + `timedOut: true` (ยังเห็นเฉลย)
- ทำซ้ำได้ไม่จำกัด — บันทึก `quiz_results` ทุกครั้ง

### Student dashboard + Badges (Bearer)

| Method | Path | คำอธิบาย |
|---|---|---|
| GET | `/api/v1/me/dashboard` | สถิติรวม + progress ต่อคอร์ส + continue watching + คะแนน quiz ล่าสุด + certificates + **badges** (award อัตโนมัติแบบ lazy + flag `isNew`) |

Badge catalog (8 เหรียญ — เงื่อนไขใน `src/services/badge.service.js`):
ก้าวแรก, นักเรียนขยัน (5 บท), จรวดความรู้ (20 บท), ลองสนาม, คะแนนเต็ม!, มือโปร Quiz (ผ่าน 5), นักสู้สนามสอบ (mock), บัณฑิตน้อย (ใบประกาศ)

### Certificates (Bearer ยกเว้น verify)

| Method | Path | คำอธิบาย |
|---|---|---|
| GET  | `/api/v1/certificates` | ใบประกาศของตัวเอง |
| GET  | `/api/v1/certificates/eligibility/:courseId` | เช็คสิทธิ์ (เรียนครบทุก lesson) + progress |
| POST | `/api/v1/certificates/claim/:courseId` | ออกใบ (idempotent — ซ้ำคืนใบเดิม) |
| GET  | `/api/v1/certificates/:id/pdf` | ดาวน์โหลด PDF (เจ้าของ/admin เท่านั้น) |
| GET  | `/api/v1/certificates/verify/:code` | **public** ตรวจสอบความถูกต้องของใบ |
| GET  | `/api/v1/orders/:id/receipt.pdf` | ใบเสร็จ PDF (PAID เท่านั้น, เจ้าของ/admin) |

PDF ใช้ฟอนต์ Sarabun (ฝังใน `src/assets/fonts/`) — รองรับภาษาไทยเต็มรูปแบบ

### Admin exports (Excel — ครูเท่านั้น)

| Path | Filter |
|---|---|
| `/api/v1/admin/export/sales.xlsx` | `from`, `to`, `courseId` |
| `/api/v1/admin/export/students.xlsx` | — |
| `/api/v1/admin/export/payments.xlsx` | `from`, `to` |
| `/api/v1/admin/export/quiz-scores.xlsx` | `courseId`, `quizId`, `from`, `to` |
| `/api/v1/admin/export/exam-credits.xlsx` | `year` |

### Exam credits — ผลสอบนักเรียน (public)

| Method | Path | คำอธิบาย |
|---|---|---|
| GET | `/api/v1/exam-credits?year=&school=&q=` | รายชื่อผลสอบ (แสดงตาม `displayType` ของแต่ละรายการ — realName/alias) |

### Enrollments (Bearer)

| Method | Path | คำอธิบาย |
|---|---|---|
| GET | `/api/v1/enrollments` | คอร์สที่ตัวเองมี + `hasUpgradeAvailable` + `upgrade` (label + price) |

### Webhook (no auth, signature-verified)

| Method | Path |
|---|---|
| POST | `/api/v1/webhooks/gbprimepay` (header `X-GBPay-Signature` = HMAC-SHA256) |

### Admin orders

| Method | Path |
|---|---|
| GET  | `/api/v1/admin/orders?status=PENDING` |
| GET  | `/api/v1/admin/orders/:id` |
| POST | `/api/v1/admin/orders/:id/approve` (manual fallback) |

### Admin packages

| Method | Path |
|---|---|
| GET / POST | `/api/v1/admin/packages` |
| GET / PATCH / DELETE | `/api/v1/admin/packages/:id` |
| POST | `/api/v1/admin/packages/:id/restore` |
| PUT | `/api/v1/admin/packages/:id/courses` (เปลี่ยน courseIds + recompute originalPrice) |

### Admin enrollments

| Method | Path | คำอธิบาย |
|---|---|---|
| GET    | `/api/v1/admin/enrollments?userId=&courseId=` | filter list |
| POST   | `/api/v1/admin/enrollments` | gift นักเรียนคอร์ส (option `isLifetime`/`expiresAt`) |
| PATCH  | `/api/v1/admin/enrollments/:id` | เปลี่ยน lifetime ↔ expiresAt |
| DELETE | `/api/v1/admin/enrollments/:id` | revoke (soft delete) |

### Admin dashboard

| Method | Path | คำอธิบาย |
|---|---|---|
| GET | `/api/v1/admin/dashboard/summary` | KPI cards (วันนี้/เดือนนี้/รวม, นักเรียนใหม่, pending, catalog) |
| GET | `/api/v1/admin/dashboard/sales-chart?days=30` | time series รายวัน (Asia/Bangkok), เติม 0 วันที่ไม่มียอด |
| GET | `/api/v1/admin/dashboard/top-courses?days=30&limit=3` | คอร์สขายดี (enrollments + revenue) |

### Admin user management

| Method | Path | คำอธิบาย |
|---|---|---|
| GET  | `/api/v1/admin/users?q=&role=&includeSuspended=` | search + filter |
| GET  | `/api/v1/admin/users/:id` | detail + enrollments + orders ล่าสุด 20 |
| POST | `/api/v1/admin/users/:id/suspend`      | ระงับ + kick session + revoke refresh tokens |
| POST | `/api/v1/admin/users/:id/restore`      | un-suspend |
| POST | `/api/v1/admin/users/:id/unlock-device` | reset deviceFingerprint + kick session (สำหรับนักเรียนเปลี่ยนเครื่อง) |

### Admin exam credits

| Method | Path |
|---|---|
| GET / POST | `/api/v1/admin/exam-credits` (admin เห็น realName เสมอ) |
| PATCH / DELETE | `/api/v1/admin/exam-credits/:id` |

### Admin (Bearer + role=ADMIN)

| Method | Path |
|---|---|
| GET / POST / PATCH / DELETE | `/api/v1/admin/courses(/:id)` + `/restore` |
| POST | `/api/v1/admin/courses?includeHidden=&includeDeleted=` (list view) |
| GET / POST | `/api/v1/admin/courses/:courseId/chapters` |
| POST | `/api/v1/admin/courses/:courseId/chapters/reorder` |
| PATCH / DELETE | `/api/v1/admin/chapters/:id` + `/restore` |
| GET / POST | `/api/v1/admin/chapters/:chapterId/lessons` |
| POST | `/api/v1/admin/chapters/:chapterId/lessons/reorder` |
| PATCH / DELETE | `/api/v1/admin/lessons/:id` + `/restore` |
| GET / POST | `/api/v1/admin/courses/:courseId/versions` |
| PATCH / DELETE | `/api/v1/admin/versions/:id` |
| POST | `/api/v1/admin/versions/:id/publish` |
| POST | `/api/v1/admin/lessons/:id/video` — สร้างวิดีโอบน Bunny + return upload URL |
| POST | `/api/v1/admin/lessons/:id/video/sync` — refresh metadata จาก Bunny |
| DELETE | `/api/v1/admin/lessons/:id/video` |

#### Bunny.net config

ตั้งใน `.env`:
```
BUNNY_API_KEY=…              # AccessKey จาก Stream library settings
BUNNY_LIBRARY_ID=…
BUNNY_CDN_HOSTNAME=xxx.b-cdn.net
BUNNY_STREAM_TOKEN_KEY=…     # Security key สำหรับ token-auth (จาก Pull Zone)
# Dev mode:
BUNNY_MOCK=true              # ใช้ค่า fake สำหรับ dev ที่ไม่มี Bunny account
```

#### GB Prime Pay config

```
GBP_MERCHANT_ID=…
GBP_API_KEY=…
GBP_SECRET_KEY=…
GBP_WEBHOOK_SECRET=…   # ใช้ verify HMAC-SHA256(rawBody) ของ header X-GBPay-Signature
GBP_MOCK=true          # dev — accept signature="mock"
```

#### Line Notify

```
LINE_NOTIFY_TOKEN=…    # ถ้าว่าง: log no-op, ระบบยังทำงานปกติ
```

#### Payment Flow

```
Student → POST /orders                  (Order: PENDING)
       → POST /orders/:id/payment       (call GBP → Payment: PENDING, Order: AWAITING_PAYMENT, return QR)
       → สแกน QR จ่ายผ่าน Bank app
GBP    → POST /webhooks/gbprimepay      (verify HMAC, mark PAID + auto-enroll + Line Notify)
                                         duplicate webhook → idempotent no-op

Fallback (webhook ล้ม / ลูกค้า DM slip):
Admin  → POST /admin/orders/:id/approve (manual mark PAID + auto-enroll)
```

### Seed data

```bash
npm run prisma:seed
# Admin default: admin@highbrainnet.local / Admin1234!
```

## คุณสมบัติด้านความปลอดภัยที่ใส่ไว้แล้ว

ตาม `CONTEXT/SECURITY.md`
- [x] bcrypt cost 12
- [x] JWT short-lived access (15m) + refresh token (7d) แบบ rotate + revoke
- [x] Single-device session: login ใหม่ kick session เก่า → token เก่าใช้ไม่ได้
- [x] Device fingerprint จาก UA + Accept-Language + client hash
- [x] Rate limit: global 300/15min, auth endpoints 10/15min
- [x] Helmet (security headers) + CORS whitelist
- [x] PDPA consent field + `pdpaConsentAt` + `pdpaVersion`
- [x] Soft delete fields (`is_deleted`, `deleted_at`) ทุก entity เนื้อหา
- [x] Audit log table (immutable, ใช้สำหรับ payment logs ภายหลัง)
- [x] Centralised error handler ซ่อน stack ใน production

## คำสั่งที่ใช้บ่อย
```bash
npm run dev                # start dev server
npm run prisma:studio      # เปิด UI ดู DB
npm run prisma:migrate     # สร้าง migration ใหม่
npm run prisma:generate    # regenerate client
npm test                   # รัน jest (34 tests)
```

## Testing

Test suite ใช้ database แยก `highbrainnet_test` (สร้างครั้งเดียว):
```sql
CREATE DATABASE highbrainnet_test OWNER highbrainnet;
```
```bash
DATABASE_URL="postgresql://highbrainnet:dev_password@localhost:5432/highbrainnet_test?schema=public" npx prisma migrate deploy
npm test
```

ครอบคลุม (ตาม `../CONTEXT/TESTING.md`):
- **auth.test.js** — PDPA บังคับ, duplicate email, no user enumeration, single-device kick, refresh rotation, logout revoke
- **course.test.js** — RBAC, auto v1.0, slug ไทย, soft delete + restore, tree ordering, reorder ownership, versioning publish/ลบ current ไม่ได้
- **payment.test.js** — idempotency key, webhook signature ปลอม → 401, fulfill + enrollment + access, duplicate webhook idempotent, ซื้อซ้ำ 409, manual approve, package expand, upgrade flow ครบ
- **access.test.js** — 401/403 gating, enrollment expiry, revoke, auto-complete ≥90%, suspend, exam credit masking

## Deploy

ดู [`../DEPLOY.md`](../DEPLOY.md) — Docker Compose (api + postgres + nginx) สำหรับ DigitalOcean droplet

## งานต่อไป (Sprint 15+)
ดู `../CONTEXT/TASKS.md`
- **Sprint 15–16:** Frontend integration — ผูก HTML pages กับ backend
- Slip image upload (เก็บไฟล์ + admin viewer)
- Password reset (email/Line)
- **Sprint 17–18:** QA + UAT + Deploy

Phase 2:
- Quiz / Mock Exam (ตาราง schema มีพร้อมแล้ว)
- Export Excel + PDF reports
- Certificate PDF generation
- Gamification: badges
