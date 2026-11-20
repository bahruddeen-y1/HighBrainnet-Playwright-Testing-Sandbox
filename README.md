# HighBrainnet — ระบบคลาสออนไลน์คณิตศาสตร์

> **README.md** — คู่มือภาพรวมโปรเจกต์สำหรับ Developer
> Version 1.0 | June 2026

---

## 1. ภาพรวมโปรเจกต์

**HighBrainnet** คือระบบคลาสออนไลน์คณิตศาสตร์สำหรับนักเรียนประถมปลาย มัธยมต้น และมัธยมปลาย พัฒนาขึ้นแทนการใช้ SaaS LMS เพื่อให้:

- ครูเป็นเจ้าของระบบ 100%
- ไม่ต้องจ่ายค่าบริการรายเดือน
- รองรับ feature เฉพาะทางที่ SaaS ทั่วไปไม่มี

---

## 2. แผนการพัฒนา 2 Phase

### Phase 1 — Core System

**ระยะเวลา:** 3.5–4 เดือน | **ราคา:** 40,000–50,000 บาท

- Login + สมัครสมาชิก + PDPA consent
- โครงสร้างคอร์ส 4 ระดับ (Level → Course → Chapter → Lesson)
- วิดีโอ player + DRM + resume watching
- QR PromptPay + Line Notify + manual approve
- Single device login + unlock
- Admin dashboard: KPI + approve + จัดการเนื้อหา
- Soft delete ทุก entity
- Course Versioning + upgrade pricing
- อัปโหลดวิดีโอผ่าน admin พร้อม progress bar

### Phase 2 — Advanced Features

**ระยะเวลา:** 2–2.5 เดือน | **ราคา:** 18,000–30,000 บาท

- แบบทดสอบ quiz ก่อน/หลังเรียน + mock exam timer
- ระบบเครดิตสอบติด + หน้าสาธารณะ
- Dashboard นักเรียนเต็มรูปแบบ + คะแนน quiz
- ใบเซอร์ติฟิเกตอัตโนมัติ + PDF download
- Export Excel/CSV/PDF รายงานทั้งหมด
- Package bundle ครูสร้างได้เอง
- Gamification: badge achievement

---

## 3. ราคาและการชำระเงิน

| งวด              | เมื่อไร               | เปอร์เซ็นต์ |
| ---------------- | --------------------- | ----------- |
| งวด 1 มัดจำ      | เซ็นสัญญา (เฟส 2)     | 40–50%      |
| งวด 2 ระหว่างทาง | ส่ง milestone Phase 1 | 30%         |
| งวด 3 ปิดงาน     | ลูกค้า sign-off UAT   | 20–30%      |
| ค่า Maintenance  | หลังหมดประกัน 30 วัน  | ตกลงแยก     |

---

## 4. สิ่งที่ลูกค้าต้องเตรียม

- สมัครบัญชี **GB Prime Pay** (ใช้เวลาอนุมัติ 3–7 วัน ควรเริ่มทันที)
- สมัคร **Line Notify token** สำหรับรับแจ้งเตือน
- เตรียมถ่ายวิดีโอทั้งหมด (ถ่ายใหม่ ยังไม่มีไฟล์เดิม)
- เตรียมเอกสาร **Privacy Policy** สำหรับ PDPA
- กำหนด domain ที่จะใช้ (พักไว้ก่อน)

---

## 5. ค่าใช้จ่ายรายเดือนหลัง Go-live

| รายการ              | ราคา/เดือน     | หมายเหตุ                  |
| ------------------- | -------------- | ------------------------- |
| Bunny.net Video CDN | 300–1,000 บาท  | ขึ้นกับ views และ storage |
| Server / Hosting    | 250–700 บาท    | DigitalOcean droplet      |
| Domain              | ~50 บาท        | คิดเฉลี่ยรายเดือน         |
| GB Prime Pay        | 1.5% ต่อยอดขาย | ไม่มีค่าคงที่             |
| Line Notify         | ฟรี            | ขีดจำกัด 1,000 msg/วัน    |

---

## เอกสารที่เกี่ยวข้อง

- [CONTEXT.md](./CONTEXT.md) — บริบทโปรเจกต์และความต้องการทั้งหมด
- [ARCHITECTURE.md](./ARCHITECTURE.md) — สถาปัตยกรรมระบบและโครงสร้างข้อมูล
- [AGENTS.md](./AGENTS.md) — บทบาทและความรับผิดชอบในโปรเจกต์
- [TASKS.md](./TASKS.md) — รายการงานพัฒนาและ Timeline
- [TESTING.md](./TESTING.md) — แผนการทดสอบระบบ
- [SECURITY.md](./SECURITY.md) — มาตรการความปลอดภัยระบบ
