// src/users/schemas/user.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({ type: [String], default: ['user'] })
  roles: string[];

  @Prop({unique:true})
  phoneNumber?: string;

  @Prop()
  country?: string;

  @Prop({ type: Date }) // Ensure this is present
  birthdate?: Date;

  @Prop({ default: false })
  isVerified?: boolean;

  @Prop()
  verificationToken?: string;

  @Prop({ type: Date })
  verificationTokenExpiry?: Date;

  @Prop()
  resetToken?: string;

  @Prop({ type: Date })
  resetTokenExpiry?: Date;

  @Prop()
  resetCode?: string;

  @Prop({ type: Date })
  resetCodeExpiry?: Date;

  @Prop()
  refreshToken?: string;

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export type UserDocument = User & Document & { _id: Types.ObjectId };
export const UserSchema = SchemaFactory.createForClass(User);