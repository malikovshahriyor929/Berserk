import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async-handler.js";
import authService from "./auth.service.js";
import { ApiError } from "../../utils/api-error.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6),
});

class AuthController {
  register = asyncHandler(async (req: Request, res: Response) => {
    const payload = registerSchema.parse(req.body);
    const result = await authService.register(
      payload.email,
      payload.password,
      payload.name,
    );

    res.status(201).json(result);
  });

  login = asyncHandler(async (req: Request, res: Response) => {
    const payload = loginSchema.parse(req.body);
    const result = await authService.login(payload.email, payload.password);
    res.status(200).json(result);
  });

  refreshTokens = asyncHandler(async (req: Request, res: Response) => {
    const payload = refreshSchema.parse(req.body);
    const result = await authService.refreshTokens(payload.refreshToken);
    res.status(200).json(result);
  });

  forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const payload = forgotPasswordSchema.parse(req.body);
    const result = await authService.forgotPassword(payload.email);
    res.status(200).json(result);
  });

  resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const params = z.object({
      userId: z.string().min(1),
      accessToken: z.string().min(1),
    }).parse(req.params);
    const payload = resetPasswordSchema.parse(req.body);

    const result = await authService.resetPassword(
      params.userId,
      params.accessToken,
      payload.newPassword,
    );

    res.status(200).json(result);
  });

  me = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      throw ApiError.unauthorized();
    }

    const result = await authService.getProfile(userId);
    res.status(200).json(result);
  });
}

export default new AuthController();
