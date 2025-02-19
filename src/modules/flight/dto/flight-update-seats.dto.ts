// src/modules/flight/dto/flight-update-seats.dto.ts
export interface FlightUpdateSeatsParams {
  flightId: string;
  seatDelta: number;
  expectedVersion: number;
}
