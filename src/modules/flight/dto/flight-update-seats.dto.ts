export interface FlightUpdateSeatsParams {
  flightId: string;
  seatDelta: number;
  expectedVersion: number;
}
