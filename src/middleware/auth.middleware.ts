import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/api-error.js";
import tokenService from "../modules/auth/token.service.js";

export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return next(ApiError.unauthorized());
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return next(ApiError.unauthorized());
  }

  const payload = tokenService.validateAccessToken(token);
  if (!payload) {
    return next(ApiError.unauthorized());
  }

  req.user = payload;
  return next();
}

export default authMiddleware;
