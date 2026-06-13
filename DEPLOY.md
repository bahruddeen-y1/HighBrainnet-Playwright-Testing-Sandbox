# HighBrainnet — คู่มือ Deploy Production

> สำหรับ DigitalOcean droplet (Ubuntu 22.04+, RAM 1–2GB) ตาม ARCHITECTURE.md

## สถาปัตยกรรม

```
[Browser] ──HTTPS──> [nginx :80/:443]
                        ├─ /            → static HTML/JS/CSS (โฟลเดอร์นี้)
                        └─ /api/*       → [Node API :4000] ──> [PostgreSQL :5432]
[Bunny.net CDN]  ← วิดีโอ DRM (แยกจาก server เรา)
[GB Prime Pay]   → webhook → /api/v1/webhooks/gbprimepay
```

## 1. เตรียม Droplet

```bash
ssh root@<droplet-ip>
apt update && apt install -y docker.io docker-compose-v2 git
```

## 2. วางโค้ด + ตั้งค่า

```bash
git clone <repo-url> /opt/highbrainnet && cd /opt/highbrainnet

# DB password สำหรับ compose
echo "DB_PASSWORD=$(openssl rand -hex 16)" > .env

# Backend production config
cp backend/.env.production.example backend/.env.production
nano backend/.env.production
#  - JWT_ACCESS_SECRET / JWT_REFRESH_SECRET: openssl rand -hex 32
#  - BUNNY_*: จาก Bunny.net dashboard
#  - GBP_*: จาก GB Prime Pay dashboard
#  - LINE_NOTIFY_TOKEN
#  - APP_URL / FRONTEND_URL / CORS_ORIGIN = https://<domain>
```

แก้ API base ของ frontend: เพิ่มก่อน `<script src="assets/js/api.js">` ในทุกหน้า
(หรือใส่ไฟล์ config กลาง):
```html
<script>window.HBN_API_BASE = '';</script>  <!-- ว่าง = same origin ผ่าน nginx /api -->
```

## 3. Start stack

```bash
docker compose up -d --build
docker compose logs -f api     # ดูว่า migrate + start สำเร็จ
```

Seed ข้อมูลเริ่มต้น (ระดับชั้น 3 ระดับ + บัญชีครู):
```bash
docker compose exec api sh -c "SEED_ADMIN_EMAIL=teacher@highbrainnet.com SEED_ADMIN_PASSWORD='<รหัสผ่านจริง>' node prisma/seed.js"
```

## 4. Domain + SSL

1. ชี้ A record ของ domain → droplet IP
2. แก้ `nginx/nginx.conf`: `server_name` เป็น domain จริง
3. ออก cert:
```bash
docker run --rm -v highbrainnet_certbot-conf:/etc/letsencrypt \
  -v highbrainnet_certbot-www:/var/www/certbot \
  certbot/certbot certonly --webroot -w /var/www/certbot -d <domain>
```
4. เปิด HTTPS block ใน `nginx/nginx.conf` แล้ว `docker compose restart web`
5. ตั้ง cron renew: `0 3 * * * docker run --rm ... certbot renew && docker compose restart web`

## 5. ตั้งค่า External services

| Service | สิ่งที่ต้องทำ |
|---|---|
| **GB Prime Pay** | ตั้ง webhook URL = `https://<domain>/api/v1/webhooks/gbprimepay` |
| **Bunny.net** | เปิด Token Authentication + Hotlink Protection จำกัดเฉพาะ `<domain>` |
| **Line Notify** | ทดสอบ: ซื้อคอร์สทดลอง → ครูต้องได้รับข้อความ |

## 6. Backup (ตาม SECURITY.md — ทุกวัน เก็บ 30 วัน)

```bash
cat > /opt/highbrainnet/backup.sh <<'EOF'
#!/bin/bash
cd /opt/highbrainnet
docker compose exec -T db pg_dump -U highbrainnet highbrainnet | gzip > /opt/backups/hbn-$(date +%F).sql.gz
find /opt/backups -name 'hbn-*.sql.gz' -mtime +30 -delete
EOF
chmod +x /opt/highbrainnet/backup.sh && mkdir -p /opt/backups
# crontab: 0 2 * * * /opt/highbrainnet/backup.sh
```

Restore:
```bash
gunzip -c /opt/backups/hbn-YYYY-MM-DD.sql.gz | docker compose exec -T db psql -U highbrainnet highbrainnet
```

## 7. อัปเดตเวอร์ชัน

```bash
cd /opt/highbrainnet
git pull
docker compose up -d --build api   # rebuild เฉพาะ API (migrate รันอัตโนมัติตอน boot)
docker compose restart web         # ถ้า frontend เปลี่ยน
```

## 8. Monitoring เบื้องต้น

```bash
docker compose ps                  # สถานะ container
docker compose logs --tail 100 api # log ล่าสุด
docker stats --no-stream           # CPU/RAM
```

## Checklist ก่อนเปิดใช้จริง

- [ ] `BUNNY_MOCK` / `GBP_MOCK` **ไม่อยู่** ใน .env.production
- [ ] JWT secrets เป็นค่า random 64 ตัวอักษร ไม่ใช่ค่า dev
- [ ] เปลี่ยนรหัสผ่าน admin จาก seed ทันทีหลัง login ครั้งแรก
- [ ] HTTPS ทำงาน + HTTP redirect
- [ ] ทดสอบซื้อคอร์สจริง 1 รายการ (ยอดเล็ก) ครบ flow: QR → จ่าย → Line แจ้ง → เข้าเรียนได้
- [ ] ทดสอบ webhook ล้มเหลว → manual approve ใช้งานได้
- [ ] Backup cron ทำงาน (เช็คไฟล์ใน /opt/backups วันถัดไป)
