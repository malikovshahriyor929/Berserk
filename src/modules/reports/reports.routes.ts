import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import reportsController from "./reports.controller.js";

const router = Router();

router.use(authMiddleware);
router.post("/generate", reportsController.generate);
router.get("/", reportsController.list);
router.get("/:id", reportsController.getById);
router.get("/:id/download", reportsController.download);

export default router;
