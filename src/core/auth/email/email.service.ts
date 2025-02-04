import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    await this.initializeTransporter();
  }

  private async initializeTransporter(): Promise<void> {
    try {
      this.transporter = nodemailer.createTransport({
        host: this.config.get<string>('MAIL_HOST'),
        port: 587,
        secure: false,
        auth: {
          user: this.config.get<string>('MAIL_USER'),
          pass: this.config.get<string>('MAIL_PASS'),
        },
        tls: {
          rejectUnauthorized: false,
        },
        connectionTimeout: 10000,
        socketTimeout: 10000,
        logger: true,
        debug: true,
      });

      await this.verifyTransporter();
    } catch (error) {
      this.logger.error(
        'Failed to initialize email transporter',
        (error as Error).stack,
      );
      throw new Error('Email service configuration error');
    }
  }

  private async verifyTransporter(): Promise<void> {
    try {
      const success = await this.transporter.verify();
      if (success) {
        this.logger.log('Email transporter verified successfully');
      }
    } catch (error) {
      this.logger.error(
        'Failed to verify email transporter',
        (error as Error).stack,
      );
      throw new Error('Email service connection failed');
    }
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    if (!token) {
      this.logger.error('Verification token missing');
      throw new Error('Verification token is required');
    }

    const verificationUrl = `${this.config.get('APP_URL')}/verify-email?token=${token}`;
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Email Verification</h2>
        <p>Click the button below to verify your email address:</p>
        <a href="${verificationUrl}" 
           style="background-color: #2196F3; color: white; padding: 14px 25px; 
                  text-align: center; text-decoration: none; display: inline-block;
                  border-radius: 4px;">
           Verify Email
        </a>
        <p style="margin-top: 20px; color: #666;">
          If you didn't request this verification, please ignore this email.
        </p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: `"Airport Team" <${this.config.get('MAIL_FROM')}>`,
        to: email,
        subject: 'Email Verification',
        html: html,
      });
      this.logger.log(`Verification email sent to ${email}`);
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack =
        error instanceof Error ? error.stack : 'No stack trace available';

      this.logger.error(
        `Failed to send verification email to ${email}: ${errorMessage}`,
        errorStack,
      );
      throw new Error('Failed to send verification email');
    }
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    if (!token) {
      this.logger.error('Password reset token missing');
      throw new Error('Reset token is required');
    }

    const resetUrl = `${this.config.get('APP_URL')}/reset-password?token=${token}`;
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Password Reset Request</h2>
        <p>Click the button below to reset your password:</p>
        <a href="${resetUrl}" 
           style="background-color: #4CAF50; color: white; padding: 14px 25px; 
                  text-align: center; text-decoration: none; display: inline-block;
                  border-radius: 4px;">
           Reset Password
        </a>
        <p style="margin-top: 20px; color: #666;">
          This link will expire in 1 hour. If you didn't request this, 
          please ignore this email.
        </p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: `"Airport Team" <${this.config.get('MAIL_FROM')}>`,
        to: email,
        subject: 'Password Reset Request',
        html: html,
      });
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack =
        error instanceof Error ? error.stack : 'No stack trace available';

      this.logger.error(
        `Failed to send password reset email to ${email}: ${errorMessage}`,
        errorStack,
      );
      throw new Error('Failed to send password reset email');
    }
  }
}
