import { User, UserDocument } from '../schemas/user.schema';
import { UpdateQuery } from 'mongoose';

export interface IUserRepository {
  findAll(): Promise<UserDocument[]>;
  findByEmail(email: string): Promise<UserDocument | null>;
  findByEmailWithPassword(email: string): Promise<UserDocument | null>;
  findById(userId: string): Promise<UserDocument | null>;
  create(user: Partial<User>): Promise<UserDocument>;
  findByToken(token: string): Promise<UserDocument | null>;
  updateRefreshToken(userId: string, refreshToken: string | null): Promise<void>;
  findByIdAndUpdate(userId: string): Promise<{ message: string }>;
  update(userId: string, updateData: UpdateQuery<UserDocument>): Promise<UserDocument | null>;
  updateRoles(userId: string, roles: string[]): Promise<UserDocument | null>;
  delete(email: string): Promise<void>;
  countByRole(role: string): Promise<number>;
}