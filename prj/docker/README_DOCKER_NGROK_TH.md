# วิธีรันโปรเจกต์บน Windows Server ด้วย Docker + ngrok

โปรเจกต์นี้ถูกปรับให้รันผ่าน Docker Compose ได้ทันที:
- Flask (gunicorn) รันที่พอร์ต `8080`
- MySQL รันในคอนเทนเนอร์ และ import ฐานข้อมูลจาก `docker/db/init/01_pdd.sql` อัตโนมัติครั้งแรก

---

## 1) ติดตั้งสิ่งที่ต้องมีบน Windows

1. **Docker Desktop (Windows)**
   - แนะนำให้เปิด WSL2 backend (Docker Desktop จะช่วยตั้งค่าให้)
2. **ngrok**
   - ใช้เพื่อเปิดให้เข้าจากภายนอกผ่าน HTTPS (เหมาะกับ webhook ต่าง ๆ)

> หมายเหตุ: ถ้าเป็นเครื่อง Windows Server ที่ไม่มี GUI/ติดตั้ง Docker Desktop ลำบาก ให้ใช้ Docker Engine + Compose plugin แทน แต่โดยทั่วไปบน Windows 10/11 แนะนำ Docker Desktop

---

## 2) เตรียมไฟล์ .env

1. คัดลอกไฟล์ตัวอย่าง
   - เปลี่ยนชื่อ `.env.example` เป็น `.env`
2. แก้ค่าอย่างน้อย:
   - `SECRET_KEY` ให้เป็นค่าสุ่มยาว ๆ
   - `DB_PASSWORD` ถ้าต้องการเปลี่ยนรหัส

ตัวอย่าง:
```env
APP_PORT=8080
SECRET_KEY=please-change-this-to-a-long-random-string
DB_PASSWORD=root
DB_NAME=pet_monitoring
```

---

## 3) รันด้วย Docker Compose

เปิด PowerShell หรือ CMD แล้วเข้าโฟลเดอร์โปรเจกต์ (โฟลเดอร์เดียวกับ `docker-compose.yml`) แล้วรัน:

```bash
docker compose up -d --build
```

เช็คสถานะ:
```bash
docker compose ps
```

ดู log:
```bash
docker compose logs -f app
docker compose logs -f db
```

เปิดเว็บ:
- `http://localhost:8080`

---

## 4) เปิดให้เข้าจากภายนอกด้วย ngrok

> ngrok จะให้ URL แบบ HTTPS ซึ่งเหมาะกับ webhook (LINE, Facebook, ฯลฯ)

### 4.1 ตั้งค่า ngrok (ครั้งแรกครั้งเดียว)
1. สมัครบัญชี ngrok แล้วเอา authtoken
2. รัน:
```bash
ngrok config add-authtoken <YOUR_TOKEN>
```

### 4.2 เปิดท่อไปที่พอร์ตเว็บของเรา (8080)
```bash
ngrok http 127.0.0.1:8080
```

ngrok จะโชว์ URL ประมาณนี้:
- `https://xxxx-xx-xx-xx.ngrok-free.app`

ให้ใช้ URL นี้เป็น base URL จากภายนอก เช่น:
- `https://xxxx-xx-xx-xx.ngrok-free.app/`

> ถ้าจะทำ webhook (เช่น LINE) ให้เอา endpoint ของฝั่ง backend ไปต่อท้าย URL ของ ngrok  
> (ในโค้ดชุดนี้ยังไม่ได้เจอ route ชื่อ `/webhook` โดยตรง — ถ้าต้องการให้ทำ route สำหรับ LINE เพิ่ม บอก endpoint ที่ต้องการได้)

---

## 5) รีเซ็ตฐานข้อมูล (กรณีต้องการ import ใหม่)

MySQL จะ import ไฟล์ init เฉพาะตอนที่โวลุ่มฐานข้อมูล “ว่าง” เท่านั้น

ถ้าต้องการล้างแล้ว import ใหม่:
```bash
docker compose down -v
docker compose up -d --build
```

---

## 6) Troubleshooting: เข้า http://localhost:8080 ไม่ได้

1. เช็คว่าคอนเทนเนอร์ขึ้นครบ:
```bash
docker compose ps
```
ควรเห็น `petmon_app` เป็น `healthy` และ `petmon_db` เป็น `healthy`

2. ถ้า app ล่ม ให้ดู log:
```bash
docker compose logs -f app
```

3. ถ้า DB ยังไม่ ready / import นาน:
```bash
docker compose logs -f db
```

4. ถ้ามีพอร์ตชน (8080 ถูกใช้อยู่):
- เปลี่ยนใน `.env` เป็น `APP_PORT=8090` แล้วรันใหม่
- หรือปิดโปรแกรมที่ใช้พอร์ต 8080

---

## โครงสร้าง Docker ที่เพิ่มเข้ามา

- `Dockerfile` : สร้าง image สำหรับ Flask
- `docker-compose.yml` : รัน `app` + `db`
- `docker/db/init/01_pdd.sql` : init DB อัตโนมัติครั้งแรก
- `requirements.txt` : dependencies สำหรับฝั่ง Python
- `.env.example` : ตัวอย่าง env
