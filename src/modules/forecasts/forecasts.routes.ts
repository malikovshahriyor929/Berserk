import { Router } from "express";
import forecastsController from "./forecasts.controller.js";
import authMiddleware from "../../middleware/auth.middleware.js";

const router = Router();

router.use(authMiddleware);

router.post("/run", forecastsController.runForecast);
router.get("/", forecastsController.list);
router.get("/:id", forecastsController.getById);
router.delete("/:id", forecastsController.delete);
router.get("/readiness/:uploadId", forecastsController.getReadiness);

export default router;
