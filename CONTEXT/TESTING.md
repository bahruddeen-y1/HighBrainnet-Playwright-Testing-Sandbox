# HighBrainnet — Playwright Test Plan

> **TESTING.md** — แผนการทดสอบ E2E และ API ด้วย Playwright
> ใช้คู่กับ [README.md](./README.md)

---

## 📌 สารบัญ

1. [ขอบเขตการทดสอบ](#1-ขอบเขตการทดสอบ)
2. [Test Environment และ Test Data](#2-test-environment-และ-test-data)
3. [กลยุทธ์และการจัดกลุ่มเทส](#3-กลยุทธ์และการจัดกลุ่มเทส)
4. [E2E Test Cases](#4-e2e-test-cases)
5. [API Test Cases](#5-api-test-cases)
6. [Security Test Cases](#6-security-test-cases)
7. [Cross-browser และ Device Testing](#7-cross-browser-และ-device-testing)
8. [Performance Checks](#8-performance-checks)
9. [ตัวอย่างโค้ดสำหรับเคสยาก](#9-ตัวอย่างโค้ดสำหรับเคสยาก)
10. [การรายงานผลและ CI](#10-การรายงานผลและ-ci)

---

## 1. ขอบเขตการทดสอบ

### ✅ ทดสอบด้วย Playwright

| ประเภท                       | เครื่องมือใน Playwright                 |
| ---------------------------- | --------------------------------------- |
| E2E (UI flow ของผู้ใช้จริง)  | `page`, `browser.newContext()`          |
| API Testing                  | `request` fixture / `APIRequestContext` |
| Security (ระดับพื้นฐาน)      | `request`, `page.route()`               |
| Cross-browser / Mobile       | `projects` + `devices`                  |
| Performance (ระดับเบื้องต้น) | Navigation Timing API, วัดเวลา response |

### ❌ อยู่นอกขอบเขต

| ประเภท                                 | เหตุผล                               | เครื่องมือที่เหมาะกว่า |
| -------------------------------------- | ------------------------------------ | ---------------------- |
| Unit test ของ backend/database         | ไม่ใช่งานของ E2E tool                | Vitest / Jest          |
| Load test (เช่น 50 คนดูวิดีโอพร้อมกัน) | Playwright ไม่ได้ออกแบบมาสำหรับ load | k6 / Artillery         |
| DRM จริง, Bunny.net, GB Prime Pay จริง | ใช้ mock ทั้งหมด                     | —                      |
| N+1 query                              | ต้องดูจากฝั่ง server                 | Query log / APM        |

---

## 2. Test Environment และ Test Data

### Environment

```bash
BASE_URL=http://localhost:3000
MOCK_PAYMENT=true
MOCK_NOTIFY=true
ENABLE_TEST_API=true
```

### บัญชีทดสอบ (จาก `npm run db:seed`)

| Role                     | Email                 | Password       | storageState                     |
| ------------------------ | --------------------- | -------------- | -------------------------------- |
| Admin (ครู)              | `admin@test.local`    | `Admin@1234`   | `playwright/.auth/admin.json`    |
| Student (ซื้อคอร์สแล้ว)  | `student1@test.local` | `Student@1234` | `playwright/.auth/student1.json` |
| Student (ยังไม่ซื้อ)     | `student2@test.local` | `Student@1234` | `playwright/.auth/student2.json` |
| Student (ถูกล็อกอุปกรณ์) | `locked@test.local`   | `Student@1234` | — (login สดในเทส)                |

> ⚠️ เพิ่ม `playwright/.auth/` ลงใน `.gitignore`

### การจัดการข้อมูล

- **ก่อนรันทั้งชุด:** เรียก `POST /api/test/reset` ใน `globalSetup` หรือใน setup project
- **เทสที่สร้างข้อมูลใหม่** เช่น สมัครสมาชิก: ใช้ข้อมูลไม่ซ้ำ เช่น `` `user_${Date.now()}@test.local` ``
- **เทสที่แก้ไข state** เช่น single device หรือ approve: ใช้บัญชีแยกเฉพาะเทสนั้น หรือ reset ใน `beforeEach`

---

## 3. กลยุทธ์และการจัดกลุ่มเทส

### Tags

| Tag           | ความหมาย                        | ใช้เมื่อไร           |
| ------------- | ------------------------------- | -------------------- |
| `@smoke`      | flow หลักที่ต้องผ่านเสมอ        | ทุก commit           |
| `@regression` | เคสครบทั้งหมด                   | ก่อน merge / nightly |
| `@security`   | เคสด้านความปลอดภัย              | nightly              |
| `@mobile`     | เคสที่ต้องรันบน mobile viewport | ตามต้องการ           |

```ts
test('login สำเร็จ', { tag: ['@smoke'] }, async ({ page }) => { ... });
```

```bash
npx playwright test --grep @smoke
npx playwright test --grep-invert @security
```

### Priority

- **P1:** flow ที่ทำเงินหรือบล็อกการใช้งาน (login, ซื้อคอร์ส, เข้าเรียน)
- **P2:** ฟีเจอร์หลักที่ใช้บ่อย
- **P3:** ฟีเจอร์เสริม / edge case

---

## 4. E2E Test Cases

> คอลัมน์ "เทคนิค" คือ API ของ Playwright ที่ควรใช้หรือฝึกในเคสนั้น

### 4.1 Auth และ PDPA — `tests/e2e/auth.spec.ts`

| ID      | Scenario                                 | Expected                                        | เทคนิค                    |  P  |
| ------- | ---------------------------------------- | ----------------------------------------------- | ------------------------- | :-: |
| AUTH-01 | สมัครสมาชิกด้วยข้อมูลถูกต้อง + ติ๊ก PDPA | สมัครสำเร็จ เข้าหน้า dashboard                  | `getByLabel`, `toHaveURL` | P1  |
| AUTH-02 | สมัครโดยไม่ติ๊ก PDPA consent             | ปุ่มสมัคร disabled หรือแสดง error               | `toBeDisabled`            | P1  |
| AUTH-03 | สมัครด้วย email ที่มีอยู่แล้ว            | แสดง error "email ถูกใช้แล้ว"                   | `toBeVisible`             | P2  |
| AUTH-04 | สมัครด้วยรูปแบบ email/รหัสผ่านไม่ถูกต้อง | แสดง validation error ตรง field                 | Data-driven (`for...of`)  | P2  |
| AUTH-05 | Login ด้วยข้อมูลถูกต้อง                  | เข้า dashboard ตาม role                         | `@smoke`                  | P1  |
| AUTH-06 | Login ด้วยรหัสผ่านผิด                    | แสดง error ไม่บอกว่าผิดที่ email หรือ password  | `toHaveText`              | P1  |
| AUTH-07 | Logout                                   | กลับหน้า login, กด back แล้วต้องไม่เห็นหน้าเดิม | `page.goBack()`           | P2  |
| AUTH-08 | Session หมดอายุ                          | redirect ไปหน้า login                           | `context.clearCookies()`  | P2  |

### 4.2 โครงสร้างคอร์สและสิทธิ์เข้าถึง — `tests/e2e/course.spec.ts`

| ID     | Scenario                                          | Expected                           | เทคนิค                  |  P  |
| ------ | ------------------------------------------------- | ---------------------------------- | ----------------------- | :-: |
| CRS-01 | Navigate Level → Course → Chapter → Lesson        | breadcrumb และ URL ถูกต้องทุกระดับ | `test.step`             | P2  |
| CRS-02 | นักเรียนที่ซื้อแล้วเปิดบทเรียน                    | เห็นวิดีโอและเนื้อหา               | storageState `student1` | P1  |
| CRS-03 | นักเรียนที่ยังไม่ซื้อเปิดบทเรียน                  | เห็นหน้า "กรุณาซื้อคอร์ส"          | storageState `student2` | P1  |
| CRS-04 | ผู้ที่ยังไม่ login เข้า URL บทเรียนตรง ๆ          | redirect ไปหน้า login              | context ว่าง            | P1  |
| CRS-05 | นักเรียนเปิดบทเรียนของคอร์ส version ที่ไม่ได้ซื้อ | ถูกปฏิเสธ                          | `page.goto` ตรง         | P2  |

### 4.3 Video Player — `tests/e2e/video.spec.ts`

| ID     | Scenario                      | Expected                           | เทคนิค                         |  P  |
| ------ | ----------------------------- | ---------------------------------- | ------------------------------ | :-: |
| VID-01 | กดเล่นวิดีโอ                  | วิดีโอเล่นได้ (`paused === false`) | `locator.evaluate()`           | P1  |
| VID-02 | ดูถึงนาทีที่ 2 → ออก → กลับมา | เล่นต่อจากประมาณ 120 วินาที        | `evaluate` + `waitForResponse` | P2  |
| VID-03 | Progress ถูกบันทึกลง server   | มี request ไป `/api/progress`      | `waitForRequest`               | P2  |
| VID-04 | วิดีโอโหลดไม่สำเร็จ           | แสดงข้อความ error ที่เข้าใจได้     | `page.route()` abort           | P3  |

> 💡 Chromium ของ Playwright ไม่รองรับ codec H.264/AAC ให้ใช้ไฟล์ `.webm` ใน `/public/sample-videos` หรือรันด้วย `channel: 'chrome'`

### 4.4 Payment (Mock) — `tests/e2e/payment.spec.ts`

| ID     | Scenario                                                                           | Expected                              | เทคนิค                       |  P  |
| ------ | ---------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------- | :-: |
| PAY-01 | Flow เต็ม: เลือกคอร์ส → QR → จำลองโอนสำเร็จ → admin approve → นักเรียนเข้าเรียนได้ | เข้าเรียนได้                          | 2 contexts (student + admin) | P1  |
| PAY-02 | จำลองการโอนล้มเหลว                                                                 | แสดงสถานะล้มเหลว + ปุ่มลองใหม่        | ปุ่มบนหน้า mock              | P1  |
| PAY-03 | Webhook ล้มเหลว → admin approve เองได้                                             | approve manual สำเร็จ                 | `page.route()`               | P2  |
| PAY-04 | กดชำระเงินซ้ำ 2 ครั้ง                                                              | สร้าง order แค่ 1 รายการ              | `dblclick` / ตรวจผ่าน API    | P2  |
| PAY-05 | หลังชำระสำเร็จ admin ได้รับแจ้งเตือน                                               | มีรายการในตาราง `notifications`       | ตรวจผ่าน API                 | P3  |
| PAY-06 | QR หมดอายุ                                                                         | แสดงข้อความหมดอายุ + สร้าง QR ใหม่ได้ | `page.clock`                 | P3  |

### 4.5 Single Device Login — `tests/e2e/device.spec.ts`

| ID     | Scenario                          | Expected                            | เทคนิค                          |  P  |
| ------ | --------------------------------- | ----------------------------------- | ------------------------------- | :-: |
| DEV-01 | Login อุปกรณ์ A → login อุปกรณ์ B | อุปกรณ์ A ถูก kick พร้อมข้อความแจ้ง | 2 `browser.newContext()`        | P1  |
| DEV-02 | บัญชีที่ถูกล็อก login             | แสดงข้อความ "ติดต่อครูเพื่อปลดล็อก" | บัญชี `locked@`                 | P2  |
| DEV-03 | ครู unlock → นักเรียน login ใหม่  | login สำเร็จ                        | admin context + student context | P2  |

### 4.6 Admin — `tests/e2e/admin.spec.ts`

| ID     | Scenario                           | Expected                                          | เทคนิค                     |  P  |
| ------ | ---------------------------------- | ------------------------------------------------- | -------------------------- | :-: |
| ADM-01 | สร้างคอร์สใหม่ + บท + บทเรียน      | แสดงในหน้าบ้านถูกต้อง                             | POM `CourseEditorPage`     | P1  |
| ADM-02 | อัปโหลดวิดีโอ                      | progress bar ขึ้นจนถึง 100% และวิดีโอแสดงในรายการ | `setInputFiles`            | P2  |
| ADM-03 | ยกเลิกการอัปโหลดกลางทาง            | ไม่มีวิดีโอค้างในระบบ                             | `setInputFiles` + กดยกเลิก | P3  |
| ADM-04 | อัปโหลดไฟล์ผิดประเภท (เช่น `.exe`) | ถูกปฏิเสธ                                         | `tests/data/invalid.exe`   | P2  |
| ADM-05 | Dashboard KPI                      | ตัวเลขตรงกับ seed data                            | `toHaveText`               | P3  |
| ADM-06 | กรอกเครดิตสอบติด (ชื่อจริง/นามแฝง) | หน้าสาธารณะแสดงชื่อตามที่เลือก                    | admin → public page        | P3  |

### 4.7 Soft Delete — `tests/e2e/soft-delete.spec.ts`

| ID     | Scenario                              | Expected                    | เทคนิค      |  P  |
| ------ | ------------------------------------- | --------------------------- | ----------- | :-: |
| DEL-01 | Admin ลบบทเรียน                       | หายจากหน้านักเรียน          | 2 contexts  | P2  |
| DEL-02 | Admin restore บทเรียน                 | กลับมาแสดงตามเดิม           | —           | P2  |
| DEL-03 | นักเรียนเข้า URL บทเรียนที่ถูกลบตรง ๆ | ได้หน้า 404 หรือข้อความแจ้ง | `page.goto` | P2  |
| DEL-04 | ลบบทเรียนแล้วนักเรียนได้รับแจ้งเตือน  | มีการแจ้งเตือนในระบบ        | —           | P3  |

### 4.8 Course Versioning — `tests/e2e/versioning.spec.ts`

| ID     | Scenario                                | Expected                               | เทคนิค            |  P  |
| ------ | --------------------------------------- | -------------------------------------- | ----------------- | :-: |
| VER-01 | Admin สร้าง version ใหม่ + ราคา upgrade | บันทึกสำเร็จ                           | —                 | P2  |
| VER-02 | นักเรียน v1 เห็น banner version ใหม่    | banner แสดง                            | `toBeVisible`     | P2  |
| VER-03 | Upgrade → ชำระส่วนต่าง → เข้า v2 ได้    | ราคาส่วนต่างถูกต้อง เข้าเนื้อหาใหม่ได้ | `toHaveText` ราคา | P2  |

### 4.9 Quiz และ Mock Exam — `tests/e2e/quiz.spec.ts`

| ID    | Scenario                       | Expected                       | เทคนิค                   |  P  |
| ----- | ------------------------------ | ------------------------------ | ------------------------ | :-: |
| QZ-01 | ทำ quiz แล้วส่ง                | เห็นคะแนนและเฉลยทันที          | `getByRole('radio')`     | P2  |
| QZ-02 | Mock exam หมดเวลา              | ส่งคำตอบอัตโนมัติ              | `page.clock.fastForward` | P2  |
| QZ-03 | Refresh ระหว่างทำข้อสอบ        | เวลาไม่รีเซ็ต คำตอบเดิมยังอยู่ | `page.reload()`          | P3  |
| QZ-04 | คะแนนแสดงใน dashboard นักเรียน | ตรงกับคะแนนที่ทำ               | —                        | P3  |

### 4.10 Certificate, Export และ Badge — `tests/e2e/export.spec.ts`

| ID     | Scenario                                        | Expected                   | เทคนิค                     |  P  |
| ------ | ----------------------------------------------- | -------------------------- | -------------------------- | :-: |
| EXP-01 | เรียนจบคอร์สแล้วดาวน์โหลดใบเซอร์ฯ               | ได้ไฟล์ `.pdf` ชื่อถูกต้อง | `waitForEvent('download')` | P2  |
| EXP-02 | Admin export รายงานยอดขายเป็น Excel ตามช่วงเวลา | ไฟล์มีจำนวนแถวตรงกับข้อมูล | อ่านไฟล์ด้วย `exceljs`     | P3  |
| EXP-03 | Export CSV                                      | header และข้อมูลถูกต้อง    | `fs.readFile`              | P3  |
| EXP-04 | เรียนครบตามเงื่อนไขแล้วได้ badge                | badge แสดงในโปรไฟล์        | —                          | P3  |

---

## 5. API Test Cases

> ใช้แทน Unit/Integration test ฝั่ง backend เดิม — `tests/api/*.spec.ts`

| ID     | Endpoint                    | Scenario                         | Expected                                    |
| ------ | --------------------------- | -------------------------------- | ------------------------------------------- |
| API-01 | `POST /api/auth/login`      | ข้อมูลถูกต้อง                    | 200 + token/cookie                          |
| API-02 | `POST /api/auth/login`      | รหัสผิด                          | 401                                         |
| API-03 | `POST /api/auth/refresh`    | refresh token ถูกต้อง            | ได้ token ใหม่                              |
| API-04 | `GET /api/courses`          | ไม่คืนรายการที่ถูก soft delete   | ไม่มี item ที่ `is_deleted = true`          |
| API-05 | `POST /api/payment/webhook` | ส่ง payload เดิมซ้ำ 2 ครั้ง      | สร้าง enrollment แค่ 1 รายการ (idempotency) |
| API-06 | `GET /api/lessons/:id`      | enrollment หมดอายุแล้ว           | 403                                         |
| API-07 | `GET /api/lessons/:id`      | lesson ของ version ที่ไม่ได้ซื้อ | 403                                         |

---

## 6. Security Test Cases

`tests/security/*.spec.ts` · tag `@security`

| ID     | Scenario                                                   | Expected                                | เทคนิค                           |
| ------ | ---------------------------------------------------------- | --------------------------------------- | -------------------------------- |
| SEC-01 | เรียก API โดยไม่มี token                                   | 401                                     | `request` ไม่มี storageState     |
| SEC-02 | Student เรียก `/api/admin/*`                               | 403                                     | `request` + storageState student |
| SEC-03 | Student เปิดหน้า `/admin`                                  | redirect หรือ 403                       | `page.goto`                      |
| SEC-04 | ใส่ `<script>alert(1)</script>` ในชื่อ/คอมเมนต์            | ไม่มี dialog เกิดขึ้น ข้อความถูก escape | `page.on('dialog')`              |
| SEC-05 | ใส่ `' OR '1'='1` ในช่อง login/ค้นหา                       | ไม่ login ได้ ไม่มี error 500           | Data-driven                      |
| SEC-06 | ส่ง webhook ปลอมโดยไม่มี signature                         | 401/400 และไม่สร้าง enrollment          | `request.post`                   |
| SEC-07 | เปิด URL วิดีโอใน context อื่นที่ไม่ได้ login              | เล่นไม่ได้ / 403                        | `browser.newContext()`           |
| SEC-08 | Student แก้ `userId` ใน request เพื่อดูข้อมูลคนอื่น (IDOR) | 403                                     | `request`                        |

> ⚠️ เคสเหล่านี้เป็นการตรวจระดับพื้นฐานเท่านั้น ไม่ได้แทน penetration test

---

## 7. Cross-browser และ Device Testing

### Mapping จากแผนเดิม → Playwright projects

| Platform เดิม        | Playwright project            | หมายเหตุ                              |
| -------------------- | ----------------------------- | ------------------------------------- |
| Windows/macOS Chrome | `chromium`                    |                                       |
| Windows Firefox      | `firefox`                     |                                       |
| macOS Safari         | `webkit`                      | WebKit engine ไม่ใช่ Safari จริง 100% |
| Android Chrome       | `mobile-chrome` (`Pixel 7`)   | emulation                             |
| iPhone Safari        | `mobile-safari` (`iPhone 15`) | emulation                             |
| iPad Safari          | `tablet` (`iPad Pro 11`)      | emulation                             |

### `playwright.config.ts` (ส่วน projects)

```ts
projects: [
  { name: 'setup', testMatch: /.*\.setup\.ts/ },

  { name: 'chromium',      use: { ...devices['Desktop Chrome'] },  dependencies: ['setup'] },
  { name: 'firefox',       use: { ...devices['Desktop Firefox'] }, dependencies: ['setup'] },
  { name: 'webkit',        use: { ...devices['Desktop Safari'] },  dependencies: ['setup'] },

  { name: 'mobile-chrome', use: { ...devices['Pixel 7'] },     dependencies: ['setup'], grep: /@mobile|@smoke/ },
  { name: 'mobile-safari', use: { ...devices['iPhone 15'] },   dependencies: ['setup'], grep: /@mobile|@smoke/ },
  { name: 'tablet',        use: { ...devices['iPad Pro 11'] }, dependencies: ['setup'], grep: /@mobile|@smoke/ },
],
```

### เคสเฉพาะ Mobile (`@mobile`)

- เมนู hamburger เปิด/ปิดได้
- Video player เล่นได้และ fullscreen ได้
- QR PromptPay แสดงครบ ไม่ล้นจอ
- ฟอร์มสมัครสมาชิกกรอกได้ครบโดยไม่ต้องเลื่อนแนวนอน

> 💡 ถ้าต้องการทดสอบบนอุปกรณ์จริง ให้ใช้บริการ cloud เช่น BrowserStack หรือ LambdaTest ที่รองรับ Playwright

---

## 8. Performance Checks

Playwright ตรวจประสิทธิภาพได้แค่ระดับพื้นฐาน ใช้เป็นสัญญาณเตือนเบื้องต้นเท่านั้น

| ID      | Check                   | เกณฑ์       | วิธี                         |
| ------- | ----------------------- | ----------- | ---------------------------- |
| PERF-01 | หน้า Home โหลดเสร็จ     | < 3 วินาที  | Navigation Timing API        |
| PERF-02 | API response time       | < 500ms     | วัดเวลารอบ `request.get()`   |
| PERF-03 | Export Excel 1,000 rows | < 10 วินาที | จับเวลาจนเกิด download event |

```ts
const timing = await page.evaluate(() => {
  const [nav] = performance.getEntriesByType(
    "navigation",
  ) as PerformanceNavigationTiming[];
  return nav.loadEventEnd - nav.startTime;
});
expect(timing).toBeLessThan(3000);
```

> Load test (เช่น 50 คนดูวิดีโอพร้อมกัน) ให้ใช้ **k6** หรือ **Artillery** แยกต่างหาก

---

## 9. ตัวอย่างโค้ดสำหรับเคสยาก

### DEV-01 — Single device login (2 contexts)

```ts
test("login อุปกรณ์ที่สองแล้วอุปกรณ์แรกต้องถูก kick", async ({ browser }) => {
  const deviceA = await browser.newContext();
  const deviceB = await browser.newContext();
  const pageA = await deviceA.newPage();
  const pageB = await deviceB.newPage();

  await test.step("login อุปกรณ์ A", async () => {
    await new LoginPage(pageA).login("student1@test.local", "Student@1234");
  });

  await test.step("login อุปกรณ์ B", async () => {
    await new LoginPage(pageB).login("student1@test.local", "Student@1234");
  });

  await test.step("อุปกรณ์ A ต้องหลุด", async () => {
    await pageA.reload();
    await expect(pageA).toHaveURL(/\/login/);
    await expect(pageA.getByText(/เข้าสู่ระบบจากอุปกรณ์อื่น/)).toBeVisible();
  });

  await deviceA.close();
  await deviceB.close();
});
```

### QZ-02 — Mock exam หมดเวลา (`page.clock`)

```ts
test("หมดเวลาแล้วต้องส่งคำตอบอัตโนมัติ", async ({ page }) => {
  await page.clock.install();
  await page.goto("/quiz/mock-exam-1");
  await page.getByRole("button", { name: "เริ่มทำข้อสอบ" }).click();

  await page.clock.fastForward("30:00");

  await expect(page.getByText("หมดเวลา")).toBeVisible();
  await expect(page.getByTestId("quiz-result")).toBeVisible();
});
```

### VID-02 — Resume watching

```ts
test("กลับมาดูวิดีโอแล้วต้องเล่นต่อจากเดิม", async ({ page }) => {
  await page.goto("/lesson/1");
  const video = page.locator("video");

  const saved = page.waitForResponse(
    (r) => r.url().includes("/api/progress") && r.ok(),
  );
  await video.evaluate((v: HTMLVideoElement) => {
    v.currentTime = 120;
    v.dispatchEvent(new Event("timeupdate"));
  });
  await saved;

  await page.goto("/");
  await page.goto("/lesson/1");

  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThanOrEqual(115);
});
```

### EXP-01 — ดาวน์โหลดใบเซอร์ติฟิเกต

```ts
const downloadPromise = page.waitForEvent("download");
await page.getByRole("button", { name: "ดาวน์โหลดใบเซอร์ติฟิเกต" }).click();
const download = await downloadPromise;

expect(download.suggestedFilename()).toMatch(/certificate.*\.pdf$/i);
```

### PAY-03 — จำลอง API ล่มด้วย `page.route()`

```ts
await page.route("**/api/payment/webhook", (route) =>
  route.fulfill({ status: 500, body: "Internal Server Error" }),
);
```

### SEC-02 — Role escalation ผ่าน API

```ts
test.use({ storageState: "playwright/.auth/student1.json" });

test(
  "นักเรียนเรียก admin API ต้องได้ 403",
  { tag: "@security" },
  async ({ request }) => {
    const res = await request.get("/api/admin/users");
    expect(res.status()).toBe(403);
  },
);
```

### SEC-04 — XSS

```ts
let dialogTriggered = false;
page.on("dialog", async (d) => {
  dialogTriggered = true;
  await d.dismiss();
});

await page.getByLabel("ชื่อเล่น").fill("<script>alert(1)</script>");
await page.getByRole("button", { name: "บันทึก" }).click();
await page.reload();

expect(dialogTriggered).toBe(false);
await expect(page.getByText("<script>alert(1)</script>")).toBeVisible(); // แสดงเป็นข้อความ ไม่ถูก execute
```

---

## 10. การรายงานผลและ CI

### Config ที่แนะนำ

```ts
use: {
  baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
  trace: 'on-first-retry',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
},
retries: process.env.CI ? 2 : 0,
reporter: [['html'], ['list']],
```

### Definition of Done ของแต่ละเทส

- [ ] รันผ่านทั้ง 3 browser (chromium, firefox, webkit)
- [ ] รันแยกเดี่ยวได้ และรันแบบ parallel ได้
- [ ] ไม่มี `waitForTimeout`
- [ ] ใช้ locator แบบ user-facing (`getByRole`, `getByLabel`) เป็นหลัก
- [ ] รันซ้ำ 10 รอบไม่ flaky: `npx playwright test <file> --repeat-each=10`

### การรายงาน Bug

เมื่อเจอ bug ให้แนบสิ่งเหล่านี้:

- Test ID (เช่น `PAY-04`)
- ขั้นตอนการทำซ้ำ
- Expected vs Actual
- Trace file (`npx playwright show-trace trace.zip`)
- Browser/project ที่เจอ
