// src/modules/booking/repositories/booking.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, UpdateQuery } from 'mongoose';
import { BookingDocument } from '../schemas/booking.schema';
import { CreateBookingInput } from '../dto/create-booking.input';
import { IBookingRepository } from './booking.repository.interface';

@Injectable()
export class BookingRepository implements IBookingRepository {
  constructor(
    @InjectModel('Booking')
    private readonly bookingModel: Model<BookingDocument>,
  ) {}

  async create(bookingData: CreateBookingInput): Promise<BookingDocument> {
    const newBooking = new this.bookingModel(bookingData);
    return newBooking.save();
  }

  async findById(id: string): Promise<BookingDocument | null> {
    return this.bookingModel.findById(id).exec();
  }

  async findByUser(userId: string): Promise<BookingDocument[]> {
    return this.bookingModel.find({ user: userId }).exec();
  }

  async findOne(
    filter: FilterQuery<BookingDocument>,
  ): Promise<BookingDocument | null> {
    return this.bookingModel.findOne(filter).exec();
  }

  async update(
    filter: FilterQuery<BookingDocument>,
    update: UpdateQuery<BookingDocument>,
  ): Promise<BookingDocument> {
    const updated = await this.bookingModel
      .findOneAndUpdate(filter, update, { new: true })
      .exec();
    if (!updated) {
      throw new Error('Booking update failed');
    }
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const res = await this.bookingModel.findByIdAndDelete(id).exec();
    return !!res;
  }
}
