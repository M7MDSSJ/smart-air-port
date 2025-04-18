import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, UpdateQuery, PipelineStage, ProjectionType, Types, Query, Document } from 'mongoose';
import { Booking, BookingDocument } from '../schemas/booking.schema';
import { CreateBookingInput } from '../dto/create-booking.input';
import { IBookingRepository } from './booking.repository.interface';
import { PaginatedResult } from '../../../common/interfaces/paginated-result.interface';
import { QueryBookingDto } from '../dto/query-booking.dto';

@Injectable()
export class BookingRepository implements IBookingRepository {
  private readonly logger = new Logger(BookingRepository.name);
  
  constructor(
    @InjectModel('Booking')
    private readonly bookingModel: Model<BookingDocument>,
  ) {}

  async create(bookingData: CreateBookingInput): Promise<BookingDocument> {
    const startTime = Date.now();
    try {
      const newBooking = new this.bookingModel(bookingData);
      const savedBooking = await newBooking.save();
      this.logger.debug(`Created booking with ID: ${savedBooking._id}`); 
      return savedBooking;
    } catch (error) {
      this.logger.error(`Error creating booking: ${error.message}`);
      throw error;
    } finally {
      this.logger.debug(`Creation operation took: ${Date.now() - startTime}ms`);
    }
  }

  async findById(id: string, projection?: ProjectionType<BookingDocument>): Promise<BookingDocument | null> {
    const startTime = Date.now();
    try {
      if (!Types.ObjectId.isValid(id)) {
        this.logger.warn(`Invalid ObjectId format: ${id}`);
        return null;
      }
      
      const booking = await this.bookingModel
        .findById(id)
        .select(projection || {})
        .lean<BookingDocument>()
        .exec();
      
      return booking;
    } catch (error) {
      this.logger.error(`Error finding booking by ID ${id}: ${error.message}`);
      throw error;
    } finally {
      this.logger.debug(`FindById operation took: ${Date.now() - startTime}ms`);
    }
  }

  async findByUser(userId: string, projection?: ProjectionType<BookingDocument>): Promise<BookingDocument[]> {
    const startTime = Date.now();
    try {
      if (!Types.ObjectId.isValid(userId)) {
        this.logger.warn(`Invalid user ObjectId format: ${userId}`);
        return [];
      }
      
      return this.bookingModel
        .find({ user: userId })
        .select(projection || {})
        .lean<BookingDocument[]>()
        .exec();
    } catch (error) {
      this.logger.error(`Error finding bookings for user ${userId}: ${error.message}`);
      throw error;
    } finally {
      this.logger.debug(`FindByUser operation took: ${Date.now() - startTime}ms`);
    }
  }

  async findOne(
    filter: FilterQuery<BookingDocument>,
    projection?: ProjectionType<BookingDocument>
  ): Promise<BookingDocument | null> {
    const startTime = Date.now();
    try {
      return this.bookingModel
        .findOne(filter)
        .select(projection || {})
        .lean<BookingDocument>()
        .exec();
    } catch (error) {
      this.logger.error(`Error finding booking with filter ${JSON.stringify(filter)}: ${error.message}`);
      throw error;
    } finally {
      this.logger.debug(`FindOne operation took: ${Date.now() - startTime}ms`);
    }
  }

  async find(
    query: FilterQuery<BookingDocument>,
    projection?: ProjectionType<BookingDocument>,
    options?: { limit?: number; skip?: number; sort?: Record<string, 1 | -1> }
  ): Promise<BookingDocument[]> {
    const startTime = Date.now();
    try {
      let findQuery = this.bookingModel.find(query) as Query<
        (Document<unknown, {}, BookingDocument> & Booking & Document<unknown, any, any> & Required<{ _id: unknown; }> & { __v: number; })[],
        Document<unknown, {}, BookingDocument> & Booking & Document<unknown, any, any> & Required<{ _id: unknown; }> & { __v: number; },
        {},
        BookingDocument,
        "find"
      >;
      
      // Apply projection if provided
      if (projection) {
        findQuery = findQuery.select(projection);
      }
      
      // Apply options if provided
      if (options) {
        if (options.limit) findQuery = findQuery.limit(options.limit);
        if (options.skip) findQuery = findQuery.skip(options.skip);
        if (options.sort) findQuery = findQuery.sort(options.sort);
      }
      
      const results = await findQuery.lean().exec();
      return results as unknown as BookingDocument[];
    } catch (error) {
      this.logger.error(`Error finding bookings: ${error.message}`);
      throw error;
    } finally {
      this.logger.debug(`Find operation took: ${Date.now() - startTime}ms`);
    }
  }

