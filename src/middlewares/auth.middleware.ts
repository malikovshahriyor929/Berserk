import type { NextFunction, Request, Response } from "express";
import BaseError from "../errors/auth.errors.js";
import tokenService from "../services/auth/token.service.js";

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export default function (req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return next(BaseError.UnauthorizedError());

    const [, token] = authHeader.split(" ");
    if (!token) return next(BaseError.UnauthorizedError());

    const payload = tokenService.validateAccessToken(token);
    if (!payload) return next(BaseError.UnauthorizedError());

    // Support both { id, email } and { userData: {...} } payload shapes
    req.user = (payload as any).userData ?? payload;
    next();
  } catch (error) {
    return next(BaseError.UnauthorizedError());
  }
}
