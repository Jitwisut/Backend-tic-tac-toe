require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { PrismaClient } = require("@prisma/client");
const { startCleanupJob } = require("./src/jobs/cleanup");
// Import routes
const authRoutes = require("./src/routes/auth");
const roomsRoutes = require("./src/routes/rooms");
const gameRoutes = require("./src/routes/game");
const replayRoutes = require("./src/routes/replay");
const botRoutes = require("./src/routes/bot");

const app = express();
const prisma = new PrismaClient();
startCleanupJob(); //เรียกใช้ฟังก์ชันลบห้องที่ไม่มีใครเล่น
// Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (development)
if (process.env.NODE_ENV === "development") {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomsRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/replay", replayRoutes);
app.use("/api/bot", botRoutes);

// API documentation endpoint
app.get("/api", (req, res) => {
  res.json({
    name: "Tic-Tac-Toe API",
    version: "1.0.0",
    description: "RESTful API for multiplayer Tic-Tac-Toe game",
    endpoints: {
      auth: {
        "POST /api/auth/register": "Register new user",
        "POST /api/auth/login": "Login user",
        "GET /api/auth/me": "Get current user (auth required)",
      },
      rooms: {
        "POST /api/rooms": "Create new room (auth required)",
        "GET /api/rooms": "List waiting rooms (auth required)",
        "GET /api/rooms/:code": "Get room by code (auth required)",
        "POST /api/rooms/:code/join": "Join room as player2 (auth required)",
        "POST /api/rooms/:code/spectate": "Join as spectator (auth required)",
        "POST /api/rooms/:code/leave": "Leave room (auth required)",
      },
      game: {
        "POST /api/game/:roomId/move": "Make a move (auth required)",
        "GET /api/game/:roomId/state": "Get game state (auth required)",
        "GET /api/game/:roomId/status": "Quick status check (auth required)",
      },
      replay: {
        "GET /api/replay/:roomId": "Get game replay (auth required)",
        "GET /api/replay/user/history": "Get user game history (auth required)",
      },
      bot: {
        "POST /api/bot/create": "Create bot game (auth required)",
        "POST /api/bot/:gameId/move": "Make move vs bot (auth required)",
        "GET /api/bot/:gameId": "Get bot game state (auth required)",
        "GET /api/bot/user/games": "Get bot game history (auth required)",
      },
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err);

  res.status(err.status || 500).json({
    success: false,
    error:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
  });
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Closing server...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received. Closing server...");
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                 TIC-TAC-TOE SERVER                         ║
╠════════════════════════════════════════════════════════════╣
║  Status:     Running                                       ║
║  Port:       ${PORT}                                          ║
║  Environment: ${process.env.NODE_ENV || "development"}                               ║
║  API Docs:   http://localhost:${PORT}/api                     ║
╚════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
