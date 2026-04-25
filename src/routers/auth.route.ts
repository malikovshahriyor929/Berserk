import express from "express";
import authController from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/refresh-token", authController.refreshTokens);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password/:userId/:accessToken", authController.resetPassword);

export default router;