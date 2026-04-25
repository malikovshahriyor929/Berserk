import type { NextFunction, Request, Response } from "express";
import BaseError from "../errors/auth.errors.js";
import authService from "../services/auth/auth.service.js";

interface ErrorProp {
  message: string;
  status: number;
  errors: string;
}

class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, name } = req.body;

      if (!email || !password || !name) {
        return next(
          BaseError.badRequest(
            "Registration failed",
            "email, password, and name are required",
          ),
        );
      }

      const result = await authService.register(email, password, name);
      return res.status(201).json(result);
    } catch (error: unknown) {
      next(
        BaseError.badRequest(
          "Registration failed",
          (error as ErrorProp).message || "Unknown error",
        ),
      );
    }
  }
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return next(
          BaseError.badRequest(
            "Login failed",
            "email and password are required",
          ),
        );
      }

      const result = await authService.login(email, password);
      return res.status(200).json(result);
    } catch (error: any | { message?: string }) {
      console.error("Login error:", error);
      next(
        BaseError.badRequest("Login failed", error?.message || "Unknown error"),
      );
    }
  }
  async refreshTokens(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return next(
          BaseError.badRequest(
            "Token refresh failed",
            "refreshToken is required",
          ),
        );
      }

      const result = await authService.refreshTokens(refreshToken);
      return res.status(200).json(result);
    } catch (error) {
      console.error("Logout error:", error);
      next(
        BaseError.badRequest(
          "Logout failed",
          (error as any).message || "Unknown error",
        ),
      );
    }
  }
  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;

      if (!email) {
        return next(
          BaseError.badRequest("Forgot password failed", "email is required"),
        );
      }

      const result = await authService.forgotPassword(email);
      return res.status(200).json(result);
    } catch (error: unknown) {
      next(
        BaseError.badRequest(
          "Forgot password failed",
          (error as ErrorProp).message || "Unknown error",
        ),
      );
    }
  }
  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, accessToken } = req.params;
      const { newPassword } = req.body;

      if (!userId || !accessToken || !newPassword) {
        return next(
          BaseError.badRequest(
            "Reset password failed",
            "userId, accessToken, and newPassword are required",
          ),
        );
      }

      const result = await authService.resetPassword(
        userId as string,
        accessToken as string,
        newPassword,
      );
      return res.status(200).json(result);
    } catch (error: unknown) {
      next(
        BaseError.badRequest(
          "Reset password failed",
          (error as ErrorProp).message || "Unknown error",
        ),
      );
    }
  }
}

export default new AuthController();
