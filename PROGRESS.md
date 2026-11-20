# PROGRESS.md — บันทึกการทำงาน (HighBrainnet)

Log การพัฒนาแบบเรียงตามวัน (chronological): วันไหนทำอะไร เสร็จถึงไหน เหลืออะไร
> ดูภาพรวมระบบ/วิธีรันที่ `CLAUDE.md` · ดู spec ที่ `CONTEXT/`

---

## 📍 สถานะปัจจุบัน (ณ 2026-06-14)

- **ระบบใช้งานได้ครบ 16 หน้า** (public + นักเรียน + admin) — ทดสอบในเบราว์เซอร์จริงผ่านทั้งหมด
- **Backend tests: 55/55 ผ่าน**
- **ขึ้น GitHub แล้ว:** `Bahruddeen4214/e-Learning` (private, branch `master`) — commit `f0eefa6`
- **โหมด dev:** `BUNNY_MOCK=true`, `GBP_MOCK=true` (วิดีโอจริงเล่นไม่ได้ใน dev, QR ใช้ string จำลอง)
- **สี:** เปลี่ยนเป็น `#85B2D5` (HighBrainnet Blue) แล้ว — *ยังไม่ได้ commit*
- **บัญชีทดสอบ:** admin `admin@highbrainnet.local` / `Admin1234!` · นักเรียน `demo@student.com` / `Demo12345!`

---

## 🗓️ Log

### 2026-06-11 — Project kickoff
- เขียนเอกสาร spec ใน `CONTEXT/`: CONTEXT.md (บริบท/ฟีเจอร์ทั้งหมด), ARCHITECTURE.md, TASKS.md
  (timeline ~32 สัปดาห์), SECURITY.md, TESTING.md, AGENTS.md, README.md
- กำหนดขอบเขต: คอร์สคณิต ป.ปลาย/ม.ต้น/ม.ปลาย, payment QR PromptPay, video Bunny.net DRM,
  course versioning แนวทาง B, soft delete ทุก entity

### 2026-06-12 — Backend core + Frontend mockups
- **Backend:** Prisma schema + migrations (init, quiz_attempts_and_course_link, user_badges);
  services/controllers/validators/routes ครบทุกโมดูล — auth, course/chapter/lesson,
  video+bunny, order+payment+gbprimepay, package, enrollment, quiz, examCredit, dashboard,
  export (xlsx/pdf), certificate, userAdmin, version, lineNotify, badge
- Auth: JWT + refresh token, PDPA consent, single-device session, rate limiting; seed (levels + admin)
- **Frontend:** หน้า student + admin (HTML/Tailwind CDN) + `assets/js` (api, cart, ui, main);
  หน้าส่วนใหญ่ wire กับ API แล้ว
- **Tests 55 ผ่าน**
- เหลือเป็น static (ยังไม่ wire): `index.html`, `admin/course-edit.html`, `admin/quiz-creator.html`

### 2026-06-13 — ต่อยอด + ทดสอบเบราว์เซอร์ + แก้บั๊ก + ขึ้น GitHub
**Wire หน้าที่เหลือ + ฟีเจอร์**
- `index.html` — ดึง featured courses จาก `/courses` จริง + navbar auth state + cart badge
- เขียนใหม่ `admin/course-edit.html` — แก้ข้อมูลคอร์ส (PATCH) + CRUD chapter/lesson จริง;
  เพิ่มปุ่ม "แก้ไข" ในตาราง `admin/courses.html`
- เขียนใหม่ `admin/quiz-creator.html` — สร้าง quiz + คำถาม 3 ชนิด (ปรนัย/ถูก-ผิด/เติมคำ),
  รองรับ deep-link `?quizId=` เพื่อแก้ของเดิม
- เพิ่ม **Bunny video upload** ใน course-edit (create → PUT ตรงไป Bunny + progress → sync → delete; รองรับ mock)

**ทดสอบเบราว์เซอร์จริง (playwright-core + system Chrome) + แก้ที่พบ**
- *course-edit* → พบ 2 finding แล้วแก้: (1) ไม่มีปุ่ม restore และ chapter/lesson ที่ลบสะสมในหน้า
  → เพิ่มปุ่มกู้คืน + แสดงสถานะ "ถูกซ่อน"; (2) backend inconsistency: admin เห็น deleted chapter
  แต่ดึง lessons ของมัน 404 → แก้ `lesson.service` (`ensureChapter` รับ `allowDeleted`)
- *quiz-creator* → เพิ่มปุ่ม "ลบข้อสอบทั้งชุด"; แก้บั๊ก deep-link ไป quiz ที่ถูกลบ
  (`loadQuiz` ไม่ catch 404 → ค้าง) ด้วย `resetToCreateMode()`
