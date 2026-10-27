import nodemailer from 'nodemailer';

export interface PasswordResetMailer {
  sendPasswordResetOtp(
    email: string,
    otp: string,
    ttlMinutes: number,
  ): Promise<void>;
}

export class SmtpEmailService implements PasswordResetMailer {
  private readonly transporter:
    ReturnType<typeof nodemailer.createTransport> | undefined;

  constructor(
    private readonly configuration: {
      host?: string | undefined;
      port: number;
      user?: string | undefined;
      pass?: string | undefined;
      from?: string | undefined;
    },
  ) {
    const { host, port, user, pass, from } = configuration;
    if (host && user && pass && from) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    }
  }

  async sendPasswordResetOtp(
    email: string,
    otp: string,
    ttlMinutes: number,
  ): Promise<void> {
    if (!this.transporter) {
      throw new Error('SMTP is not configured');
    }
    await this.transporter.sendMail({
      from: this.configuration.from,
      to: email,
      subject: 'Smart Campus LMS password reset',
      text: `Your password reset code is ${otp}. It expires in ${ttlMinutes} minutes. If you did not request this, you can ignore this email.`,
    });
  }
}
