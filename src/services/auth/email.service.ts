import nodemailer from "nodemailer";
import "dotenv/config";
class MailService {
  transporter;
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "",
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: false,
      auth: {
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_KEY || "",
      },
    });
  }
  async sendMailsForgotPassword(email: string, activationLink: string) {
    const subject = "Forgot your password?";

    const html = `
  <!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0; padding:0; background:#f5f7fb;">
    <!-- Preheader (hidden preview text) -->
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
      Reset your password using the secure link inside.
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f5f7fb; padding:24px 0;">
      <tr>
        <td align="center" style="padding: 0 14px;">
          <!-- Container -->
          <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:100%; max-width:600px;">
            
            <!-- Brand / Header -->
            <tr>
              <td style="padding: 10px 6px 18px 6px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="left" style="font-family: Arial, Helvetica, sans-serif; font-size:16px; color:#111827;">
                      <span style="display:inline-block; padding:8px 12px; background:#111827; color:#ffffff; border-radius:999px; font-weight:700;">
                        something Library
                      </span>
                    </td>
                    <td align="right" style="font-family: Arial, Helvetica, sans-serif; font-size:12px; color:#6b7280;">
                      Security notification
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td style="background:#ffffff; border-radius:16px; padding:0; box-shadow: 0 10px 25px rgba(17,24,39,0.08); overflow:hidden;">
                
                <!-- Card top accent -->
                <div style="height:6px; background: linear-gradient(90deg, #2563eb, #7c3aed);"></div>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:26px 22px 18px 22px;">
                  <tr>
                    <td style="font-family: Arial, Helvetica, sans-serif; color:#111827;">
                      <div style="font-size:18px; font-weight:800; margin:0 0 10px 0;">
                        Password reset request
                      </div>
                      <div style="font-size:14px; line-height:1.6; color:#374151;">
                        We received a request to reset the password for your account.
                        If you made this request, click the button below to set a new password.
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:18px 0 8px 0;">
                      <!-- Button -->
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td bgcolor="#2563eb" style="border-radius:12px;">
                            <a href="${activationLink}"
                               style="
                                 display:inline-block;
                                 font-family: Arial, Helvetica, sans-serif;
                                 font-size:14px;
                                 font-weight:700;
                                 color:#ffffff;
                                 text-decoration:none;
                                 padding:12px 18px;
                                 border-radius:12px;
                               ">
                              Reset password
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

             

                  <tr>
                    <td style="padding-top:14px; font-family: Arial, Helvetica, sans-serif; font-size:13px; color:#374151; line-height:1.6;">
                      If you didn’t request this, you can safely ignore this email — your password won’t change.
                    </td>
                  </tr>
                </table>

                <!-- Divider -->
                <div style="height:1px; background:#eef2f7;"></div>

                <!-- Footer inside card -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:16px 22px 20px 22px;">
                  <tr>
                    <td style="font-family: Arial, Helvetica, sans-serif; font-size:12px; color:#6b7280; line-height:1.6;">
                      Best regards,<br/>
                      <span style="font-weight:700; color:#111827;">something Team</span>
                    </td>
                    <td align="right" style="font-family: Arial, Helvetica, sans-serif; font-size:12px; color:#9ca3af;">
                      © ${new Date().getFullYear()}
                    </td>
                  </tr>
                </table>

              </td>
            </tr>

            <!-- Outer footer -->
            <tr>
              <td style="padding:16px 6px 0 6px; font-family: Arial, Helvetica, sans-serif; font-size:11px; color:#9ca3af; line-height:1.6;">
                You are receiving this email because a password reset was requested for your account.
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;

    await this.transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject,
      html,
    });
  }
}

export default new MailService();
