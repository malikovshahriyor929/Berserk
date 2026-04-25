import "dotenv/config";
import express from "express";
import path from "node:path";
import authRouter from "./routers/auth.route.js";
import BaseError from "./errors/auth.errors.js";
import { prisma } from "./services/prisma.js";
import globalRouter from "./routers/global.route.js";
import cors from "cors";

const app = express();
const port = Number(process.env.PORT || 5050);
const host = "0.0.0.0";

const allowedOrigins = process.env.CORS_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean) || ["http://localhost:3001", "http://localhost:3000"];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS blocked"));
    },
  }),
);

app.use(express.json());
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));
app.get("/", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/", globalRouter);
app.use("/auth", authRouter);

app.use(
  (
    err: unknown,
    req: express.Request,
    res: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    next: express.NextFunction,
  ) => {
    if (err instanceof BaseError) {
      return res
        .status(err.status)
        .json({ message: err.message, errors: err.errors });
    }
    console.error("Unhandled error:", err);
    return res.status(500).json({ message: "Internal server error" });
  },
);

const starter = async () => {
  try {
    await prisma.$connect();
    console.log("Connected to DB");
    app.listen(port, host, () => {
      console.log(`Server is running on ${host}:${port}`);
    });
  } catch (error) {
    console.log(`Connecting DB error: ${error}`);
  }
};
async function shutdown(signal: string) {
  console.log(`\n${signal} received. Shutting down...`);
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

starter();
