import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash1 = await bcrypt.hash('Password123!', 12);
  const passwordHash2 = await bcrypt.hash('Password123!', 12);
  const lockedHash = await bcrypt.hash('Password123!', 12);
  const disabledHash = await bcrypt.hash('Password123!', 12);

  // Upsert demo workers — idempotent for repeated runs
  const workers = [
    { email: 'worker1@example.com', passwordHash: passwordHash1, role: 'WORKER' as const, status: 'ACTIVE' as const },
    { email: 'worker2@example.com', passwordHash: passwordHash2, role: 'WORKER' as const, status: 'ACTIVE' as const },
    { email: 'locked@example.com', passwordHash: lockedHash, role: 'WORKER' as const, status: 'LOCKED' as const },
    { email: 'disabled@example.com', passwordHash: disabledHash, role: 'WORKER' as const, status: 'DISABLED' as const },
  ];

  for (const w of workers) {
    await prisma.user.upsert({
      where: { email: w.email },
      update: { passwordHash: w.passwordHash, status: w.status, role: w.role },
      create: { email: w.email, passwordHash: w.passwordHash, role: w.role, status: w.status },
    });
    console.log(`Seeded user: ${w.email} (${w.status})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
