# HighBrainnet — ระบบคลาสออนไลน์คณิตศาสตร์

> **TESTING.md** — แผนการทดสอบระบบ
> Version 1.0 | June 2026

---

## 1. Unit Testing

### Backend API
- **Auth:** register, login, logout, refresh token, device fingerprint
- **Course:** CRUD ทุก level, soft delete, restore, versioning
- **Payment:** webhook handler, signature verify, idempotency
- **Session:** single device control, kick, unlock
- **Export:** สร้างไฟล์ Excel และ PDF ถูกต้อง

### Database
- **Soft delete:** `is_deleted` filter ทุก query
- **Version access:** นักเรียนเข้าถึงเฉพาะ version ที่ซื้อ
- **Enrollment expiry:** access หมดอายุตามที่กำหนด

---

## 2. Integration Testing

### Payment Flow
- สร้าง QR → สแกนจ่าย → webhook → Line Notify → approve → เข้าเรียนได้
- webhook ล้มเหลว → manual approve สำรองทำงาน
- double payment → idempotency ป้องกัน charge ซ้ำ

### Video Flow
- อัปโหลดวิดีโอ → Bunny.net → แสดงใน player
- DRM token expire → ไม่สามารถเล่นต่อได้
- resume watching → เล่นต่อจากตำแหน่งเดิม

### Single Device Flow
- login อุปกรณ์ A → login อุปกรณ์ B → อุปกรณ์ A ถูก kick
- ครู unlock → นักเรียน login ใหม่ได้

---

## 3. UAT — User Acceptance Testing

### ครู (Admin) ทดสอบ
- [ ] สร้างคอร์สใหม่ เพิ่มบท หัวข้อ อัปโหลดวิดีโอ
- [ ] สร้าง version ใหม่ กำหนดราคา upgrade
- [ ] approve การชำระเงินและการเข้าถึง
- [ ] กรอกเครดิตสอบติด กำหนดชื่อจริง/นามแฝง
- [ ] export Excel รายงานยอดขายตามช่วงเวลา
- [ ] soft delete บทเรียน ดูว่านักเรียนได้รับแจ้งเตือน
- [ ] restore บทเรียนที่ซ่อนไว้

### นักเรียน ทดสอบ
- [ ] สมัครสมาชิก → PDPA consent → ซื้อคอร์ส QR → เรียนได้
- [ ] ดูวิดีโอ → หยุด → กลับมาต่อที่เดิม
- [ ] ทำ quiz → เห็นเฉลยทันที
- [ ] login 2 อุปกรณ์พร้อมกัน → อุปกรณ์แรกถูก kick
- [ ] เห็น banner version ใหม่ → upgrade → เข้าเนื้อหาใหม่ได้

---

## 4. Performance Testing

- **Video streaming:** ทดสอบ 50 นักเรียนดูพร้อมกัน
- **API response time:** < 500ms ทุก endpoint
- **Database query:** ไม่มี N+1 query
- **Export Excel:** ไฟล์ 1,000 rows สร้างภายใน 10 วินาที

---

## 5. Security Testing

- **SQL injection:** ทดสอบ input ทุก field
- **XSS:** ทดสอบ script injection
- **Auth bypass:** ทดสอบเข้าถึง API โดยไม่มี token
- **Role escalation:** นักเรียนพยายามเรียก admin API
- **Video URL:** ทดสอบ share URL ไปเปิดใน browser อื่น
- **Webhook:** ส่ง fake webhook โดยไม่มี signature

---

## 6. Device และ Browser Testing

| Platform | Browser | ต้องผ่าน |
|---|---|:---:|
| Android มือถือ | Chrome | ✅ |
| iOS iPhone | Safari | ✅ |
| Windows Desktop | Chrome | ✅ |
| Windows Desktop | Firefox | ✅ |
| macOS | Safari | ✅ |
| iPad | Safari | ✅ |
