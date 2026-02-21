// backend/test-db.js
const prisma = require("../prisma/prismaClient"); // เรียกตัวที่เราสร้างเมื่อกี้

async function main() {
  try {
    // 1. ลองสร้าง User ใหม่
    const newUser = await prisma.user.create({
      data: {
        username: "player1",
        password: "securepassword123", // ของจริงต้อง Hash ก่อนนะ!
      },
    });

    console.log("✅ สร้าง User สำเร็จ:", newUser);

    // 2. ลองดึงข้อมูล User ทั้งหมดมาดู
    const allUsers = await prisma.user.findMany();
    console.log("📋 รายชื่อ User ทั้งหมด:", allUsers);
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