- *index* → พบ+แก้บั๊ก: รูป placeholder การ์ดคอร์สเป็นสีดำ เพราะ SVG double-encoding
  (`%23` ใน string + `encodeURIComponent` → `%2523`) → เปลี่ยนเป็น `#` (กระทบ index + courses)
- *exam-results* → ผ่าน (privacy: ชื่อจริงที่ตั้งซ่อนไม่หลุด); ปรับ `statsBar` ให้แสดงยอดรวมเสมอ (ไม่ผูกตัวกรอง)

**Full system audit (16 หน้า) → พบ 2 บั๊กใหญ่**
- `HBN.api.requireLogin` ไม่ถูก export ใน `api.js` → my-courses/player/quiz/checkout พังหมด → เพิ่มใน export
- checkout โหลด `qrcode@1.5.3` ที่ **404** → QR ว่าง จ่ายเงินไม่ได้ → เปลี่ยนเป็น `qrcode@1.5.1`
- ทดสอบเชิงลึก: quiz flow (start→submit→ผล+เฉลย), checkout (สร้าง order→QR สแกนได้)
- ผลรวม: **16/16 หน้าผ่าน**

**Version control**
- `git init` + `.gitignore` (กัน node_modules/.env/.DS_Store/local settings)
- Initial commit `f0eefa6` (138 ไฟล์) — ตรวจแล้วไม่มี secret/node_modules หลุด
- สร้าง GitHub repo `Bahruddeen4214/e-Learning` (private) + push สำเร็จ (git config สะอาด ไม่ฝัง token)

### 2026-06-14 — SSH, Preview, Rebrand, Docs
- **SSH key:** สร้าง ed25519 + `~/.ssh/config` (github.com) + ssh-agent — *public key สร้างแล้ว
  รอ user เพิ่มเข้า GitHub (https://github.com/settings/ssh/new)*
- **Preview:** รัน backend (4000) + static (5173) ค้างไว้ให้ดู; สร้างบัญชีเดโม `demo@student.com`
  (ลงทะเบียน math-primary-entrance) + ยืนยัน admin
- **Rebrand → `#85B2D5`:** แก้ `assets/css/styles.css` (CSS vars + gradients/tints),
  ใส่ Tailwind config remap `orange-*`→โทนน้ำเงิน ทั้ง 16 หน้า, แก้ amber gradient/blob/rgba/SVG
  ที่ผสม; เก็บทอง (ดาว/เหรียญ/achievement) + เขียว/แดง (semantic) ไว้เป็น accent — verify เบราว์เซอร์แล้ว
- **เอกสาร:** เขียน `CLAUDE.md` + `PROGRESS.md`

---

## ⏳ คงเหลือ / Next

**ติดตามทันที (operational)**
- [ ] เพิ่ม SSH public key เข้า GitHub (รอ user) → แล้วเปลี่ยน remote เป็น SSH จะ push ได้โดยไม่ใช้ token
- [ ] **Revoke token 2 ตัวที่หลุดในแชต** (fine-grained + classic) ที่ github.com/settings/tokens
- [ ] commit + push การเปลี่ยนสี `#85B2D5` + `CLAUDE.md` + `PROGRESS.md` (ยังไม่ commit)

**คำถามธุรกิจที่ยังไม่สรุป (CONTEXT.md §4)**
- [ ] mock exam ทำได้กี่ครั้ง / ไม่จำกัด
- [ ] เงื่อนไขรับใบเซอร์ติฟิเกต (เรียนจบครบ หรือต้องผ่าน quiz ด้วย)
- [ ] refund policy จัดการในระบบหรือนอกระบบ
- [ ] domain + server ที่จะใช้
- [ ] แจ้งเตือน version ใหม่ผ่าน Line/email หรือไม่ · ราคา upgrade ครูกำหนดเองหรือคำนวณส่วนต่าง

**เตรียม Production**
- [ ] ตั้งค่า Bunny.net จริง (`BUNNY_API_KEY/LIBRARY_ID/CDN_HOSTNAME/STREAM_TOKEN_KEY`, ปิด `BUNNY_MOCK`)
      → ทดสอบ video playback จริง (dev เล่นไม่ได้)
- [ ] ตั้งค่า GB Prime Pay จริง (`GBP_*`, ปิด `GBP_MOCK`) + Line Notify token + webhook signature
- [ ] Deploy (มีโครง `docker-compose.yml` / `nginx/` / `DEPLOY.md` แล้ว) + ตั้ง `CORS_ORIGIN` เป็น domain จริง
- [ ] UAT กับลูกค้า + training admin (ตาม TASKS.md Sprint 17-18 / Phase 2)

**สุขลักษณะ (nice-to-have)**
- [ ] student1–5@test.com เป็นข้อมูล dev รหัสไม่ทราบ — ตั้งรหัสใหม่หรือลบทิ้งตอนจะ go-live
- [ ] พิจารณาเพิ่ม favicon (ตอนนี้ 404 ไม่กระทบการทำงาน)
