import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import aiController from "./ai.controller.js";

const router = Router();

router.use(authMiddleware);
router.post("/:uploadId/run", aiController.run);
router.get("/", aiController.list);
router.get("/:id", aiController.getById);

export default router;
