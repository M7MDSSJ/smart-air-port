import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  BookingStatus,
  SeatClass,
  PaymentProvider,
} from '../types/booking.types';

@Schema({ timestamps: true })
export class BookingEvent {
  @Prop({ required: true })
  type: string;

  @Prop({ required: true, type: Object })
  payload: Record<string, any>;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const BookingEventSchema = SchemaFactory.createForClass(BookingEvent);

@Schema({ timestamps: true })
export class Booking {
  /**
   * Unique, user-friendly reference code for this booking
   * Example: 'SMAIR-20250418-XYZ123'
   */
  @Prop({ required: true, unique: true, index: true })
  bookingRef: string; // For support and user lookup

  @Prop({ default: 0, type: Number })
  version: number;
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

  @Prop({ required: true, unique: true, index: true, expires: 60 * 60 * 24 })
  idempotencyKey: string;

  @Prop()
  paymentIntentId?: string;

  @Prop()
  cancellationReason?: string;

  @Prop()
  expiresAt?: Date;

  @Prop({ type: [BookingEventSchema], default: [] })
  events: BookingEvent[];

  // TODO: Expand audit/event logging for all status changes (who/when/what)

}

export type BookingDocument = Booking & Document;
export const BookingSchema = SchemaFactory.createForClass(Booking);

// Auto-generate bookingRef if not set
BookingSchema.pre('validate', function (next) {
  if (!this.bookingRef) {
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    this.bookingRef = `SMAIR-${date}-${random}`;
  }
  next();
});

// Set up the virtual 'id' field
BookingSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Customize toJSON to convert all ObjectId fields to strings
BookingSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    // Convert top-level ObjectId fields
    ret.id = ret._id.toHexString();
    ret.user = ret.user.toHexString();    // Convert user ObjectId
    ret.flight = ret.flight.toHexString(); // Convert flight ObjectId

    // Convert ObjectId in the seats array
    ret.seats = ret.seats.map(seat => ({
      ...seat,
      _id: seat._id.toHexString(), // Convert seat _id to string
    }));

    // Optionally remove the original _id field
    delete ret._id;

    return ret;
  },
});