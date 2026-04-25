import nodemailer from "nodemailer";
import { env } from "../../config/env.js";

class EmailService {
  private transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
    auth: env.SMTP_USER && env.SMTP_KEY
      ? {
          user: env.SMTP_USER,
          pass: env.SMTP_KEY,
        }
      : undefined,
  });

  async sendForgotPasswordEmail(email: string, resetLink: string) {
    if (!env.SMTP_USER || !env.SMTP_KEY) {
      console.warn("SMTP credentials are not configured. Forgot password email was skipped.");
      return;
    }

    await this.transporter.sendMail({
      from: env.SMTP_USER,
      to: email,
      subject: "Password reset request",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
          <h2>Password reset request</h2>
          <p>Use the secure link below to reset your password.</p>
          <p><a href="${resetLink}">${resetLink}</a></p>
        </div>
      `,
    });
  }
}

export default new EmailService();
