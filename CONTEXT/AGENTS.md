# HighBrainnet — Playwright Testing Sandbox

> ต้นแบบระบบคลาสออนไลน์คณิตศาสตร์ที่สร้างด้วย **Claude Code**
> ปรับมาใช้เป็น **สนามฝึกเขียน E2E Test ด้วย Playwright**
>
> ⚠️ **โปรเจกต์นี้ไม่ใช่ระบบ Production** ไม่มีการชำระเงินจริง ไม่ส่งการแจ้งเตือนจริง และข้อมูลทั้งหมดเป็นข้อมูลทดสอบ

---

## 📌 สารบัญ

1. [เกี่ยวกับโปรเจกต์](#1-เกี่ยวกับโปรเจกต์)
2. [Tech Stack](#2-tech-stack)
3. [เริ่มต้นใช้งาน](#3-เริ่มต้นใช้งาน)
4. [บัญชีสำหรับทดสอบ](#4-บัญชีสำหรับทดสอบ)
5. [ฟีเจอร์ที่ใช้ฝึกทดสอบ](#5-ฟีเจอร์ที่ใช้ฝึกทดสอบ)
6. [External Services ที่ถูก Mock](#6-external-services-ที่ถูก-mock)
7. [การรัน Playwright Tests](#7-การรัน-playwright-tests)
8. [โครงสร้างโฟลเดอร์](#8-โครงสร้างโฟลเดอร์)
9. [แนวทางการเขียนเทส](#9-แนวทางการเขียนเทส)
10. [เอกสารที่เกี่ยวข้อง](#10-เอกสารที่เกี่ยวข้อง)

---

## 1. เกี่ยวกับโปรเจกต์

**HighBrainnet** เป็นระบบ LMS (Learning Management System) จำลองสำหรับคลาสคณิตศาสตร์ระดับประถมปลายถึงมัธยมปลาย

ตอนแรกออกแบบไว้เป็นระบบจริงสำหรับลูกค้า ตอนนี้ปรับมาใช้เพื่อ:

- 🎯 ฝึกเขียน **E2E Test** ด้วย Playwright บนแอปที่ซับซ้อนพอ ๆ กับงานจริง
- 🧪 ฝึกทดสอบ flow ที่พบบ่อยในงานจริง ได้แก่ Auth, Form, Upload, Payment, Role-based access
- 📚 ใช้เป็น reference สำหรับวางโครงสร้าง test project (POM, Fixtures, CI)

---

## 2. Tech Stack

| Layer    | Technology                   |
| -------- | ---------------------------- |
| Frontend | `<เช่น Next.js / React>`     |
| Backend  | `<เช่น Node.js / Express>`   |
| Database | `<เช่น PostgreSQL / SQLite>` |
| Testing  | Playwright (TypeScript)      |
| Runtime  | Node.js 18+                  |

---

## 3. เริ่มต้นใช้งาน

### Prerequisites

- Node.js 18 ขึ้นไป
- Git
- `<Database ที่ใช้ ถ้ามี>`

### ติดตั้ง

```bash
# 1. Clone โปรเจกต์
git clone <repo-url>
cd highbrainnet

# 2. ติดตั้ง dependencies
npm install

# 3. ติดตั้ง browser ของ Playwright
npx playwright install

# 4. ตั้งค่า environment
cp .env.example .env

# 5. สร้างข้อมูลทดสอบ (seed)
npm run db:seed

# 6. รันแอป
npm run dev
```

เปิดแอปที่ `http://localhost:<port>`

### Environment Variables

| ตัวแปร            | ค่าตัวอย่าง             | คำอธิบาย                                                       |
| ----------------- | ----------------------- | -------------------------------------------------------------- |
| `BASE_URL`        | `http://localhost:3000` | URL ที่ Playwright ใช้ทดสอบ                                    |
| `MOCK_PAYMENT`    | `true`                  | ใช้ payment จำลองแทน GB Prime Pay                              |
| `MOCK_NOTIFY`     | `true`                  | บันทึกการแจ้งเตือนลง log แทนการส่งจริง                         |
| `ENABLE_TEST_API` | `true`                  | เปิด endpoint สำหรับ reset/seed ข้อมูล (ห้ามเปิดใน production) |

---

## 4. บัญชีสำหรับทดสอบ

> ข้อมูลเหล่านี้สร้างจาก `npm run db:seed`

| Role                     | Email                 | Password       | ใช้ทดสอบ                        |
| ------------------------ | --------------------- | -------------- | ------------------------------- |
| Admin (ครู)              | `admin@test.local`    | `Admin@1234`   | Dashboard, approve, จัดการคอร์ส |
| Student (ซื้อคอร์สแล้ว)  | `student1@test.local` | `Student@1234` | ดูวิดีโอ, resume, quiz          |
| Student (ยังไม่ซื้อ)     | `student2@test.local` | `Student@1234` | การซื้อคอร์ส, การจำกัดสิทธิ์    |
| Student (ถูกล็อกอุปกรณ์) | `locked@test.local`   | `Student@1234` | Single device login             |

---

## 5. ฟีเจอร์ที่ใช้ฝึกทดสอบ

### 🟢 ระดับพื้นฐาน

| ฟีเจอร์                                            | ตัวอย่าง Test Case                                      |
| -------------------------------------------------- | ------------------------------------------------------- |
| สมัครสมาชิก + PDPA consent                         | สมัครโดยไม่ติ๊ก consent ต้องไม่ผ่าน, validate email ซ้ำ |
| Login / Logout                                     | login ผิด, login ถูก, session หมดอายุ                   |
| โครงสร้างคอร์ส (Level → Course → Chapter → Lesson) | navigate ตามลำดับ, breadcrumb ถูกต้อง                   |
| Soft delete                                        | ลบแล้วหายจากหน้าบ้าน แต่ admin ยังกู้คืนได้             |

### 🟡 ระดับกลาง

| ฟีเจอร์                            | ตัวอย่าง Test Case                                     |
| ---------------------------------- | ------------------------------------------------------ |
| Video player + resume watching     | ดูถึงนาทีที่ 2 → ออก → กลับมาต้องเล่นต่อจากเดิม        |
| QR PromptPay + manual approve      | นักเรียนแจ้งโอน → admin approve → นักเรียนเข้าคอร์สได้ |
| Admin upload วิดีโอ + progress bar | อัปโหลดไฟล์, เช็ก progress, ยกเลิกกลางทาง              |
| Role-based access                  | student เข้าหน้า `/admin` ต้องถูกปฏิเสธ                |
| Quiz + mock exam timer             | หมดเวลาแล้วต้องส่งคำตอบอัตโนมัติ (ใช้ `page.clock`)    |

### 🔴 ระดับสูง

| ฟีเจอร์                             | ตัวอย่าง Test Case                                                 |
| ----------------------------------- | ------------------------------------------------------------------ |
| Single device login                 | ใช้ 2 `browser.newContext()` login พร้อมกัน → อุปกรณ์แรกต้องหลุด   |
| Course versioning + upgrade pricing | มีคอร์ส v1 แล้วอัปเกรดเป็น v2 ต้องคิดราคาส่วนต่างถูก               |
| Certificate PDF download            | ดาวน์โหลดไฟล์ผ่าน `page.waitForEvent('download')` แล้วตรวจชื่อไฟล์ |
| Export Excel/CSV                    | ตรวจเนื้อหาไฟล์ที่ export ออกมา                                    |
| Badge / Gamification                | เรียนครบตามเงื่อนไขแล้วต้องได้ badge                               |

---

## 6. External Services ที่ถูก Mock

บริการภายนอกทุกตัวถูกแทนด้วย mock เพื่อให้ผลเทสคงที่และไม่ต้องใช้บัญชีจริง

| Service เดิม                | วิธี Mock                                   | หมายเหตุ                                          |
| --------------------------- | ------------------------------------------- | ------------------------------------------------- |
| GB Prime Pay / QR PromptPay | Mock endpoint `/api/mock/payment`           | ใช้ปุ่ม "จำลองการโอนสำเร็จ/ล้มเหลว"               |
| Line Notify                 | เขียนลง log/ตาราง `notifications`           | Line Notify ปิดให้บริการแล้วตั้งแต่ 31 มี.ค. 2025 |
| Bunny.net Video CDN         | ใช้ไฟล์วิดีโอสั้นใน `/public/sample-videos` | ไม่มี DRM จริง                                    |

> 💡 ฝึกเพิ่มได้ด้วย `page.route()` เพื่อจำลองกรณี API ล่ม, ตอบช้า หรือตอบ error

---

## 7. การรัน Playwright Tests

```bash
# รันเทสทั้งหมด (headless)
npx playwright test

# รันแบบ UI mode (แนะนำตอนฝึก)
npx playwright test --ui

# รันเฉพาะไฟล์ / เฉพาะ browser
npx playwright test tests/auth.spec.ts
npx playwright test --project=chromium

# รันแบบเห็นหน้าจอ + debug
npx playwright test --headed
npx playwright test --debug

# เปิดรายงานผล
npx playwright show-report

# อัดเทสอัตโนมัติด้วย Codegen
npx playwright codegen http://localhost:<port>
```

### Reset ข้อมูลก่อนรันเทส

```bash
npm run db:reset    # ล้างและ seed ข้อมูลใหม่
```

หรือเรียกจากเทสผ่าน `POST /api/test/reset` (ใช้ได้เมื่อ `ENABLE_TEST_API=true` เท่านั้น)

---

## 8. โครงสร้างโฟลเดอร์

```
highbrainnet/
├── src/                    # Source code ของแอป
├── tests/
│   ├── e2e/                # Test specs แยกตามฟีเจอร์
│   │   ├── auth.spec.ts
│   │   ├── course.spec.ts
│   │   ├── payment.spec.ts
│   │   └── admin.spec.ts
│   ├── pages/              # Page Object Models
│   ├── fixtures/           # Custom fixtures (เช่น loggedInStudent)
│   ├── data/               # Test data / ไฟล์สำหรับ upload
│   └── auth.setup.ts       # สร้าง storageState สำหรับแต่ละ role
├── playwright.config.ts
├── .env.example
└── README.md
```

---

## 9. แนวทางการเขียนเทส

- **Locator:** ใช้ `getByRole`, `getByLabel`, `getByText` ก่อน ถ้าไม่ได้จริง ๆ ค่อยใช้ `getByTestId` (แอปนี้ใช้ attribute `data-testid`)
- **Auth:** login ครั้งเดียวใน `auth.setup.ts` แล้วเก็บ `storageState` ไว้ จะได้ไม่ต้อง login ใหม่ทุกเทส
- **Page Object Model:** แยก locator และ action ของแต่ละหน้าไว้ใน `tests/pages/`
- **Isolation:** แต่ละเทสต้องรันแยกได้ ไม่ขึ้นกับลำดับหรือผลของเทสอื่น
- **ห้ามใช้ `waitForTimeout`:** ใช้ auto-waiting และ web-first assertions (`await expect(...).toBeVisible()`) แทน
- **ตั้งชื่อเทส:** อธิบายพฤติกรรมที่คาดหวัง เช่น `test('นักเรียนที่ยังไม่ซื้อคอร์สไม่สามารถเปิดบทเรียนได้')`

---

## 10. เอกสารที่เกี่ยวข้อง

| เอกสาร                               | เนื้อหา                                |
| ------------------------------------ | -------------------------------------- |
| [TESTING.md](./TESTING.md)           | Test plan และรายการ test case ทั้งหมด  |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | สถาปัตยกรรมระบบและโครงสร้างข้อมูล      |
| [CONTEXT.md](./CONTEXT.md)           | บริบทและ requirement เดิมของโปรเจกต์   |
| [TASKS.md](./TASKS.md)               | รายการงานและความคืบหน้า                |
| [SECURITY.md](./SECURITY.md)         | มาตรการความปลอดภัย (อ้างอิงจากแผนเดิม) |

---

## ⚠️ Disclaimer

โปรเจกต์นี้สร้างขึ้นเพื่อ **การเรียนรู้และฝึกทดสอบซอฟต์แวร์เท่านั้น**

- ไม่มีการเชื่อมต่อระบบชำระเงินจริง
- ข้อมูลผู้ใช้ทั้งหมดเป็นข้อมูลสมมติ
- บางฟีเจอร์อาจทำงานไม่สมบูรณ์หรือมี bug ซึ่งเหมาะกับการฝึกหาและรายงาน bug
