import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { IUserRepository } from './user.repository.interface';
@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectModel('User') private readonly userModel: Model<UserDocument>,
  ) {}

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email });
  }

  async findById(userId: string): Promise<UserDocument | null> {
    return this.userModel.findById(userId);
  }

  async create(user: Partial<User>): Promise<UserDocument> {
    const newUser = new this.userModel(user);
    return newUser.save();
  }

  async findByToken(token: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ verificationToken: token });
  }
  async updateRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { refreshToken });
  }

  async update(
    userId: string,
    updateData: Partial<User>,
  ): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(userId, updateData, { new: true });
  }

  async findByIdAndUpdate(userId: string): Promise<{ message: string }> {
    await this.userModel.findByIdAndUpdate(userId, { refreshToken: null });
    return { message: 'Logged out successfully' };
  }
  async updateRoles(
    userId: string,
    roles: string[],
  ): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(userId, { roles }, { new: true });
  }

  async delete(email: string): Promise<void> {
    await this.userModel.findOneAndDelete({ email });
  }

  async countByRole(role: string): Promise<number> {
    return this.userModel.countDocuments({ roles: role });
  }
}
