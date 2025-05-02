import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type BookingDocument = Booking & Document;

@Schema({
  timestamps: true,
})
export class Booking {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'User' })
  userId: string;

  @Prop({ required: true, type: String }) // Changed to String type for Amadeus flight IDs
  flightId: string;

  @Prop({ required: true })
  originAirportCode: string;

  @Prop({ required: true })
  destinationAirportCode: string;

  @Prop({ required: true })
  originCity: string;

  @Prop({ required: true })
  destinationCity: string;

  @Prop({ required: true, type: Date })
  departureDate: Date;

  @Prop({ required: true, type: Date })
  arrivalDate: Date;

  @Prop({ type: Object })
  selectedBaggageOption: Record<string, any>;

  @Prop({ required: true, type: Number })
  totalPrice: number;

  @Prop({ required: true, type: Number })
  applicationFee: number;

  @Prop({ required: true })
  currency: string;

  @Prop({ type: Array, required: true })
  travellersInfo: any[];

  @Prop({ required: true, unique: true })
  idempotencyKey: string;

  @Prop({ required: true, unique: true })
  bookingRef: string;

  @Prop({ default: 'pending', enum: ['pending', 'confirmed', 'cancelled'] })
  status: string;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
