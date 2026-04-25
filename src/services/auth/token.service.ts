import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";

export type AccessPayload = {
  id: string;
  email: string;
  role?: string;
};

class TokenService {
  async generateTokens(payload: object) {
    const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_KEY!, {
      expiresIn: "15m",
    });
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_KEY!, {
      expiresIn: "30d",
    });
    return { accessToken, refreshToken };
  }
  async saveTokens(userId: string, refreshToken: string) {
    if (!userId) return;
    const tokenExisting = await prisma.token.findFirst({
      where: { userId },
    });
    if (tokenExisting) {
      return await prisma.token.update({
        where: { id: tokenExisting.id },
        data: { token: refreshToken },
      });
    } else {
      return await prisma.token.create({
        data: {
          userId,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  validateAccessToken(token: string) {
    try {
      return jwt.verify(token, process.env.JWT_ACCESS_KEY!) as AccessPayload | null;
    } catch (err) {
      return null;
    }
  }

  validateRefreshToken(token: string) {
    try {
      return jwt.verify(token, process.env.JWT_REFRESH_KEY!) as AccessPayload | null;
    } catch (err) {
      return null;
    }
  }
}

export default new TokenService();
