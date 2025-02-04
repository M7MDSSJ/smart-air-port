import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { IUserRepository } from '../repositories/user.repository.interface';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { EmailService } from 'src/modules/email/email.service';
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

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { oldPassword, newPassword } = changePasswordDto;
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Old password is incorrect');
    }
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    await user.save();
    return { message: 'Password changed successfully' };
  }
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const resetToken = this.jwtService.sign(
      { email: user.email },
      { secret: this.config.get('JWT_SECRET'), expiresIn: '1h' },
    );
    await this.userRepository.update(user._id.toString(), {
      resetToken,
      resetTokenExpiry: new Date(Date.now() + 3600000),
    });

    await this.emailService.sendPasswordResetEmail(user.email, resetToken);
    return { message: 'If this user exists, an email will be sent' };
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(resetPasswordDto.token, {
        secret: this.config.get('JWT_SECRET'),
      });
    } catch {
      throw new BadRequestException('Invalid or expired token');
    }

    const user = await this.userRepository.findByEmail(payload.email);

    if (
      !user ||
      user.resetToken !== resetPasswordDto.token ||
      (user.resetTokenExpiry && user.resetTokenExpiry < new Date())
    ) {
      throw new BadRequestException('Invalid or expired token');
    }

    const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);
    await this.userRepository.update(user._id.toString(), {
      password: hashedPassword,
      resetToken: undefined,
      resetTokenExpiry: undefined,
    });

    return { message: 'Password reset successfully' };
  }
}
