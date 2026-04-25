import bcrypt from "bcrypt";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";
import emailService from "./email.service.js";
import tokenService, { type JwtUserPayload } from "./token.service.js";

function toUserDto(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function toJwtPayload(user: {
  id: string;
  email: string;
  name: string;
  role: string;
}): JwtUserPayload {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

class AuthService {
  async register(email: string, password: string, name: string) {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw ApiError.badRequest("User already exists with this email address");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        fullName: name,
      },
    });

    const tokens = await tokenService.generateTokens(toJwtPayload(user));
    await tokenService.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      userdto: toUserDto(user),
      tokens,
    };
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      throw ApiError.badRequest("User not found");
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw ApiError.badRequest("Invalid password");
    }

    const tokens = await tokenService.generateTokens(toJwtPayload(user));
    await tokenService.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      userdto: toUserDto(user),
      tokens,
    };
  }

  async refreshTokens(refreshToken: string) {
    const payload = tokenService.validateRefreshToken(refreshToken);

    if (!payload) {
      throw ApiError.unauthorized("Invalid refresh token");
    }

    await tokenService.assertRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
    });

    if (!user) {
      throw ApiError.unauthorized("User not found");
    }

    const tokens = await tokenService.generateTokens(toJwtPayload(user));
    await tokenService.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      userdto: toUserDto(user),
      tokens,
    };
  }

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw ApiError.badRequest("User not found");
    }

    const tokens = await tokenService.generateTokens(toJwtPayload(user));
    const resetLink = `${env.API_URL}/api/auth/reset-password/${user.id}/${tokens.accessToken}`;
    await emailService.sendForgotPasswordEmail(email, resetLink);

    return {
      message: "Forgot password email sent successfully",
    };
  }

  async resetPassword(userId: string, accessToken: string, newPassword: string) {
    const payload = tokenService.validateAccessToken(accessToken);

    if (!payload || payload.id !== userId) {
      throw ApiError.badRequest("Invalid or expired access token");
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return {
      message: "Password reset successfully",
    };
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw ApiError.notFound("User not found");
    }

    return toUserDto(user);
  }
}

export default new AuthService();
