
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

## Test Scenarios

### Scenario 1: Successful Payment
- Follow all steps above with valid data
- Expected: Payment completed, booking confirmed

### Scenario 2: Amount Mismatch
- In Step 3, use a different amount than the booking total
- Expected: Error response about amount mismatch

### Scenario 3: Invalid Booking ID
- Use a non-existent booking ID
- Expected: "Booking not found" error

### Scenario 4: Payment Status Check
- After successful payment, check status multiple times
- Expected: Consistent "completed" status

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


```json
{
  "info": {
    "name": "Smart Airport - Stripe Payment Integration",
    "description": "Collection for testing Stripe payment integration",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    },
    {
      "key": "authToken",
      "value": "YOUR_JWT_TOKEN_HERE"
    },
    {
      "key": "bookingId",
      "value": ""
    },
    {
      "key": "paymentIntentId",
      "value": ""
    }
  ],
  "item": [
    {
      "name": "1. Login User",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"email\": \"your-email@example.com\",\n  \"password\": \"your-password\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/users/login",
          "host": ["{{baseUrl}}"],
          "path": ["users", "login"]
        }
      }
    },
    {
      "name": "2. Create Booking",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{authToken}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"flightID\": \"F9123\",\n  \"originAirportCode\": \"CAI\",\n  \"destinationAirportCode\": \"JED\",\n  \"originCIty\": \"Cairo\",\n  \"destinationCIty\": \"Jeddah\",\n  \"departureDate\": \"2025-06-15T14:00:00Z\",\n  \"arrivalDate\": \"2025-06-15T18:30:00Z\",\n  \"selectedBaggageOption\": [\n    {\n      \"type\": \"standard\",\n      \"weight\": 20,\n      \"pieces\": 100\n    }\n  ],\n  \"totalPrice\": 450.99,\n  \"applicationFee\": 15.99,\n  \"currency\": \"USD\",\n  \"travellersInfo\": [\n    {\n      \"gender\": \"M\",\n      \"firstName\": \"ahmed\",\n      \"middleName\": \"S\",\n      \"lastName\": \"Sayed\",\n      \"birthDate\": \"1990-01-15\",\n      \"nationality\": \"EGY\",\n      \"passportNumber\": \"A1234567\",\n      \"issuingCountry\": \"EGY\",\n      \"expiryDate\": \"2027-03-05\",\n      \"contactEmail\": \"ahmedsayed@example.com\",\n      \"contactPhone\": \"+1234567890\"\n    }\n  ]\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/booking/book-flight",
          "host": ["{{baseUrl}}"],
          "path": ["booking", "book-flight"]
        }
      }
    },
    {
      "name": "3. Create Payment Intent",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{authToken}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"bookingId\": \"{{bookingId}}\",\n  \"amount\": 450.99,\n  \"currency\": \"USD\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/payment/create-payment-intent",
          "host": ["{{baseUrl}}"],
          "path": ["payment", "create-payment-intent"]
        }
      }
    },
    {
      "name": "4. Confirm Payment",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{authToken}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"paymentIntentId\": \"{{paymentIntentId}}\",\n  \"bookingId\": \"{{bookingId}}\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/payment/confirm-payment",
          "host": ["{{baseUrl}}"],
          "path": ["payment", "confirm-payment"]
        }
      }
    },
    {
      "name": "5. Get Payment Status",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{authToken}}"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/payment/status/{{bookingId}}",
          "host": ["{{baseUrl}}"],
          "path": ["payment", "status", "{{bookingId}}"]
        }
      }
    },
    {
      "name": "6. Get My Bookings",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{authToken}}"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/booking/my-bookings",
          "host": ["{{baseUrl}}"],
          "path": ["booking", "my-bookings"]
        }
      }
    }
  ]
}
```

## Quick Start Guide

### 1. Import Collection
1. Open Postman
2. Click "Import"
3. Copy and paste the JSON above
4. The collection will be imported with all endpoints

### 2. Set Variables
1. In Postman, go to the collection variables
2. Set `baseUrl` to `http://localhost:3000`
3. After login, set `authToken` to your JWT token
4. After creating booking, set `bookingId`
5. After creating payment intent, set `paymentIntentId`

### 3. Complete Test Flow (WORKING)
1. **Login** → Copy JWT token to `authToken` variable
2. **Create Booking** → Copy `bookingId` to variable
3. **Create Payment Intent** → Copy `paymentIntentId` to variable
4. **🆕 Simulate Payment** → Complete payment with test simulation
5. **Check Payment Status** → Verify payment completed
6. **Get My Bookings** → See updated booking status

### 4. Alternative Test Flow (Production-like)
1. **Login** → Get JWT token
2. **Create Booking** → Get booking ID
3. **Create Payment Intent with Auto-Confirm** → Use test payment method
4. **Check Payment Status** → Verify completion

## Server Status
✅ **Server is running successfully on http://localhost:3000**
✅ **All payment endpoints are mapped and working**
✅ **Stripe integration is properly configured**
✅ **Database connection established**

## Next Steps for Production
1. Replace test keys with live Stripe keys
2. Implement proper webhook endpoint verification
3. Add comprehensive logging and monitoring
4. Implement refund functionality
5. Add payment method storage for customers
