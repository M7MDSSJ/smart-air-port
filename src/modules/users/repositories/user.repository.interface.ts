import { User, UserDocument } from '../schemas/user.schema';

export interface IUserRepository {
  findByEmail(email: string): Promise<UserDocument | null>;
  findById(userId: string): Promise<UserDocument | null>;
  create(user: Partial<User>): Promise<UserDocument>;
  findByToken(token: string): Promise<UserDocument | null>;
  updateRefreshToken(
    userId: string,
    refreshToken: string | null,
  ): Promise<void>;
  findByIdAndUpdate(userId: string): Promise<{ message: string }>;
  update(
    userId: string,
    updateData: Partial<User>,
  ): Promise<UserDocument | null>;
  updateRoles(userId: string, roles: string[]): Promise<UserDocument | null>;
  delete(email: string): Promise<void>;
  countByRole(role: string): Promise<number>;
}
