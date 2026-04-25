import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import reportTemplateController from "./report-template.controller.js";

const router = Router();

router.use(authMiddleware);
router.post("/", reportTemplateController.create);
router.get("/", reportTemplateController.list);
router.get("/:id", reportTemplateController.getById);
router.patch("/:id", reportTemplateController.update);
router.delete("/:id", reportTemplateController.delete);

export default router;
