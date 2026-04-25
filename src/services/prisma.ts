import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const rawDatabaseUrl = process.env.DATABASE_URL;
if (!rawDatabaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const connectionString = (() => {
  if (/[?&]sslmode=/.test(rawDatabaseUrl)) return rawDatabaseUrl;
  if (rawDatabaseUrl.includes("render.com")) {
    const separator = rawDatabaseUrl.includes("?") ? "&" : "?";
    return `${rawDatabaseUrl}${separator}sslmode=require`;
  }
  return rawDatabaseUrl;
})();

const adapter = new PrismaPg({ connectionString });
export const prisma = new PrismaClient({ adapter });
