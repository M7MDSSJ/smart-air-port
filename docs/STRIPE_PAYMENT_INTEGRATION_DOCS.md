
## API Endpoints

### 1. Create Booking (Prerequisite)
**Endpoint**: `POST /booking/book-flight`
**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body**:
```json
{
  "flightID": "F9123",
  "originAirportCode": "CAI",
  "destinationAirportCode": "JED",
  "originCIty": "Cairo",
  "destinationCIty": "Jeddah",
  "departureDate": "2025-06-15T14:00:00Z",
  "arrivalDate": "2025-06-15T18:30:00Z",
  "selectedBaggageOption": [
    {
      "type": "standard",
      "weight": 20,
      "pieces": 100
    },
    {
      "type": "carry",
      "weight": 7,
      "pieces": 0
    }
  ],
  "totalPrice": 450.99,
  "applicationFee": 15.99,
  "currency": "USD",
  "travellersInfo": [
    {
      "gender": "M",
      "firstName": "ahmed",
      "middleName": "S",
      "lastName": "Sayed",
      "birthDate": "1990-01-15",
      "nationality": "EGY",
      "passportNumber": "A1234567",
      "issuingCountry": "EGY",
      "expiryDate": "2027-03-05",
      "contactEmail": "ahmedsayed@example.com",
      "contactPhone": "+1234567890"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "message": "Flight booked successfully",
  "data": {
    "success": true,
    "message": "Flight booked successfully",
    "bookingId": "BOOKING_ID_HERE",
    "bookingRef": "AB123456",
    "status": "pending"
  },
  "error": null,
  "meta": null
}
```

### 2. Create Payment Intent
**Endpoint**: `POST /payment/create-payment-intent`
**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body**:
```json
{
  "bookingId": "BOOKING_ID_FROM_STEP_1",
  "amount": 450.99,
  "currency": "USD"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Payment intent created successfully",
  "data": {
    "paymentIntentId": "pi_1234567890",
    "clientSecret": "pi_1234567890_secret_xyz",
    "status": "requires_payment_method",
    "amount": 450.99,
    "currency": "usd"
  },
  "error": null,
  "meta": null
}
```

### 3. Confirm Payment
**Endpoint**: `POST /payment/confirm-payment`
**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body**:
```json
{
  "paymentIntentId": "PAYMENT_INTENT_ID_FROM_STEP_2",
  "bookingId": "BOOKING_ID_FROM_STEP_1"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "message": "Payment confirmed successfully",
  "data": {
    "success": true,
    "paymentStatus": "completed",
    "bookingStatus": "confirmed",
    "booking": {
      "_id": "BOOKING_ID",
      "paymentStatus": "completed",
      "status": "confirmed",
      "paymentCompletedAt": "2025-01-27T10:30:00.000Z"
    }
  },
  "error": null,
  "meta": null
}
```

### 4. Get Payment Status
**Endpoint**: `GET /payment/status/{bookingId}`
**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response**:
```json
{
  "success": true,
  "message": "Payment status retrieved successfully",
  "data": {
    "bookingId": "BOOKING_ID",
    "paymentStatus": "completed",
    "bookingStatus": "confirmed",
    "paymentIntentId": "pi_1234567890",
    "stripeStatus": "succeeded",
    "paymentCompletedAt": "2025-01-27T10:30:00.000Z"
  },
  "error": null,
  "meta": null
}
```
**5. WEBHOOK**
```json
POST /payments/webhook
Headers{
Stripe-Signature: <stripe-signature-header>
Content-Type: application/json
}
Body{
{
  "id": "evt_1ABC...",
  "object": "event",
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_1DEF...",
      "object": "payment_intent",
      "status": "succeeded",
      "amount": 12000,
      "currency": "usd",
      "metadata": {
        "bookingId": "6642ff2e46ba34124a9f26b1",
        "bookingRef": "FBX123456"
      }
    }
  }
}
}
Response {
  "received": true
}
Error Response{
  "statusCode": 404,
  "message": "Booking not found"
}


```
**6. payment-status%**
```json
GET /payments/status/:bookingId

 Response Example{
  "bookingId": "6642ff2e46ba34124a9f26b1",
  "paymentStatus": "completed",
  "bookingStatus": "confirmed",
  "paymentIntentId": "pi_1DEF...",
  "stripeStatus": "succeeded",
  "paymentCompletedAt": "2025-06-04T14:23:00.123Z"
}
Error Response
{
  "statusCode": 404,
  "message": "Booking not found"
}

```
## Testing Flow

### Step 1: Login and Get JWT Token
1. Use your existing login endpoint to get a JWT token
2. Save this token for use in subsequent requests

### Step 2: Create a Booking
1. Use the booking endpoint to create a new booking
2. Note the `bookingId` from the response
3. Verify the booking status is "pending" and paymentStatus is "pending"

### Step 3: Create Payment Intent
1. Use the `bookingId` from Step 2
2. Ensure the `amount` matches the `totalPrice` from the booking
3. Note the `paymentIntentId` and `clientSecret` from the response

### Step 4: Simulate Payment Completion
Since this is a test environment, you can use Stripe's test payment methods:
- **Success**: Use payment method `pm_card_visa`
- **Decline**: Use payment method `pm_card_visa_debit`

### Step 5: Confirm Payment
1. Use the `paymentIntentId` from Step 3
2. Use the same `bookingId` from Step 2
3. Check if the response shows success

### Step 6: Verify Payment Status
1. Use the payment status endpoint with the `bookingId`
2. Verify the payment and booking statuses are updated correctly



## Stripe Test Cards
For testing purposes, you can use these test card numbers:
- **Visa**: 4242424242424242
- **Visa (debit)**: 4000056655665556
- **Mastercard**: 5555555555554444
- **American Express**: 378282246310005
- **Declined**: 4000000000000002

## Webhook Testing (Optional)
The webhook endpoint `/payment/webhook` is configured to handle Stripe events.
For testing webhooks, you can use Stripe CLI or the Stripe Dashboard.
