// src/modules/booking/schemas/booking.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  BookingStatus,
  SeatClass,
  PaymentProvider,
} from '../types/booking.types';

@Schema({ timestamps: true, versionKey: false })
export class BookingEvent {
  @Prop({ required: true })
  type: string;

  @Prop({ required: true, type: Object })
  payload: Record<string, any>;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const BookingEventSchema = SchemaFactory.createForClass(BookingEvent);

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
    class: SeatClass;
    price: number;
  }>;

  @Prop({ required: true, min: 1 })
  totalSeats: number;

  @Prop({ required: true })
  totalPrice: number;

  @Prop({
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'expired', 'failed'],
    default: 'pending',
  })
  status: BookingStatus;

  @Prop({ type: String, enum: ['stripe', 'paypal', 'mobile_wallet'] })
  paymentProvider: PaymentProvider;

  // Add TTL: the document will be removed 24 hours (60*60*24 seconds) after idempotencyKey is set.
  @Prop({ required: true, unique: true, index: true, expires: 60 * 60 * 24 })
  idempotencyKey: string;

  @Prop()
  paymentIntentId?: string;

  @Prop()
  cancellationReason?: string;

  @Prop()
  expiresAt?: Date;

  // Implement Event Sourcing: store booking events
  @Prop({ type: [BookingEventSchema], default: [] })
  events: BookingEvent[];
}

export type BookingDocument = Booking & Document;
export const BookingSchema = SchemaFactory.createForClass(Booking);

BookingSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

BookingSchema.set('toJSON', { virtuals: true });
