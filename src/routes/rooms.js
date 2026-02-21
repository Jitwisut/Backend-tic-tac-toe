const express = require("express");
const { body, param, validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");
const { authenticate } = require("../middleware/auth");
const { generateRoomCode } = require("../utils/helpers");

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @route   POST /api/rooms
 * @desc    Create a new game room
 * @access  Private
 */
router.post("/", authenticate, async (req, res) => {
  try {
    // Generate unique room code
    let code;
    let isUnique = false;

    while (!isUnique) {
      code = generateRoomCode();
      const existing = await prisma.room.findUnique({ where: { code } });
      if (!existing) isUnique = true;
    }

    // Create room with current user as player1
    const room = await prisma.room.create({
      data: {
        code,
        player1Id: req.user.id,
        status: "waiting",
        currentTurn: "player1",
      },
      include: {
        player1: { select: { id: true, username: true } },
        player2: { select: { id: true, username: true } },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        room: {
          id: room.id,
          code: room.code,
          status: room.status,
          player1: room.player1,
          player2: room.player2,
          player1Id: room.player1Id,
          player2Id: room.player2Id,
          currentTurn: room.currentTurn,
          board: room.board,
          createdAt: room.createdAt,
        },
      },
    });
  } catch (error) {
    console.error("Create room error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create room",
    });
  }
});

/**
 * @route   GET /api/rooms
 * @desc    List available rooms (status=waiting)
 * @access  Private
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      where: {
        // ✅ แก้ตรงนี้: ให้ดึงทั้งห้องที่ "รอ" และ "กำลังเล่น" ออกมา
        status: { in: ["waiting", "in-progress"] },
      },
      include: {
        player1: { select: { id: true, username: true } },
        player2: { select: { id: true, username: true } },
        _count: { select: { spectators: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    res.json({
      success: true,
      data: {
        rooms: rooms.map((room) => ({
          id: room.id,
          code: room.code,
          status: room.status,
          player1: room.player1,
          player2: room.player2,
          spectatorCount: room._count.spectators,
          createdAt: room.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("List rooms error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list rooms",
    });
  }
});

/**
 * @route   GET /api/rooms/:code
 * @desc    Get room details by code
 * @access  Private
 */
router.get(
  "/:code",
  authenticate,
  [param("code").trim().isLength({ min: 6, max: 6 }).toUpperCase()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: "Invalid room code",
        });
      }

      const room = await prisma.room.findUnique({
        where: { code: req.params.code.toUpperCase() },
        include: {
          player1: { select: { id: true, username: true } },
          player2: { select: { id: true, username: true } },
          winner: { select: { id: true, username: true } },
          spectators: {
            include: { user: { select: { id: true, username: true } } },
          },
        },
      });

      if (!room) {
        return res.status(404).json({
          success: false,
          error: "Room not found",
        });
      }

      res.json({
        success: true,
        data: {
          room: {
            id: room.id,
            code: room.code,
            status: room.status,
            player1: room.player1,
            player2: room.player2,
            player1Id: room.player1Id,
            player2Id: room.player2Id,
            currentTurn: room.currentTurn,
            board: room.board,
            winner: room.winner,
            isDraw: room.isDraw,
            spectators: room.spectators.map((s) => s.user),
            version: room.version,
            createdAt: room.createdAt,
            updatedAt: room.updatedAt,
          },
        },
      });
    } catch (error) {
      console.error("Get room error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get room",
      });
    }
  },
);

/**
 * @route   POST /api/rooms/:code/join
 * @desc    Join room as player2
 * @access  Private
 */
