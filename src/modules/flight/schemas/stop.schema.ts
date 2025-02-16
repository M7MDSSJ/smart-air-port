import { Schema } from 'mongoose';

export const StopSchema = new Schema(
  {
    airport: { type: String, required: true },
    arrivalTime: { type: Date, required: true },
    departureTime: { type: Date, required: true },
  },
  { _id: false }, // Avoids separate _id for each stop
);
