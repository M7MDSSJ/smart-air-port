import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
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
          pass: this.config.get<string>('MAIL_PASSWORD'),
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
      this.logger.error('Verification token missing for email: ' + email);
      throw new BadRequestException('Verification token is required');
    }

    const baseUrl =
      this.config.get('FRONTEND_URL') || this.config.get('APP_URL');
    const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
    const html = this.generateEmailTemplate({
      title: 'Email Verification',
      message: 'Click the button below to verify your email address:',
      buttonText: 'Verify Email',
      buttonUrl: verificationUrl,
      footer:
        'If you didn’t request this verification, please ignore this email.',
    });

    await this.sendEmail({
      to: email,
      subject: 'Email Verification',
      html,
      from: `"Airport Team" <${this.config.get('MAIL_FROM')}>`,
    });
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    if (!token) {
      this.logger.error('Password reset token missing for email: ' + email);
      throw new BadRequestException('Reset token is required');
    }

    const baseUrl =
      this.config.get('FRONTEND_URL') || this.config.get('APP_URL');
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    const html = this.generateEmailTemplate({
      title: 'Password Reset Request',
      message: 'Click the button below to reset your password:',
      buttonText: 'Reset Password',
      buttonUrl: resetUrl,
      footer:
        'This link will expire in 1 hour. If you didn’t request this, please ignore this email.',
    });

    await this.sendEmail({
      to: email,
      subject: 'Password Reset Request',
      html,
      from: `"Airport Team" <${this.config.get('MAIL_FROM')}>`,
    });
  }

  async sendImportantEmail(
    email: string,
    subject: string,
    html: string,
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject,
      html,
      from: `"Important Notification" <${this.config.get('MAIL_FROM')}>`,
    });
  }

  private async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    from: string;
  }): Promise<void> {
    try {
      await this.transporter.sendMail(options);
      this.logger.log(
        `Email sent successfully to ${options.to} with subject: ${options.subject}`,
      );
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack =
        error instanceof Error ? error.stack : 'No stack trace available';
      this.logger.error(
        `Failed to send email to ${options.to}: ${errorMessage}`,
        errorStack,
      );
      throw new BadRequestException('Failed to send email');
    }
  }

  private generateEmailTemplate(options: {
    title: string;
    message: string;
    buttonText: string;
    buttonUrl: string;
    footer: string;
  }): string {
    return `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>${options.title}</h2>
        <p>${options.message}</p>
        <a href="${options.buttonUrl}"
           style="background-color: ${options.title.includes('Verification') ? '#2196F3' : '#4CAF50'};
                  color: white; padding: 14px 25px; text-align: center; text-decoration: none;
                  display: inline-block; border-radius: 4px;">
           ${options.buttonText}
        </a>
        <p style="margin-top: 20px; color: #666;">${options.footer}</p>
      </div>
    `;
  }
}

export class EmailServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailServiceError';
  }
}
