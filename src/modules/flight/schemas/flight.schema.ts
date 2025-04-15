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

@Schema({ timestamps: true })
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

FlightSchema.index({ departureAirport: 1, arrivalAirport: 1, departureTime: 1 });