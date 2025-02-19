// src/modules/booking/dto/create-booking.input.ts
import { Types } from 'mongoose';
import {
  SeatClass,
  BookingStatus,
  PaymentProvider,
} from '../types/booking.types';

export interface SeatSelectionInput {
  seatNumber: string;
  class: SeatClass;
  price: number;
}

export interface CreateBookingInput {
  user: Types.ObjectId;
  flight: Types.ObjectId;
  seats: SeatSelectionInput[];
  totalSeats: number;
  totalPrice: number;
  status: BookingStatus;
  paymentProvider: PaymentProvider;
  paymentIntentId?: string;
  cancellationReason?: string;
  expiresAt?: Date;
  idempotencyKey?: string;
}
