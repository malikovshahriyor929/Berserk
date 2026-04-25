import app from "./app.js";
import { prisma } from "./config/prisma.js";
import { env } from "./config/env.js";

async function start() {
  await prisma.$connect();
  app.listen(env.PORT, "0.0.0.0", () => {
    console.log(`Server is running on 0.0.0.0:${env.PORT}`);
  });
}

async function shutdown(signal: string) {
  console.log(`${signal} received. Shutting down...`);
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

void start().catch(async (error) => {
  console.error("Startup failed", error);
  await prisma.$disconnect();
  process.exit(1);
});
