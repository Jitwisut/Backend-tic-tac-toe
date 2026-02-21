// jobs/cleanup.js
const cron = require("node-cron");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// ตั้งค่าเวลาหมดอายุ
const WAITING_ROOM_EXPIRY_MINUTES = 5;      // ห้อง waiting ที่ไม่มีคนเข้า
const INACTIVE_GAME_EXPIRY_MINUTES = 10;     // เกมที่ไม่มีการเดินนาน

const startCleanupJob = () => {
  // รันทุกๆ 1 นาที
  cron.schedule("* * * * *", async () => {
    console.log("🧹 Running room cleanup job...");

    try {
      // === 1. ลบห้อง waiting ที่เก่าเกินกำหนด (ไม่มีคนเข้า) ===
      const waitingExpiry = new Date(
        Date.now() - WAITING_ROOM_EXPIRY_MINUTES * 60 * 1000,
      );

      // ลบ moves, spectators ที่เกี่ยวข้องก่อน (cascade)
      const expiredWaitingRooms = await prisma.room.findMany({
        where: {
          status: "waiting",
          createdAt: { lt: waitingExpiry },
        },
        select: { id: true, code: true },
      });

      if (expiredWaitingRooms.length > 0) {
        const roomIds = expiredWaitingRooms.map(r => r.id);

        await prisma.spectator.deleteMany({ where: { roomId: { in: roomIds } } });
        await prisma.move.deleteMany({ where: { roomId: { in: roomIds } } });
        await prisma.room.deleteMany({ where: { id: { in: roomIds } } });

        console.log(`✅ Cleaned up ${expiredWaitingRooms.length} expired waiting rooms: ${expiredWaitingRooms.map(r => r.code).join(', ')}`);
      }

      // === 2. ลบห้อง in-progress ที่ไม่มีการเดินนานเกินกำหนด ===
      const inactiveExpiry = new Date(
        Date.now() - INACTIVE_GAME_EXPIRY_MINUTES * 60 * 1000,
      );

      // หาห้อง in-progress ที่ updatedAt เก่า (ไม่มีการ move)
      const inactiveRooms = await prisma.room.findMany({
        where: {
          status: "in-progress",
          updatedAt: { lt: inactiveExpiry },
        },
        select: { id: true, code: true },
      });

      if (inactiveRooms.length > 0) {
        const roomIds = inactiveRooms.map(r => r.id);

        // ลบข้อมูลที่เกี่ยวข้อง
        await prisma.spectator.deleteMany({ where: { roomId: { in: roomIds } } });
        await prisma.move.deleteMany({ where: { roomId: { in: roomIds } } });
        await prisma.room.deleteMany({ where: { id: { in: roomIds } } });

        console.log(`✅ Cleaned up ${inactiveRooms.length} inactive in-progress rooms: ${inactiveRooms.map(r => r.code).join(', ')}`);
      }

      // === 3. ลบห้อง finished ที่จบไปนานแล้ว (เก็บแค่ 30 นาที) ===
      const finishedExpiry = new Date(Date.now() - 30 * 60 * 1000);

      const oldFinishedRooms = await prisma.room.findMany({
        where: {
          status: "finished",
          updatedAt: { lt: finishedExpiry },
        },
        select: { id: true, code: true },
      });

      if (oldFinishedRooms.length > 0) {
        const roomIds = oldFinishedRooms.map(r => r.id);

        await prisma.spectator.deleteMany({ where: { roomId: { in: roomIds } } });
        await prisma.move.deleteMany({ where: { roomId: { in: roomIds } } });
        await prisma.room.deleteMany({ where: { id: { in: roomIds } } });

        console.log(`✅ Cleaned up ${oldFinishedRooms.length} old finished rooms.`);
      }

    } catch (error) {
      console.error("❌ Error cleaning up rooms:", error);
    }
  });

  console.log(`🕒 Room cleanup job scheduled (Every 1 minute)`);
  console.log(`   - Waiting rooms expire after ${WAITING_ROOM_EXPIRY_MINUTES} min`);
  console.log(`   - Inactive games expire after ${INACTIVE_GAME_EXPIRY_MINUTES} min`);
};

module.exports = { startCleanupJob };
