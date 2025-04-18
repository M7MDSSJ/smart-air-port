import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema()
export class Stop {
  @Prop({ required: true })
  airport: string;

  @Prop({ required: true })
  arrivalTime: Date;

  @Prop({ required: true })
  departureTime: Date;

  @Prop({ required: true })
  flightNumber: string;

  @Prop({ required: true })
  carrierCode: string;
}

@Schema()
export class BaggageOptions {
  @Prop({ required: true })
  included: string;

  @Prop({ type: [{ weightInKg: Number, price: Number }], required: true })
  options: Array<{ weightInKg: number; price: number }>;
}

@Schema({ timestamps: true, versionKey: 'version' })
export class Flight extends Document {
  @Prop({ required: true })
  offerId: string;

  @Prop({ required: true })
  flightNumber: string;

  @Prop({ required: true })
  airline: string;

  @Prop({ required: true })
  departureAirport: string;

  @Prop({ required: true })
  arrivalAirport: string;

  @Prop({ required: true })
  departureTime: Date;

  @Prop({ required: true })
  arrivalTime: Date;

  @Prop({ required: true })
  status: string;

  @Prop()
  aircraft?: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  seatsAvailable: number;

  @Prop({ type: [Stop], default: [] })
  stops: Stop[];

  @Prop({ required: true })
  lastTicketingDate: string;

  @Prop({ type: BaggageOptions, required: true })
  baggageOptions: BaggageOptions;

  @Prop({ default: 'USD' })
  currency: string;

  @Prop({ default: 0 })
  version: number; // For optimistic concurrency
}

@Schema({ timestamps: true })
export class SeatHold extends Document {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Flight' })
  flightId: Types.ObjectId;

  @Prop({ required: true })
  seats: number;

  @Prop({ required: true })
  sessionId: string;

  @Prop({ required: true })
  expiresAt: Date;
}

export const FlightSchema = SchemaFactory.createForClass(Flight);
export const SeatHoldSchema = SchemaFactory.createForClass(SeatHold);

// Add performance optimizing indexes
FlightSchema.index({ offerId: 1 }, { unique: true });
FlightSchema.index({ seatsAvailable: 1 });
FlightSchema.index({ price: 1 });
FlightSchema.index({ departureTime: 1 });
FlightSchema.index({ arrivalTime: 1 });
FlightSchema.index({ airline: 1 });
FlightSchema.index({ version: 1 });
FlightSchema.index({ departureAirport: 1, arrivalAirport: 1, departureTime: 1, price: 1 });

// Add indexes for seat hold operations
SeatHoldSchema.index({ expiresAt: 1 });
SeatHoldSchema.index({ sessionId: 1 });
SeatHoldSchema.index({ flightId: 1 });