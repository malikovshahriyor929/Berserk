import jwt from "jsonwebtoken";
import type { StringValue } from "ms";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";

export type JwtUserPayload = {
  id: string;
  email: string;
  role: string;
  name: string;
};

class TokenService {
  async generateTokens(payload: JwtUserPayload) {
    const accessToken = jwt.sign(payload, env.JWT_ACCESS_KEY, {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as StringValue,
    });

    const refreshToken = jwt.sign(payload, env.JWT_REFRESH_KEY, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as StringValue,
    });

    return { accessToken, refreshToken };
  }

  async saveRefreshToken(userId: string, refreshToken: string) {
    const decoded = jwt.decode(refreshToken) as { exp?: number } | null;
    const expiresAt = decoded?.exp
      ? new Date(decoded.exp * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    return prisma.token.upsert({
      where: { userId },
      update: {
        token: refreshToken,
        expiresAt,
      },
      create: {
        userId,
        token: refreshToken,
        expiresAt,
      },
    });
  }

  async assertRefreshToken(refreshToken: string) {
    const tokenRecord = await prisma.token.findUnique({
      where: { token: refreshToken },
    });

    if (!tokenRecord) {
      throw ApiError.unauthorized("Refresh token is not recognized");
    }

    return tokenRecord;
  }

  validateAccessToken(token: string) {
    try {
      return jwt.verify(token, env.JWT_ACCESS_KEY) as JwtUserPayload;
    } catch {
      return null;
    }
  }

  validateRefreshToken(token: string) {
    try {
      return jwt.verify(token, env.JWT_REFRESH_KEY) as JwtUserPayload;
    } catch {
      return null;
    }
  }
}

export default new TokenService();
