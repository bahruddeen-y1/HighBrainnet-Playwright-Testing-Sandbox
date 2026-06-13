# HighBrainnet — ระบบคลาสออนไลน์คณิตศาสตร์

> **ARCHITECTURE.md** — สถาปัตยกรรมระบบและโครงสร้างข้อมูล
> Version 1.0 | June 2026

---

## 1. Tech Stack

| Layer | Technology | เหตุผล |
|---|---|---|
| Database | PostgreSQL | Relational DB รองรับโครงสร้าง 4 ระดับและ relationship ซับซ้อน |
| Backend | Node.js + Express หรือ Django | Community ใหญ่ เร็ว รองรับ REST API |
| Frontend | React / Next.js | SEO ดี ยืดหยุ่น รองรับ SSR |
| Video CDN | Bunny.net | DRM ป้องกันดาวน์โหลด ถูก เร็ว |
| Payment | GB Prime Pay | รองรับ QR PromptPay fee 1.5% |
| Notification | Line Notify | แจ้งเตือนครูเมื่อมีการชำระเงิน |
| Server | DigitalOcean / AWS | เสถียร scale ได้ SSL ฟรี |
| Export | ExcelJS + PDFKit | สร้าง `.xlsx` และ PDF รายงาน |

---

## 2. โครงสร้างเนื้อหา 4 ระดับ

ระบบรองรับโครงสร้างเนื้อหาแบบลำดับชั้น 4 ระดับดังนี้

| ระดับ | ชื่อ | ตัวอย่าง | Table |
|---|---|---|---|
| 1 | ชั้นเรียน (Level) | ประถมปลาย / มัธยมต้น / มัธยมปลาย | `course_levels` |
| 2 | คอร์ส (Course) | คณิตพื้นฐาน ป.4-6 / ตะลุยโจทย์สอบเข้า | `courses` |
| 3 | บท (Chapter) | บทที่ 1: เศษส่วน | `chapters` |
| 4 | หัวข้อ (Lesson) | การบวกเศษส่วน (วิดีโอ + quiz) | `lessons` |

---

## 3. Database Schema หลัก

### 3.1 ตารางหลัก
- **`users`** — นักเรียนและครู พร้อม role, session token, device fingerprint
- **`course_levels`** — ชั้นเรียน 3 ระดับ (ประถม/ม.ต้น/ม.ปลาย)
- **`courses`** — คอร์สพร้อมราคา, `is_deleted`, `current_version_id`
- **`course_versions`** — version ของคอร์ส พร้อมราคา upgrade
- **`chapters`** — บทเรียน พร้อม order, `is_deleted`, `is_visible`
- **`lessons`** — หัวข้อ/วิดีโอ พร้อม `bunny_video_id`, duration, `is_deleted`
- **`quizzes`** — ชุดข้อสอบ พร้อม `has_timer`, `time_limit_minutes`, `is_mock_exam`
- **`questions`** — ข้อสอบแต่ละข้อ พร้อม type, options, correct_answer, explanation

### 3.2 ตาราง Enrollment และ Progress
- **`enrollments`** — การซื้อคอร์ส พร้อม `version_id`, `expires_at`, `is_lifetime`
- **`student_version_access`** — สิทธิ์เข้าถึง version ของแต่ละนักเรียน
- **`watch_history`** — ประวัติดูวิดีโอ พร้อม `last_position_seconds`
- **`quiz_results`** — ผลการทำข้อสอบทุกครั้ง พร้อม score, `time_used_seconds`
- **`lesson_progress`** — progress แต่ละหัวข้อ (watched/completed)

### 3.3 ตาราง Payment และ Business
- **`orders`** — คำสั่งซื้อ พร้อม `payment_method`, status, amount
- **`payments`** — รายการชำระ พร้อม `gateway_ref`, `webhook_payload`
- **`packages`** — bundle ที่ครูสร้าง พร้อม `discount_price`
- **`package_courses`** — many-to-many ของ package และ courses
- **`exam_credits`** — เครดิตสอบติด พร้อม school, year, `display_name_type`
- **`certificates`** — ใบเซอร์ติฟิเกต พร้อม `issued_at`, `pdf_url`

---

## 4. Soft Delete Pattern

ทุก table ที่มีเนื้อหาต้องมี field เหล่านี้

- `is_deleted: boolean DEFAULT false`
- `deleted_at: timestamp NULL`
- ทุก query ต้อง filter `WHERE is_deleted = false` เสมอ
- ครู restore ได้ทุกเมื่อผ่าน admin panel
- ระบบแจ้งเตือนก่อนซ่อนว่ามีนักเรียนกี่คนที่ใช้งานอยู่

---

## 5. Single Device Login

ระบบควบคุม 1 session ต่อ 1 นักเรียนพร้อมกัน

- เก็บ `session_token` และ `device_fingerprint` ใน `users` table
- login ใหม่ = kick session เก่าออกอัตโนมัติ
- ครู unlock ผ่าน admin panel โดย reset `device_fingerprint`
- session หมดอายุเมื่อ logout หรือ admin reset

---

## 6. Course Versioning

- ทุกคอร์สมี version เริ่มต้นที่ `v1.0`
- ครูสร้าง version ใหม่ได้จาก version เดิม
- กำหนดราคา upgrade สำหรับนักเรียนเก่าแยกต่างหาก
- นักเรียนเก่าเห็น banner แจ้งเตือนว่ามี version ใหม่
- นักเรียนที่ไม่ upgrade ยังเข้าถึง version เดิมได้ปกติ
- version เก่าไม่ถูกลบ เก็บไว้ใน `course_versions` ตลอด
