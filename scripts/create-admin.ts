import { PrismaClient, Role, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import readline from "readline";

const prisma = new PrismaClient();

function prompt(query: string, hide = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    if (hide) {
      // Mute stdin echoing if terminal supports it
      process.stdout.write(query);
      let input = "";
      process.stdin.on("data", (char) => {
        const str = char.toString();
        if (str === "\n" || str === "\r" || str === "\u0004") {
          process.stdin.removeAllListeners("data");
          rl.close();
          process.stdout.write("\n");
          resolve(input.trim());
        } else if (str === "\u0008" || str === "\x7f") {
          input = input.slice(0, -1);
        } else {
          input += str;
        }
      });
    } else {
      rl.question(query, (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    }
  });
}

async function main() {
  console.log("==================================================");
  console.log(" DigiCanvas — Production First Admin Setup");
  console.log("==================================================");

  // 1. Check if an admin already exists (idempotency guard)
  const existingAdmin = await prisma.user.findFirst({
    where: {
      role: { in: [Role.ADMIN, Role.SUPER_ADMIN] },
    },
    select: { id: true, email: true },
  });

  if (existingAdmin) {
    console.log(`\n⚠️  An administrative account already exists in this database: (${existingAdmin.email})`);
    console.log("   For security and data integrity, no additional admin will be created.");
    console.log("   To manage users, log in to the web interface as Admin.\n");
    process.exit(0);
  }

  // 2. Obtain email and password (from env vars or interactive prompt)
  let email = process.env.ADMIN_EMAIL?.trim();
  let password = process.env.ADMIN_PASSWORD?.trim();

  if (!email) {
    email = await prompt("Enter Admin Email: ");
  }

  if (!email || !email.includes("@")) {
    console.error("❌ Error: A valid email address is required.");
    process.exit(1);
  }

  if (!password) {
    password = await prompt("Enter Admin Password (min 8 chars): ");
  }

  if (!password || password.length < 8) {
    console.error("❌ Error: Password must be at least 8 characters long.");
    process.exit(1);
  }

  // Check if this specific email is already registered
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existingUser) {
    console.error(`❌ Error: A user with email "${email}" already exists.`);
    process.exit(1);
  }

  // 3. Hash password with bcrypt (cost factor 12)
  console.log("\n🔒 Hashing password securely...");
  const passwordHash = await bcrypt.hash(password, 12);

  // 4. Create single ADMIN user with zero side-effects/dummy data
  const admin = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      name: "Administrator",
      passwordHash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      organizationId: null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  console.log("\n✅ Production Admin created successfully!");
  console.log(`   ID:        ${admin.id}`);
  console.log(`   Email:     ${admin.email}`);
  console.log(`   Role:      ${admin.role}`);
  console.log(`   Status:    ${admin.status}`);
  console.log(`   CreatedAt: ${admin.createdAt.toISOString()}`);
  console.log("\n🚀 You may now log in to the DigiCanvas portal at /login with these credentials.\n");
}

main()
  .catch((err) => {
    console.error("\n❌ Setup failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