router.post(
  "/:code/join",
  authenticate,
  [param("code").trim().isLength({ min: 6, max: 6 }).toUpperCase()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: "Invalid room code",
        });
      }

      const code = req.params.code.toUpperCase();
      const userId = req.user.id;

      const result = await prisma.$transaction(async (tx) => {
        // 1. ดึงข้อมูลห้อง และเช็คด้วยว่า User นี้เป็นคนดู (Spectator) อยู่แล้วหรือเปล่า
        const room = await tx.room.findUnique({
          where: { code },
          include: {
            player1: { select: { id: true, username: true } },
            player2: { select: { id: true, username: true } },
            spectators: {
              where: { userId: userId }, // เช็คเฉพาะ User นี้
            },
          },
        });

        if (!room) {
          throw new Error("ROOM_NOT_FOUND");
        }

        // 2. เช็ค Re-join: ถ้าเป็น Player เดิม หรือเป็นคนดูเดิมอยู่แล้ว ให้กลับเข้าห้องได้เลย
        if (
          room.player1Id === userId ||
          room.player2Id === userId ||
          room.spectators.length > 0
        ) {
          return room;
        }

        // 3. พยายามเข้าเล่น: ถ้าที่นั่ง P2 ว่าง และเกมยังรออยู่ (Waiting) -> ให้เป็น Player 2
        if (!room.player2Id && room.status === "waiting") {
          const updatedRoom = await tx.room.update({
            where: { id: room.id },
            data: {
              player2Id: userId,
              status: "in-progress",
            },
            include: {
              player1: { select: { id: true, username: true } },
              player2: { select: { id: true, username: true } },
            },
          });
          return updatedRoom;
        }

        // 4. ถ้าห้องเต็ม หรือเกมเริ่มไปแล้ว -> จับเป็นคนดู (Spectator) ✅
        // สร้าง record ในตาราง Spectator
        await tx.spectator.create({
          data: {
            roomId: room.id,
            userId: userId,
          },
        });

        // ส่งข้อมูลห้องกลับไป (Frontend จะเห็นว่าตัวเองไม่ใช่ P1/P2 ก็จะแสดงโหมดคนดู)
        return room;
      });

      // ส่ง Response กลับไป
      res.json({
        success: true,
        data: {
          room: {
            id: result.id,
            code: result.code,
            status: result.status,
            player1: result.player1,
            player2: result.player2,
            player1Id: result.player1Id,
            player2Id: result.player2Id,
            currentTurn: result.currentTurn,
            board: result.board,
            createdAt: result.createdAt,
            // อาจจะส่ง flag บอกไปด้วยว่าเข้ามาในฐานะอะไร
            isSpectator:
              result.player1Id !== userId && result.player2Id !== userId,
          },
        },
      });
    } catch (error) {
      console.error("Join room error:", error);

      const errorMessages = {
        ROOM_NOT_FOUND: { status: 404, message: "Room not found" },
      };

      const errorInfo = errorMessages[error.message];
      if (errorInfo) {
        return res.status(errorInfo.status).json({
          success: false,
          error: errorInfo.message,
        });
      }

      res.status(500).json({
        success: false,
        error: "Failed to join room",
      });
    }
  },
);

/**
 * @route   POST /api/rooms/:code/spectate
 * @desc    Join room as spectator
 * @access  Private
 */
router.post(
  "/:code/spectate",
  authenticate,
  [param("code").trim().isLength({ min: 6, max: 6 }).toUpperCase()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: "Invalid room code",
        });
      }

      const code = req.params.code.toUpperCase();

      const room = await prisma.room.findUnique({
        where: { code },
      });

      if (!room) {
        return res.status(404).json({
          success: false,
          error: "Room not found",
        });
      }

      // Check if user is a player
      if (room.player1Id === req.user.id || room.player2Id === req.user.id) {
        return res.status(400).json({
          success: false,
          error: "You are already a player in this room",
        });
      }

      // Add as spectator (upsert to handle duplicates)
      await prisma.spectator.upsert({
        where: {
          roomId_userId: {
            roomId: room.id,
            userId: req.user.id,
          },
        },
        create: {
          roomId: room.id,
          userId: req.user.id,
        },
        update: {},
      });

      res.json({
        success: true,
        message: "Joined as spectator",
      });
    } catch (error) {
      console.error("Spectate room error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to join as spectator",
      });
    }
  },
);

/**
 * @route   POST /api/rooms/:code/leave
 * @desc    Leave room
 * @access  Private
 */
router.post(
  "/:code/leave",
  authenticate,
  [param("code").trim().isLength({ min: 6, max: 6 }).toUpperCase()],
  async (req, res) => {
    try {
      const code = req.params.code.toUpperCase();

      const room = await prisma.room.findUnique({
        where: { code },
      });

      if (!room) {
        return res.status(404).json({
          success: false,
          error: "Room not found",
        });
      }

      // Check if spectator
      if (room.player1Id !== req.user.id && room.player2Id !== req.user.id) {
        // Remove spectator
        await prisma.spectator.deleteMany({
          where: {
            roomId: room.id,
            userId: req.user.id,
          },
        });

        return res.json({
          success: true,
          message: "Left the room",
        });
      }

      // === Player1 (creator) leaves → DELETE the room entirely ===
      if (room.player1Id === req.user.id) {
        await prisma.spectator.deleteMany({ where: { roomId: room.id } });
        await prisma.move.deleteMany({ where: { roomId: room.id } });
        await prisma.room.delete({ where: { id: room.id } });

        return res.json({
          success: true,
          message: "Room deleted (creator left)",
        });
      }

      // === Player2 leaves ===
      if (room.player2Id === req.user.id) {
        if (room.status === "in-progress") {
          // Player2 ออกขณะเล่น → Player1 ชนะ (forfeit)
          await prisma.room.update({
            where: { id: room.id },
            data: {
              status: "finished",
              winnerId: room.player1Id,
              player2Id: null,
            },
          });

          return res.json({
            success: true,
            message: "You forfeited. Player 1 wins.",
          });
        }

        // ห้อง waiting → player2 ออกได้ปกติ
        await prisma.room.update({
          where: { id: room.id },
          data: {
            player2Id: null,
            status: "waiting",
          },
        });

        return res.json({
          success: true,
          message: "Left the room",
        });
      }

      res.json({
        success: true,
        message: "Left the room",
      });
    } catch (error) {
      console.error("Leave room error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to leave room",
      });
    }
  },
);

module.exports = router;
