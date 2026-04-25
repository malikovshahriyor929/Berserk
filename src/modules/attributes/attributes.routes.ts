import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import attributesController from "./attributes.controller.js";

const router = Router();

router.use(authMiddleware);
router.get("/palette", attributesController.palette);
router.get("/", attributesController.list);
router.get("/:id", attributesController.getById);
router.get("/:id/versions", attributesController.versions);

export default router;
