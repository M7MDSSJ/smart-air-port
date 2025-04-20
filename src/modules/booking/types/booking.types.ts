export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'expired'
  | 'failed';
export type PaymentProvider = 'stripe' | 'paypal' | 'mobile_wallet';

export type SeatClass = 'economy' | 'premium_economy' | 'business' | 'first';
export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status:
    | 'requires_payment_method'
    | 'requires_confirmation'
    | 'requires_action'
    | 'processing'
    | 'requires_capture'
    | 'canceled'
    | 'succeeded';
}

export interface CreateBookingInput {
  // ... existing fields ...
  baggageFees: number;
  baggageBreakdown: Array<{
    type: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
}
