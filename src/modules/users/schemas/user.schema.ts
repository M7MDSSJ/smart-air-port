import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class User {
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ type: [String], default: ['user'] })
  roles: string[];

  @Prop()
  phoneNumber?: string;

  @Prop({ default: false })
  isVerified?: boolean;

  @Prop()
  verificationToken?: string;

  @Prop()
  resetToken?: string;

  @Prop()
  resetTokenExpiry?: Date;

  @Prop()
  refreshToken?: string;

  @Prop()
  createdAt?: Date;
}

export type UserDocument = User &
  Document & {
    _id: Types.ObjectId;
  };

export const UserSchema = SchemaFactory.createForClass(User);
