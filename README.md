# 🎮 Tic-Tac-Toe Backend API

RESTful API สำหรับเกม Tic-Tac-Toe แบบ Multiplayer พร้อมระบบสมาชิก, ห้องเล่นเกม, Bot AI และระบบ Replay

## 📋 สารบัญ

- [Tech Stack](#-tech-stack)
- [โครงสร้างโปรเจค](#-โครงสร้างโปรเจค)
- [การติดตั้ง](#-การติดตั้ง)
- [Environment Variables](#-environment-variables)
- [การรันโปรเจค](#-การรันโปรเจค)
- [API Endpoints](#-api-endpoints)
- [Database Schema](#-database-schema)
- [Bot AI (Minimax)](#-bot-ai-minimax)
- [Cron Jobs](#-cron-jobs)
- [Testing](#-testing)
- [Docker](#-docker)
- [Deployment](#-deployment)

---

## 🛠 Tech Stack

| เทคโนโลยี | เวอร์ชัน | รายละเอียด |
|---|---|---|
| **Node.js** | 20+ | Runtime |
| **Express.js** | 4.18 | Web Framework |
| **Prisma ORM** | 5.10 | Database ORM |
| **PostgreSQL** | 15 | ฐานข้อมูลหลัก |
| **JWT** | 9.0 | Authentication (JSON Web Token) |
| **bcryptjs** | 2.4 | การเข้ารหัส Password |
| **Helmet** | 7.1 | HTTP Security Headers |
| **express-validator** | 7.0 | Request Validation |
| **node-cron** | 4.2 | Scheduled Jobs |
| **Jest** | 29.7 | Testing Framework |
| **Supertest** | 6.3 | HTTP Testing |

---

## 📂 โครงสร้างโปรเจค

```
backend/
├── index.js                  # Entry point - Express server setup
├── package.json
├── Dockerfile                # Docker multi-stage build
├── vercel.json               # Vercel deployment config
├── .env                      # Environment variables (ไม่ commit)
├── .env.example              # ตัวอย่าง Environment variables
├── jest.config.js            # Jest test configuration
│
├── prisma/
│   ├── schema.prisma         # Database schema definition
│   ├── prismaClient.js       # Prisma client singleton
│   └── migrations/           # Database migration history
│
├── src/
│   ├── routes/
│   │   ├── auth.js           # POST /register, /login, GET /me
│   │   ├── rooms.js          # CRUD ห้องเกม + join/leave/spectate
│   │   ├── game.js           # POST /move, GET /state, /status
│   │   ├── bot.js            # สร้างเกม Bot + เดินหมาก
│   │   └── replay.js         # ดู replay + ประวัติเกม
│   │
│   ├── services/
│   │   ├── gameLogic.js      # Core: checkWinner, isDraw, isValidMove, makeMove
│   │   └── bot.js            # Minimax Algorithm + Alpha-Beta Pruning
│   │
│   ├── middleware/
│   │   └── auth.js           # JWT authenticate + optionalAuth middleware
│   │
│   ├── jobs/
│   │   └── cleanup.js        # Cron job ลบห้องที่หมดอายุ
│   │
│   └── utils/
│       └── helpers.js        # generateRoomCode, boardToArray, sleep, etc.
│
└── tests/
    ├── concurrency.test.js   # ทดสอบ race condition / optimistic locking
    ├── full_system_test.js   # ทดสอบระบบแบบ end-to-end
    └── test-db.js            # ทดสอบการเชื่อมต่อ database
```

---

## 🚀 การติดตั้ง

### ข้อกำหนดเบื้องต้น

- **Node.js** >= 20.x
- **npm** >= 10.x
- **PostgreSQL** >= 15 (หรือใช้ Docker)

### ขั้นตอน

```bash
# 1. Clone โปรเจค
git clone <repository-url>
cd tic-tac-toe/backend

# 2. ติดตั้ง dependencies
npm install

# 3. สร้างไฟล์ .env จาก .env.example
cp .env.example .env
# แก้ไขค่าต่างๆ ตามต้องการ

# 4. Generate Prisma Client
npx prisma generate

# 5. Push schema ไปยัง database
npx prisma db push
```

---

## 🔐 Environment Variables

สร้างไฟล์ `.env` จาก `.env.example`:

```env
# Server
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/tictactoe?schema=public"

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# CORS
FRONTEND_URL=http://localhost:3000
```

| ตัวแปร | คำอธิบาย | ค่าเริ่มต้น |
|---|---|---|
| `NODE_ENV` | โหมดการทำงาน (`development` / `production`) | `development` |
| `PORT` | พอร์ตเซิร์ฟเวอร์ | `3001` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_SECRET` | Secret key สำหรับสร้าง JWT token | - |
| `JWT_EXPIRES_IN` | อายุ JWT token | `7d` |
| `FRONTEND_URL` | URL ของ frontend (สำหรับ CORS) | `http://localhost:3000` |

---

## ▶️ การรันโปรเจค

```bash
# Development mode (with nodemon hot-reload)
npm run dev

# Production mode
npm start
```

เมื่อเซิร์ฟเวอร์รันสำเร็จจะแสดง:

```
╔════════════════════════════════════════════════════════════╗
║                 TIC-TAC-TOE SERVER                         ║
╠════════════════════════════════════════════════════════════╣
║  Status:     Running                                       ║
║  Port:       3001                                          ║
║  Environment: development                                  ║
║  API Docs:   http://localhost:3001/api                     ║
╚════════════════════════════════════════════════════════════╝
```

### คำสั่ง npm scripts ทั้งหมด

| คำสั่ง | รายละเอียด |
|---|---|
| `npm run dev` | รัน development server (nodemon) |
| `npm start` | รัน production server |
| `npm test` | รัน test ทั้งหมด |
| `npm run test:concurrency` | รัน concurrency test |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema ไปยัง database |
| `npm run db:migrate` | สร้าง migration ใหม่ |

---

## 📡 API Endpoints

Base URL: `http://localhost:3001`

### Health Check

| Method | Endpoint | รายละเอียด |
|---|---|---|
| `GET` | `/health` | ตรวจสอบสถานะเซิร์ฟเวอร์ |
| `GET` | `/api` | API documentation (JSON) |

---

### 🔑 Authentication (`/api/auth`)

| Method | Endpoint | Auth | รายละเอียด |
|---|---|---|---|
| `POST` | `/api/auth/register` | ❌ | สมัครสมาชิก |
| `POST` | `/api/auth/login` | ❌ | เข้าสู่ระบบ |
| `GET` | `/api/auth/me` | ✅ | ดูข้อมูลผู้ใช้ปัจจุบัน |

#### `POST /api/auth/register`

```json
// Request Body
{
  "username": "player1",     // 3-20 ตัวอักษร (a-z, 0-9, _)
  "password": "secret123"   // อย่างน้อย 6 ตัวอักษร
}

// Response (201)
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "username": "player1", "createdAt": "..." },
    "token": "jwt-token-here"
  }
}
```

#### `POST /api/auth/login`

```json
// Request Body
{
  "username": "player1",
  "password": "secret123"
}

// Response (200)
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "username": "player1", "createdAt": "..." },
    "token": "jwt-token-here"
  }
}
```

---

### 🏠 Rooms (`/api/rooms`)

| Method | Endpoint | Auth | รายละเอียด |
|---|---|---|---|
| `POST` | `/api/rooms` | ✅ | สร้างห้องใหม่ (ได้ 6-digit code) |
| `GET` | `/api/rooms` | ✅ | ดูรายการห้องที่รออยู่ |
| `GET` | `/api/rooms/:code` | ✅ | ดูข้อมูลห้องจากรหัส |
| `POST` | `/api/rooms/:code/join` | ✅ | เข้าร่วมห้องเป็น Player 2 |
| `POST` | `/api/rooms/:code/spectate` | ✅ | เข้าดูเกมเป็นผู้ชม |
| `POST` | `/api/rooms/:code/leave` | ✅ | ออกจากห้อง |

- **Room Code**: รหัส 6 ตัวอักษร (ไม่มีตัวที่สับสน เช่น I, O, 0, 1)
- **Room Status**: `waiting` → `in-progress` → `finished`

---

### 🎯 Game (`/api/game`)

| Method | Endpoint | Auth | รายละเอียด |
|---|---|---|---|
| `POST` | `/api/game/:roomId/move` | ✅ | เดินหมาก (ส่ง position + version) |
| `GET` | `/api/game/:roomId/state` | ✅ | ดูสถานะเกม (board, players, turn) |
| `GET` | `/api/game/:roomId/status` | ✅ | ตรวจสอบสถานะเกมแบบเร็ว |

#### `POST /api/game/:roomId/move`

```json
// Request Body
{
  "position": 4,    // ตำแหน่ง 0-8 ตาม grid
  "version": 0      // Optimistic locking version
}

// Response (200)
{
  "success": true,
  "data": {
    "room": { "board": "----X----", "currentTurn": "player2", "version": 1, ... },
    "move": { "position": 4, "symbol": "X", "moveOrder": 1 }
  }
}
```

**ตำแหน่ง Board (0-8):**

```
 0 | 1 | 2
-----------
 3 | 4 | 5
-----------
 6 | 7 | 8
```

**Optimistic Locking**: ใช้ `version` field เพื่อป้องกัน race condition เมื่อผู้เล่น 2 คนส่ง request พร้อมกัน

---

### 🤖 Bot (`/api/bot`)

| Method | Endpoint | Auth | รายละเอียด |
|---|---|---|---|
| `POST` | `/api/bot/create` | ✅ | สร้างเกม Bot ใหม่ (เลือกเดินก่อน/หลัง) |
| `POST` | `/api/bot/:gameId/move` | ✅ | เดินหมากต่อสู้กับ Bot |
| `GET` | `/api/bot/:gameId` | ✅ | ดูสถานะเกม Bot |
| `GET` | `/api/bot/user/games` | ✅ | ดูประวัติเกม Bot ทั้งหมด |

#### `POST /api/bot/create`

```json
// Request Body
{
  "goFirst": true   // true = ผู้เล่นเดินก่อน (X), false = Bot เดินก่อน (X)
}
```

---

### 📺 Replay (`/api/replay`)

| Method | Endpoint | Auth | รายละเอียด |
|---|---|---|---|
| `GET` | `/api/replay/:roomId` | ✅ | ดู replay ของเกม (move-by-move) |
| `GET` | `/api/replay/user/history` | ✅ | ดูประวัติเกมของผู้ใช้ |

---

### 🔒 Authentication Header

ทุก endpoint ที่ต้องการ Auth (✅) ต้องส่ง JWT token ใน header:

```
Authorization: Bearer <jwt-token>
```

### ❌ Error Response Format

```json
{
  "success": false,
  "error": "Error message here"
}

// หรือ validation errors
{
  "success": false,
  "errors": ["Username must be between 3-20 characters", "Password must be at least 6 characters"]
}
```

---

## 🗄 Database Schema

ใช้ **Prisma ORM** กับ **PostgreSQL**

### Models

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    User      │     │    Room      │     │    Move      │
├─────────────┤     ├─────────────┤     ├─────────────┤
│ id (UUID)    │──┐  │ id (UUID)    │──┐  │ id (UUID)    │
│ username     │  ├──│ player1Id    │  ├──│ roomId       │
│ password     │  ├──│ player2Id    │  │  │ playerId     │
│ createdAt    │  └──│ winnerId     │  │  │ position     │
│ updatedAt    │     │ code (6-char)│  │  │ symbol (X/O) │
└─────────────┘     │ status       │  │  │ moveOrder    │
                    │ board (9-ch) │  │  │ createdAt    │
                    │ currentTurn  │  │  └─────────────┘
                    │ isDraw       │  │
                    │ version      │  │  ┌─────────────┐
                    └─────────────┘  │  │  Spectator   │
                                     │  ├─────────────┤
┌─────────────┐     ┌─────────────┐  └──│ roomId       │
│   BotGame    │     │   BotMove   │     │ userId       │
├─────────────┤     ├─────────────┤     └─────────────┘
│ id (UUID)    │──── │ gameId       │
│ userId       │     │ player       │
│ board        │     │ position     │
│ playerSymbol │     │ symbol       │
│ currentTurn  │     │ moveOrder    │
│ status       │     └─────────────┘
│ winner       │
│ version      │
└─────────────┘
```

### Board Representation

- Board เก็บเป็น string 9 ตัวอักษร: `---------` (ว่าง), `X--O-X---`, etc.
- `-` = ช่องว่าง, `X` = Player 1, `O` = Player 2

---

## 🤖 Bot AI (Minimax)

Bot ใช้ **Minimax Algorithm** พร้อม **Alpha-Beta Pruning**:

1. **ไม่มีวันแพ้** - Bot จะชนะหรือเสมอเท่านั้น
2. **Strategy Shortcuts** - Move แรกเลือกตรงกลาง (position 4) ทันที
3. **Immediate Win/Block** - ตรวจสอบ win/block ก่อนรัน minimax
4. **Alpha-Beta Pruning** - ตัดกิ่งที่ไม่จำเป็นออกเพื่อประสิทธิภาพ

### Win Detection

ตรวจสอบ 8 แนวชนะ: 3 แถวแนวนอน, 3 แถวแนวตั้ง, 2 แนวทแยง

---

## ⏰ Cron Jobs

ระบบ cleanup อัตโนมัติ รันทุก 1 นาที:

| Rule | เวลาหมดอายุ | รายละเอียด |
|---|---|---|
| ห้อง `waiting` | 5 นาที | ห้องที่สร้างแล้วไม่มีคนเข้า |
| ห้อง `in-progress` | 10 นาที | เกมที่ไม่มีการเดินนาน |
| ห้อง `finished` | 30 นาที | เกมที่จบแล้ว |

---

## 🧪 Testing

```bash
# รัน test ทั้งหมด
npm test

# รันเฉพาะ concurrency test
npm run test:concurrency
```

### Test Files

| ไฟล์ | รายละเอียด |
|---|---|
| `tests/concurrency.test.js` | ทดสอบ race condition + optimistic locking |
| `tests/full_system_test.js` | ทดสอบระบบแบบ end-to-end |
| `tests/test-db.js` | ทดสอบการเชื่อมต่อ database |

---

## 🐳 Docker

### รันด้วย Docker Compose (แนะนำ)

จาก root directory:

```bash
docker-compose up --build
```

จะรัน 3 services:
- **backend** → `localhost:3001`
- **frontend** → `localhost:3000`
- **PostgreSQL** → `localhost:5433`

### รันเฉพาะ Backend

```bash
cd backend
docker build -t tictactoe-backend .
docker run -p 3001:3001 --env-file .env tictactoe-backend
```

### Dockerfile Features

- **Multi-stage build** เพื่อลดขนาด image
- ใช้ `node:20-alpine` เป็น base image
- **Health check** endpoint ที่ `/health`
- Auto-run `prisma db push` ตอนเริ่ม container

---

## 🌐 Deployment

### Vercel

โปรเจคมี `vercel.json` พร้อมใช้งาน:

```json
{
  "version": 2,
  "builds": [{ "src": "index.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "index.js" }]
}
```

### Environment Variables ที่ต้องตั้งบน Production

- `DATABASE_URL` - PostgreSQL connection string (แนะนำ Neon / Supabase)
- `JWT_SECRET` - **ต้องเปลี่ยน** เป็น secret ที่แข็งแรง
- `FRONTEND_URL` - URL ของ frontend ที่ deploy แล้ว
- `NODE_ENV` - ตั้งเป็น `production`

---

## 📝 License

ISC
