import { Router } from "express";
import authController from "./auth.controller.js";
import authMiddleware from "../../middleware/auth.middleware.js";

const router = Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/refresh-token", authController.refreshTokens);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password/:userId/:accessToken", authController.resetPassword);
router.get("/me", authMiddleware, authController.me);

export default router;
