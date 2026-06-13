# HighBrainnet — ระบบคลาสออนไลน์คณิตศาสตร์

> **TASKS.md** — รายการงานพัฒนาและ Timeline
> Version 1.0 | June 2026

---

## Phase 1 — Core System (~22 สัปดาห์)

### Sprint 1–2: Project Setup และ Database (2 สัปดาห์)
- [ ] ตั้ง project repository และ branching strategy
- [ ] ออกแบบ database schema ทั้งหมด ครอบคลุม soft delete และ versioning
- [ ] ตั้ง PostgreSQL และ migration system
- [ ] ตั้ง backend framework และ folder structure
- [ ] ตั้ง authentication system (JWT + refresh token)
- [ ] ตั้ง development environment และ `.env` configuration

### Sprint 3–4: Auth และ User Management (2 สัปดาห์)
- [ ] ระบบ register/login สำหรับนักเรียน
- [ ] PDPA consent form ตอนสมัคร
- [ ] Device fingerprinting และ single device session control
- [ ] ระบบ unlock อุปกรณ์สำหรับครู (admin panel)
- [ ] Password reset ผ่าน email หรือ Line

### Sprint 5–6: Course Structure (2 สัปดาห์)
- [ ] CRUD course levels, courses, chapters, lessons
- [ ] Soft delete ทุก entity พร้อม restore
- [ ] Admin UI: จัดการ tree โครงสร้าง drag-and-drop reorder
- [ ] Course Versioning: สร้าง version ใหม่ กำหนดราคา upgrade
- [ ] API: ดึงโครงสร้างคอร์สสำหรับหน้านักเรียน

### Sprint 7–8: Video Integration (2 สัปดาห์)
- [ ] Bunny.net integration: upload API พร้อม progress bar
- [ ] Video player: DRM token, domain-lock, resume watching
- [ ] Admin UI: อัปโหลด แก้ไข ลบวิดีโอ
- [ ] Watch history: บันทึก `last_position_seconds`
- [ ] Lesson progress tracking

### Sprint 9–10: Payment System (2 สัปดาห์)
- [ ] GB Prime Pay integration: QR PromptPay
- [ ] Webhook handler พร้อม signature verification
- [ ] Line Notify: แจ้งเตือนครูทันทีเมื่อมีการชำระ
- [ ] Manual approve system สำรอง
- [ ] Order และ payment history
- [ ] Idempotency: ป้องกัน double charge

### Sprint 11–12: Package และ Enrollment (1.5 สัปดาห์)
- [ ] ระบบ package bundle ครูสร้างเอง
- [ ] Enrollment: เชื่อม payment กับ course access
- [ ] Version upgrade: นักเรียนเห็น banner และจ่ายส่วนต่าง
- [ ] Access expiry: ครูกำหนดตลอดชีพหรือมีวันหมดอายุ

### Sprint 13–14: Admin Dashboard (2 สัปดาห์)
- [ ] KPI cards: ยอดขาย นักเรียนใหม่ คอร์สขายดี
- [ ] กราฟยอดขาย 30 วัน
- [ ] รายการรอ approve
- [ ] จัดการนักเรียน: ดูประวัติ ระงับ/คืนสิทธิ์
- [ ] Exam credits: กรอก แก้ไข ลบ

### Sprint 15–16: Frontend นักเรียน (2 สัปดาห์)
- [ ] หน้าแรก: แสดงคอร์สแยกชั้นเรียน
- [ ] หน้าคอร์ส: tree บทเรียน progress bar
- [ ] หน้าเรียน: video player + lesson navigation
- [ ] Mobile responsive ทุกหน้า
- [ ] UX/UI ตามแนวทาง HighBrainnet: สีเด็ก ปุ่มใหญ่ feedback ทันที

### Sprint 17–18: QA + UAT + Deploy Setup (2 สัปดาห์)
- [ ] Unit test API endpoints หลัก
- [ ] Integration test payment flow
- [ ] UAT กับลูกค้า
- [ ] Bug fix
- [ ] Performance optimization
- [ ] Production deploy setup

---

## Phase 2 — Advanced Features (~10 สัปดาห์)

### Quiz และ Mock Exam (3 สัปดาห์)
- [ ] Quiz ก่อน/หลังเรียน: ปรนัย ตรวจอัตโนมัติ
- [ ] Mock Exam: ครูตั้ง timer กำหนดได้ต่อชุดข้อสอบ
- [ ] แสดงเฉลยพร้อมคำอธิบายหลังส่ง
- [ ] บันทึก `quiz_results` ทุกครั้ง

### Export และ Certificate (2 สัปดาห์)
- [ ] Export Excel: ยอดขาย, รายชื่อนักเรียน, ประวัติชำระ, คะแนน quiz, สอบติด
- [ ] Export PDF: ใบเสร็จ
- [ ] ใบเซอร์ติฟิเกตอัตโนมัติ PDF download
- [ ] Filter ช่วงเวลาและคอร์ส

### เครดิตสอบติด (1.5 สัปดาห์)
- [ ] Admin UI: กรอกข้อมูล โรงเรียน ปี ชื่อจริง/นามแฝง
- [ ] หน้า public **"ผลสอบนักเรียน"**
- [ ] Export รายชื่อสอบติด Excel

### Dashboard นักเรียน + Gamification (2 สัปดาห์)
- [ ] Progress overview ทุกคอร์ส
- [ ] ประวัติคะแนน quiz
- [ ] Badge achievement เมื่อเรียนจบบท
- [ ] แจ้งเตือน version ใหม่

### QA + UAT Phase 2 + Final Deploy (1.5 สัปดาห์)
- [ ] Regression test ทั้งระบบ
- [ ] UAT ลูกค้า sign-off
- [ ] Production deploy
- [ ] Training ครูใช้งาน admin
- [ ] ส่งมอบเอกสารและ source code

---

## สรุป Timeline

| Phase | ระยะเวลา | สัปดาห์โดยประมาณ |
|---|---|---|
| **Phase 1** Core System | 3.5–4 เดือน | ~22 สัปดาห์ |
| **Phase 2** Advanced Features | 2–2.5 เดือน | ~10 สัปดาห์ |
| **รวม** | 5.5–6.5 เดือน | ~32 สัปดาห์ |
