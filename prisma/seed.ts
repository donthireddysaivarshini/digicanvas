import { PrismaClient, Role, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log("🧹 Cleaning all sample data...");

  // 1. Clean existing development data in reverse dependency order
  await prisma.activityLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.captionVersion.deleteMany();
  await prisma.contentPlatform.deleteMany();
  await prisma.content.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  console.log("🌱 Creating initial Admin user...");

  // 2. Create Agency Admin User
  const adminPasswordHash = await hashPassword("AdminPass123!");
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@digicanvas.local",
      name: "Agency Admin",
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  console.log(`✓ Admin created successfully!`);
  console.log(`  Email: ${adminUser.email}`);
  console.log(`  Password: AdminPass123!`);
  console.log("✅ Database reset complete with Admin-only access.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
