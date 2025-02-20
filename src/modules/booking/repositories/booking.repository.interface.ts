import { BookingDocument } from '../schemas/booking.schema';
import { FilterQuery, UpdateQuery } from 'mongoose';
import { CreateBookingInput } from '../dto/create-booking.input';
export const BOOKING_REPOSITORY = 'BOOKING_REPOSITORY';

export interface IBookingRepository {
  create(bookingData: CreateBookingInput): Promise<BookingDocument>;
  findById(id: string): Promise<BookingDocument | null>;
  findByUser(userId: string): Promise<BookingDocument[]>;
  findOne(
    filter: FilterQuery<BookingDocument>,
  ): Promise<BookingDocument | null>;
  find(query: any): Promise<BookingDocument[]>;

  update(
    filter: FilterQuery<BookingDocument>,
    update: UpdateQuery<BookingDocument>,
  ): Promise<BookingDocument>;
  delete(id: string): Promise<boolean>;
}
