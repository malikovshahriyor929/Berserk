import { prisma } from "../prisma.js";
import bcrypt from "bcrypt";
import tokenService from "./token.service.js";
import userDto from "../../dtos/auth.dto.js";
import emailService from "./email.service.js";

class AuthService {
  async register(email: string, password: string, name: string) {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new Error("User already exists with this email address!");
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, name },
    });
    const userdto = new userDto(user);
    const token = await tokenService.generateTokens({
      id: user.id,
      email: user.email,
    });
    await tokenService.saveTokens(user.id, token.refreshToken);

    return { userdto, tokens: token };
  }
  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      throw new Error("User not found");
    }
    const isPasswordValid = bcrypt.compareSync(
      password,
      user.passwordHash || "",
    );
    if (!isPasswordValid) {
      throw new Error("Invalid password");
    }
    const userdto = new userDto(user);
    const token = await tokenService.generateTokens({
      id: user.id,
      email: user.email,
    });
    await tokenService.saveTokens(user.id, token.refreshToken);

    return { userdto, tokens: token };
  }
  async refreshTokens(refreshToken: string) {
    const userData = tokenService.validateRefreshToken(refreshToken);
    if (!userData) {
      throw new Error("Invalid refresh token");
    }
    const user = await prisma.user.findUnique({
      where: { id: (userData as any).id },
    });
    if (!user) {
      throw new Error("User not found");
    }
    const token = await tokenService.generateTokens({
      id: user.id,
      email: user.email,
    });
    await tokenService.saveTokens(user.id, token.refreshToken);
    const userdto = new userDto(user);
    return { userdto, tokens: token };
  }
  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      throw new Error("User not found");
    }
    const userdto = new userDto(user);
    const token = await tokenService.generateTokens({ userData: userdto });
    await tokenService.saveTokens(user.id, token.refreshToken);
    await emailService.sendMailsForgotPassword(
      email,
      `${process.env.API_URL}/api/auth/forgort-password/${userdto.id}/${token.accessToken}`,
    );
    return { message: "Forgot password email sent successfully" };
  }

  async resetPassword(
    userId: string,
    accessToken: string,
    newPassword: string,
  ) {
    const userData = tokenService.validateAccessToken(accessToken);
    if (!userData || (userData as any).userData.id !== userId) {
      console.log(userData as any, userId, newPassword, accessToken);

      throw new Error("Invalid or expired access token ");
    }
    const passwordHash = bcrypt.hashSync(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return { message: "Password reset successfully" };
  }
}

export default new AuthService();
