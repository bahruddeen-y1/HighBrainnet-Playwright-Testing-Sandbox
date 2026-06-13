# HighBrainnet — ระบบคลาสออนไลน์คณิตศาสตร์

> **SECURITY.md** — มาตรการความปลอดภัยระบบ
> Version 1.0 | June 2026

---

## 1. การป้องกันวิดีโอ (DRM)

- ใช้ **Bunny.net Token Authentication** สำหรับทุก video URL
- URL วิดีโอ expire ทุก 2–4 ชั่วโมง ไม่สามารถ share link ได้
- **Domain-locked:** เล่นได้เฉพาะจาก domain ของระบบเท่านั้น
- **Hotlink Protection:** ป้องกันการ embed วิดีโอในเว็บอื่น
- **Single device:** ไม่สามารถเรียนพร้อมกัน 2 อุปกรณ์

---

## 2. Authentication และ Session

- JWT token พร้อม expiry สั้น + refresh token
- Device fingerprinting: บันทึก user agent, screen resolution
- Session ใหม่ kick session เก่าออกอัตโนมัติ
- Password hashing ด้วย **bcrypt (cost factor 12)**
- Rate limiting: ป้องกัน brute force login
- **HTTPS บังคับ** ทุก request

---

## 3. Payment Security

- ไม่เก็บข้อมูลบัตรเครดิตหรือข้อมูลการชำระในระบบ
- ใช้ **GB Prime Pay** เป็น payment processor
- Webhook **signature verification** ทุกครั้ง
- **Idempotency key** ป้องกัน double charge
- Log การชำระเงินทุกรายการแบบ **immutable**

---

## 4. PDPA Compliance

- **Consent form** บังคับตอนสมัครสมาชิก
- **Privacy Policy** หน้าสาธารณะระบุข้อมูลที่เก็บทั้งหมด
- เครดิตสอบติด: ครูเลือกแสดงชื่อจริงหรือนามแฝงต่อนักเรียนแต่ละคน
- Export ข้อมูลนักเรียนได้เฉพาะครู (admin) เท่านั้น
- **Soft delete:** ไม่ลบข้อมูลจริง เก็บไว้ตาม retention policy
- ลูกค้า (ครู) เป็นผู้รับผิดชอบ PDPA compliance ทั้งหมด ระบุในสัญญา

---

## 5. API Security

- **Role-based access control:** ทุก endpoint ตรวจ role
- Input **validation** และ **sanitization** ทุก field
- **SQL injection prevention** ผ่าน parameterized queries
- **XSS protection:** escape output ทุก field
- **CORS:** whitelist เฉพาะ domain ที่อนุญาต
- **API rate limiting:** ป้องกัน abuse

---

## 6. Infrastructure Security

- **SSL/TLS certificate** (Let's Encrypt) บังคับทุก connection
- **Database:** ไม่เปิด port สาธารณะ เข้าถึงได้เฉพาะ backend
- **Environment variables:** ไม่ hardcode secret ใน code
- **Automated backup** ทุกวัน เก็บ 30 วัน
- **Log monitoring:** แจ้งเตือนเมื่อ error rate สูงผิดปกติ

---

## สรุปมาตรการตามชั้น

| ชั้น | มาตรการหลัก |
|---|---|
| Content (Video) | DRM token, domain-lock, hotlink protection |
| Identity | JWT + refresh, device fingerprint, bcrypt, rate limit |
| Payment | Gateway-only, webhook signature, idempotency, immutable log |
| Privacy / PDPA | Consent form, soft delete, admin-only export |
| API | RBAC, input validation, SQLi/XSS prevention, CORS, rate limit |
| Infra | HTTPS, private DB, env secrets, daily backup, log alerts |
