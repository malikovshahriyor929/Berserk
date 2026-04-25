import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import dashboardController from "./dashboard.controller.js";

const router = Router();

router.use(authMiddleware);
router.get("/summary", dashboardController.summary);
router.get("/charts", dashboardController.charts);
router.get("/uploads", dashboardController.uploads);
router.get("/reports", dashboardController.reports);

export default router;
