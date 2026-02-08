import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

function normalizePhone(input: string): string {
  return input.trim().replace(/\D+/g, "");
}

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const adminFullName = process.env.SEED_ADMIN_FULL_NAME?.trim() || "System Admin";
  const adminPhone = normalizePhone(process.env.SEED_ADMIN_PHONE || "0700000000");
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "bdk1234";

  if (!adminPhone) {
    throw new Error("SEED_ADMIN_PHONE is required");
  }
  if (adminPassword.length < 8) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 8 characters");
  }

  // Roles (idempotent)
  const adminRole = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: {},
    create: { name: "ADMIN", description: "Full system access" }
  });
  await prisma.role.upsert({
    where: { name: "MANAGER" },
    update: {},
    create: { name: "MANAGER", description: "Shop manager (restricted visibility)" }
  });
  await prisma.role.upsert({
    where: { name: "SALES" },
    update: {},
    create: { name: "SALES", description: "Sales user (single-shop access)" }
  });

  // Shops (idempotent)
  await prisma.shop.upsert({
    where: { code: "KLA" },
    update: { name: "Kampala Main" },
    create: { code: "KLA", name: "Kampala Main" }
  });
  await prisma.shop.upsert({
    where: { code: "WDG" },
    update: { name: "Wandegeya" },
    create: { code: "WDG", name: "Wandegeya" }
  });

  const existingAdmin = await prisma.user.findUnique({ where: { phone: adminPhone } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.create({
      data: {
        fullName: adminFullName,
        phone: adminPhone,
        passwordHash,
        roleId: adminRole.id,
        notes: "Seeded admin"
      }
    });
    console.log(`Seeded admin user: ${adminPhone}`);
  } else {
    console.log(`Admin user already exists: ${adminPhone}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
