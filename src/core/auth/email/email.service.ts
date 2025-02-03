import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.get<string>('EMAIL_USER'),
        pass: config.get<string>('EMAIL_PASSWORD'),
      },
    } as nodemailer.TransportOptions);
  }

  async sendVerificationEmail(email: string, token: string) {
    await this.transporter.sendMail({
      from: this.config.get('EMAIL_FROM'),
      to: email,
      subject: 'Email Verification',
      html: `<a href="${this.config.get('APP_URL')}/verify-email?token=${token}">Verify Email</a>`,
    });
  }

  async sendPasswordResetEmail(email: string, token: string) {
    await this.transporter.sendMail({
      from: this.config.get('EMAIL_FROM'),
      to: email,
      subject: 'Password Reset',
      html: `<a href="${this.config.get('APP_URL')}/reset-password?token=${token}">Reset Password</a>`,
    });
  }
}
