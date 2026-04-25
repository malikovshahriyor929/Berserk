import express from "express";
import path from "node:path";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import authRoutes from "./modules/auth/auth.routes.js";
import filesRoutes from "./modules/files/files.routes.js";
import attributesRoutes from "./modules/attributes/attributes.routes.js";
import aiRoutes from "./modules/ai/ai.routes.js";
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";
import reportTemplateRoutes from "./modules/report-templates/report-template.routes.js";
import reportsRoutes from "./modules/reports/reports.routes.js";
import { errorMiddleware } from "./middleware/error.middleware.js";

const app = express();

app.use(helmet());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
}));

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigins.length === 0 || env.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS blocked"));
    },
  }),
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/auth", authRoutes);
app.use("/api/files", filesRoutes);
app.use("/api/attributes", attributesRoutes);
app.use("/api/analyses", aiRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/report-templates", reportTemplateRoutes);
app.use("/api/reports", reportsRoutes);

app.use(errorMiddleware);

export default app;