  async update(
    filter: FilterQuery<BookingDocument>,
    update: UpdateQuery<BookingDocument>,
  ): Promise<BookingDocument> {
    const startTime = Date.now();
    try {
      // Add a version increment for optimistic concurrency control
      if (!update.$inc) {
        update.$inc = { version: 1 };
      } else if (!update.$inc.version) {
        update.$inc.version = 1;
      }
      
      const updated = await this.bookingModel
        .findOneAndUpdate(filter, update, { new: true })
        .lean<BookingDocument>()
        .exec();
        
      if (!updated) {
        throw new Error(`Booking update failed for filter: ${JSON.stringify(filter)}`);
      }
      
      return updated;
    } catch (error) {
      this.logger.error(`Error updating booking: ${error.message}`);
      throw error;
    } finally {
      this.logger.debug(`Update operation took: ${Date.now() - startTime}ms`);
    }
  }

  async delete(id: string): Promise<boolean> {
    const startTime = Date.now();
    try {
      if (!Types.ObjectId.isValid(id)) {
        this.logger.warn(`Invalid ObjectId format for deletion: ${id}`);
        return false;
      }
      
      const res = await this.bookingModel.findByIdAndDelete(id).exec();
      if (res) {
        this.logger.log(`Successfully deleted booking: ${id}`);
      } else {
        this.logger.warn(`Booking not found for deletion: ${id}`);
      }
      
      return !!res;
    } catch (error) {
      this.logger.error(`Error deleting booking ${id}: ${error.message}`);
      throw error;
    } finally {
      this.logger.debug(`Delete operation took: ${Date.now() - startTime}ms`);
    }
  }
  
  /**
   * Find bookings with pagination and filtering capabilities
   */
  async findWithPagination(queryDto: QueryBookingDto): Promise<PaginatedResult<BookingDocument>> {
    const startTime = Date.now();
    try {
      const { page = 1, limit = 10, status, userId, fromDate, toDate, sortBy = 'createdAt', sortOrder = -1 } = queryDto;
      const skip = (page - 1) * limit;
      
      // Build filter
      const filter: FilterQuery<BookingDocument> = {};
      
      if (status) {
        filter.status = status;
      }
      
      if (userId && Types.ObjectId.isValid(userId)) {
        filter.user = userId;
      }
      
      if (fromDate || toDate) {
        filter.createdAt = {};
        if (fromDate) filter.createdAt.$gte = new Date(fromDate);
        if (toDate) filter.createdAt.$lte = new Date(toDate);
      }
      
      // Execute count query for total
      const countPromise = this.bookingModel.countDocuments(filter).exec();
      
      // Execute data query
      const dataPromise = this.bookingModel
        .find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean<BookingDocument[]>()
        .exec();
      
      // Run in parallel
      const [total, data] = await Promise.all([countPromise, dataPromise]);
      
      return {
        data: data as BookingDocument[],
        meta: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Error finding bookings with pagination: ${error.message}`);
      throw error;
    } finally {
      this.logger.debug(`FindWithPagination operation took: ${Date.now() - startTime}ms`);
    }
  }
  
  /**
   * Creates multiple bookings in a single operation
   */
  async bulkCreate(bookings: CreateBookingInput[]): Promise<BookingDocument[]> {
    const startTime = Date.now();
    if (!bookings.length) return [];
    
    try {
      // Ensure all inputs have required fields to satisfy TypeScript
      const validBookings = bookings.filter(booking => {
        if (!booking.user || !booking.flight || !booking.seats || !booking.totalSeats || 
            !booking.totalPrice || !booking.idempotencyKey) {
          this.logger.warn('Invalid booking input skipped in bulk create');
          return false;
        }
        return true;
      });
      
      if (!validBookings.length) {
        this.logger.warn('No valid bookings to bulk create');
        return [];
      }
      
      const result = await this.bookingModel.insertMany(validBookings);
      this.logger.debug(`Created ${result.length} bookings in bulk operation`);
      return result as unknown as BookingDocument[];
    } catch (error) {
      this.logger.error(`Error bulk creating bookings: ${error.message}`);
      throw error;
    } finally {
      this.logger.debug(`Bulk create operation took: ${Date.now() - startTime}ms`);
    }
  }
}
