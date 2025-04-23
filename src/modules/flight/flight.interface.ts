export interface Flight {
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string;  // Or Date, based on usage
  arrivalTime: string;
  numberOfBookableSeats?: number;
  airline: string;
  flightNumber: string;
  _id: any;  // Adjust as needed, e.g., string or ObjectId
  offerId: string;
  itineraries?: any[];  // Array for flight segments
  baggageOptions?: any;  // Object for baggage details
  fareTypes?: any[];  // Array for fare types
  // Add other properties as per your requirements
}
