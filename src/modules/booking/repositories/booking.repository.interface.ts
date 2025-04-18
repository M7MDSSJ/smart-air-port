import { BookingDocument } from '../schemas/booking.schema';
import { FilterQuery, UpdateQuery, ProjectionType } from 'mongoose';
import { CreateBookingInput } from '../dto/create-booking.input';
import { PaginatedResult } from '../../../common/interfaces/paginated-result.interface';
import { QueryBookingDto } from '../dto/query-booking.dto';

export const BOOKING_REPOSITORY = 'BOOKING_REPOSITORY';

export interface IBookingRepository {
  create(bookingData: CreateBookingInput): Promise<BookingDocument>;
  
  findById(id: string, projection?: ProjectionType<BookingDocument>): Promise<BookingDocument | null>;
  
  findByUser(userId: string, projection?: ProjectionType<BookingDocument>): Promise<BookingDocument[]>;
  
  findOne(
    filter: FilterQuery<BookingDocument>,
    projection?: ProjectionType<BookingDocument>
  ): Promise<BookingDocument | null>;
  
  find(
    query: FilterQuery<BookingDocument>,
    projection?: ProjectionType<BookingDocument>,
    options?: { limit?: number; skip?: number; sort?: Record<string, 1 | -1> }
  ): Promise<BookingDocument[]>;

  update(
    filter: FilterQuery<BookingDocument>,
    update: UpdateQuery<BookingDocument>,
  ): Promise<BookingDocument>;
  
  delete(id: string): Promise<boolean>;
  
  /**
   * Find bookings with pagination and filtering
   */
  findWithPagination(queryDto: QueryBookingDto): Promise<PaginatedResult<BookingDocument>>;
  
  /**
   * Create multiple bookings in a single operation
   */
  bulkCreate(bookings: CreateBookingInput[]): Promise<BookingDocument[]>;
}
