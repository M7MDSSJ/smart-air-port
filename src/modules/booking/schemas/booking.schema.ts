import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  BookingStatus,
  SeatClass,
  PaymentProvider,
} from '../types/booking.types';

@Schema({ timestamps: true, versionKey: false })
export class Booking {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Flight', required: true, index: true })
  flight: Types.ObjectId;

  @Prop({
    type: [
      {
        seatNumber: String,
        class: {
          type: String,
          enum: ['economy', 'premium_economy', 'business', 'first'],
        },
        price: Number,
      },
    ],
    required: true,
  })
  seats: Array<{
    seatNumber: string;
    class: SeatClass; // Ensure SeatClass is defined correctly
    price: number;
  }>;

  @Prop({ required: true, min: 1 })
  totalSeats: number;

  @Prop({ required: true })
  totalPrice: number;

  @Prop({
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'expired'],
    default: 'pending',
  })
  status: BookingStatus; // Ensure BookingStatus is defined correctly

  @Prop({ type: String, enum: ['stripe', 'paypal', 'mobile_wallet'] })
  paymentProvider: PaymentProvider; // Ensure PaymentProvider is defined correctly

  @Prop({ required: true, unique: true, index: true })
  idempotencyKey: string;
  @Prop()
  paymentIntentId?: string;

  @Prop()
  cancellationReason?: string;

  @Prop()
  expiresAt?: Date;
}

export type BookingDocument = Booking & Document;
export const BookingSchema = SchemaFactory.createForClass(Booking);
