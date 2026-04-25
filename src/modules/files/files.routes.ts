import { Router } from "express";
import authMiddleware from "../../middleware/auth.middleware.js";
import { uploadSingleFile } from "../../middleware/upload.middleware.js";
import filesController from "./files.controller.js";

const router = Router();

router.use(authMiddleware);
router.post("/upload", uploadSingleFile, filesController.upload);
router.get("/", filesController.list);
router.get("/:id", filesController.getById);
router.delete("/:id", filesController.delete);

export default router;
