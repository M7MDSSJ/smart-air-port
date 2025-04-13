// flight.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface Stop {
  airport: string;
  arrivalTime: Date;
  departureTime: Date;
  flightNumber?: string; // Optional for multi-segment flights
  carrierCode?: string;
}

@Schema({ _id: false })
export class StopSchema {
  @Prop({ required: true })
  airport: string;

  @Prop({ required: true })
  arrivalTime: Date;

  @Prop({ required: true })
  departureTime: Date;

  @Prop()
  flightNumber?: string;

  @Prop()
  carrierCode?: string;
}

export const StopSchemaDef = SchemaFactory.createForClass(StopSchema);

@Schema({ timestamps: true })
export class Flight extends Document {
  @Prop({ required: true, unique: true }) // Unique Amadeus offer ID
  offerId: string;

  @Prop({ required: true }) // First segment’s flight number
  flightNumber: string;

  @Prop({ required: true }) // e.g., "F9" from carrierCode
  airline: string;

  @Prop({ required: true, index: true }) // e.g., "JFK"
  departureAirport: string;

  @Prop({ required: true, index: true }) // e.g., "LAX" or last segment’s arrival
  arrivalAirport: string;

  @Prop({ required: true, index: true }) // First segment’s departure
  departureTime: Date;

  @Prop({ required: true }) // Last segment’s arrival
  arrivalTime: Date;

  @Prop({
    type: String,
    enum: ['Scheduled', 'Delayed', 'Cancelled', 'Departed', 'Arrived'],
    default: 'Scheduled',
  })
  status: 'Scheduled' | 'Delayed' | 'Cancelled' | 'Departed' | 'Arrived';

  @Prop() // e.g., "32Q"
  aircraft?: string;

  @Prop({ required: true }) // e.g., 209.98
  price: number;

  @Prop() // Not provided by Amadeus, could estimate or fetch separately
  seats?: number;

  @Prop({ required: true, min: 0 }) // e.g., 4
  seatsAvailable: number;

  @Prop({ type: [StopSchemaDef], default: [] }) // Intermediate stops
  stops: Stop[];

  @Prop() // e.g., "2025-03-17"
  lastTicketingDate?: string;

  @Prop({ type: Object })
  baggageOptions: {
    included: string;
    options: Array<{ weightInKg: number; price: number }>;
  };

  @Prop({ expires: 3600 }) // Auto-delete after 1 hour
  createdAt: Date;

  @Prop()
  updatedAt: Date;

  @Prop({ versionKey: 'version' })
  version: number;
}

export const FlightSchema = SchemaFactory.createForClass(Flight);