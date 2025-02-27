import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  UnauthorizedException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { IUserRepository } from '../repositories/user.repository.interface';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { EmailService } from 'src/modules/email/email.service';
import { ChangePasswordResponseDto } from '../dto/changePassword-response.dto';
import { RequestResetPasswordResponseDto } from '../dto/requestResetPassword-response.dto';
import { ResetPasswordResponseDto } from '../dto/resetPassword-response.dto';
interface JwtPayload {
  email: string;
}

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
  ) {}

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<ChangePasswordResponseDto> {
    const { oldPassword, newPassword } = changePasswordDto;
  
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found'); // Changed to 401
    }
  
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid old password');
    }
  
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    await user.save();
  
    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  async requestPasswordReset(email: string): Promise<RequestResetPasswordResponseDto> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new NotFoundException('Email not found'); // Matches 404
    }
    if (!user.isVerified) {
      throw new BadRequestException('User must verify before password reset');
    }
  
    const resetToken = this.jwtService.sign(
      { email: user.email },
      { secret: this.config.get('JWT_SECRET'), expiresIn: '1h' },
    );
    await this.userRepository.update(user._id.toString(), {
      resetToken,
      resetTokenExpiry: new Date(Date.now() + 3600000),
    });
  
    try {
      await this.emailService.sendPasswordResetEmail(user.email, resetToken);
    } catch (error) {
      console.error(`Failed to send reset email to ${user.email}:`, error);
      throw new BadRequestException('Failed to send password reset email');
    }
  
    return {
      success: true,
      message: 'Password reset email sent',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<ResetPasswordResponseDto> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(resetPasswordDto.token, {
        secret: this.config.get('JWT_SECRET'),
      });
    } catch {
      throw new BadRequestException('Invalid or expired reset token');
    }
  
    const user = await this.userRepository.findByEmail(payload.email);
  
    if (
      !user ||
      user.resetToken !== resetPasswordDto.token ||
      (user.resetTokenExpiry && user.resetTokenExpiry < new Date())
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }
  
    const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);
    await this.userRepository.update(user._id.toString(), {
      password: hashedPassword,
      resetToken: undefined,
      resetTokenExpiry: undefined,
    });
  
    return {
      success: true,
      message: 'Password reset successfully',
    };
  }
}
