import { PrismaClient } from "../src/generated/prisma/client/index.js";
const prisma = new PrismaClient();

async function clear() {
  const count = await prisma.generatedReport.deleteMany({});
  console.log(`Deleted ${count.count} old reports.`);
  await prisma.$disconnect();
}

clear();
