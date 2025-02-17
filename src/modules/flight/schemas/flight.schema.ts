import { Schema, Document } from 'mongoose';
import { StopSchema } from './stop.schema';

export interface Flight extends Document {
  flightNumber: string;
  airline: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: Date;
  arrivalTime: Date;
  status: 'Scheduled' | 'Delayed' | 'Cancelled' | 'Departed' | 'Arrived';
  aircraft?: string;
  price: number;
  seats: number;
  seatsAvailable: number;
  stops?: Array<{
    airport: string;
    arrivalTime: Date;
    departureTime: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export const FlightSchema = new Schema<Flight>(
  {
    flightNumber: { type: String, required: true, unique: true },
    airline: { type: String, required: true },
    departureAirport: { type: String, required: true },
    arrivalAirport: { type: String, required: true },
    departureTime: { type: Date, required: true },
    arrivalTime: { type: Date, required: true },
    status: {
      type: String,
      enum: ['Scheduled', 'Delayed', 'Cancelled', 'Departed', 'Arrived'],
      default: 'Scheduled',
    },
    aircraft: { type: String },
    price: { type: Number, required: true },
    seats: { type: Number, required: true },
    seatsAvailable: {
      type: Number,
      required: true,
      default: function () {
        return this.seats;
      },
    },
    stops: { type: [StopSchema], default: [] },
  },
  {
    timestamps: true,
  },
);

// Create indexes for better query performance
FlightSchema.index({ departureAirport: 1, departureTime: 1 });

export default FlightSchema;
