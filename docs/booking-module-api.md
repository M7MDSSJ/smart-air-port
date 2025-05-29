# Booking Module API Documentation

## Overview
The Booking Module handles flight booking operations including creating bookings, managing passenger information, and tracking booking status. All booking endpoints require user authentication and email verification.

## Base URL
```
https://your-api-domain.com/booking
```

## Authentication
All booking endpoints require JWT authentication. Include the access token in the Authorization header:
```
Authorization: Bearer <access_token>
```

**Note**: Users must have verified email addresses to access booking functionality.


## Booking Endpoints

### 1. Create Flight Booking
**POST** `/booking/book-flight`
**Authentication:** Required (Verified users only)

Create a new flight booking with passenger information and contact details.

**Request Body:**
```json
{
  "flightID": "FL123456",
  "originAirportCode": "LGA",
  "destinationAirportCode": "DAD",
  "originCIty": "New York",
  "destinationCIty": "Da Nang",
  "departureDate": "2024-08-28",
  "arrivalDate": "2024-08-28",
  "selectedBaggageOption": {
    "type": "checked",
    "weight": "23kg",
    "price": 50,
    "currency": "USD"
  },
  "totalPrice": 1500.00,
  "currency": "USD",
  "travellersInfo": [
    {
      "firstName": "Ahmed",
      "lastName": "Mohamed",
      "birthDate": "2000-02-01",
      "travelerType": "adult",
      "nationality": "Egypt",
      "passportNumber": "A12345678",
      "issuingCountry": "Egypt",
      "expiryDate": "2030-02-01"
    },
    {
      "firstName": "Sara",
      "lastName": "Ahmed",
      "birthDate": "1995-05-15",
      "travelerType": "adult",
      "nationality": "Egypt", // or EG  "Egyptain" don`t work
      "passportNumber": "B87654321",
      "issuingCountry": "Egypt",
      "expiryDate": "2029-05-15"
    }
  ],
  "contactDetails": {
    "email": "ahmed.mohamed@example.com",
    "phone": "+201234567890"
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Flight booked successfully",
  "data": {
    "success": true,
    "message": "Flight booked successfully",
    "bookingId": "507f1f77bcf86cd799439011",
    "bookingRef": "AB123456",
    "status": "pending"
  },
  "error": null,
  "meta": null
}
```

### 2. Get User Bookings
**GET** `/booking/my-bookings`
**Authentication:** Required

Retrieve all bookings for the authenticated user.

**Response (200):**
```json
{
  "success": true,
  "message": "response.success",
  "data": {
    "success": true,
    "bookings": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "userId": "507f1f77bcf86cd799439012",
        "flightId": "FL123456",
        "originAirportCode": "LGA",
        "destinationAirportCode": "DAD",
        "originCity": "New York",
        "destinationCity": "Da Nang",
        "departureDate": "2024-08-28T00:00:00.000Z",
        "arrivalDate": "2024-08-28T00:00:00.000Z",
        "selectedBaggageOption": {
          "type": "checked",
          "weight": "23kg",
          "price": 50,
          "currency": "USD"
        },
        "totalPrice": 1537.50,
        "currency": "USD",
        "travellersInfo": [
          {
            "firstName": "Ahmed",
            "lastName": "Mohamed",
            "birthDate": "2000-02-01",
            "travelerType": "adult",
            "nationality": "Egyptian",
            "passportNumber": "A12345678",
            "issuingCountry": "Egypt",
            "expiryDate": "2030-02-01"
          }
        ],
        "contactDetails": {
          "email": "ahmed.mohamed@example.com",
          "phone": "+201234567890"
        },
        "bookingRef": "AB123456",
        "status": "pending",
        "paymentStatus": "pending",
        "createdAt": "2024-02-27T09:05:47.193Z",
        "updatedAt": "2024-02-27T09:05:47.193Z"
      }
    ]
  },
  "error": null,
  "meta": null
}
```

### 3. Get Booking Details
**GET** `/booking/:id`
**Authentication:** Required

Get detailed information about a specific booking.

**Parameters:**
- `id`: Booking ID

**Response (200):**
```json
{
  "success": true,
  "message": "response.success",
  "data": {
    "success": true,
    "booking": {
      "_id": "507f1f77bcf86cd799439011",
      "userId": "507f1f77bcf86cd799439012",
      "flightId": "FL123456",
      "originAirportCode": "LGA",
      "destinationAirportCode": "DAD",
      "originCity": "New York",
      "destinationCity": "Da Nang",
      "departureDate": "2024-08-28T00:00:00.000Z",
      "arrivalDate": "2024-08-28T00:00:00.000Z",
      "selectedBaggageOption": {
        "type": "checked",
        "weight": "23kg",
        "price": 50,
        "currency": "USD"
      },
      "totalPrice": 1537.50,
      "currency": "USD",
      "travellersInfo": [
        {
          "firstName": "Ahmed",
          "lastName": "Mohamed",
          "birthDate": "2000-02-01",
          "travelerType": "adult",
          "nationality": "Egyptian",
          "passportNumber": "A12345678",
          "issuingCountry": "Egypt",
          "expiryDate": "2030-02-01"
        }
      ],
      "contactDetails": {
        "email": "ahmed.mohamed@example.com",
        "phone": "+201234567890"
      },
      "bookingRef": "AB123456",
      "status": "pending",
      "paymentStatus": "pending",
      "createdAt": "2024-02-27T09:05:47.193Z",
      "updatedAt": "2024-02-27T09:05:47.193Z"
    }
  },
  "error": null,
  "meta": null
}
```


---

## Data Models

### Booking Object
```typescript
interface Booking {
  _id: string;
  userId: string;
  flightId: string;
  originAirportCode: string;
  destinationAirportCode: string;
  originCity: string;
  destinationCity: string;
  departureDate: Date;
  arrivalDate: Date;
  selectedBaggageOption?: BaggageOption;
  totalPrice: number;
  currency: string;
  travellersInfo: TravellerInfo[];
  contactDetails: ContactDetails;
  bookingRef: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  paymentStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  paymentIntentId?: string;
  stripeCustomerId?: string;
  paymentCompletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Traveller Information
```typescript
interface TravellerInfo {
  firstName: string;
  lastName: string;
  birthDate: string; // YYYY-MM-DD format
  travelerType: 'adult' | 'child' | 'infant';
  nationality: string;
  passportNumber: string;
  issuingCountry: string;
  expiryDate: string; // YYYY-MM-DD format
}
```

### Contact Details
```typescript
interface ContactDetails {
  email: string;
  phone: string; // International format with country code
}
```

### Baggage Option
```typescript
interface BaggageOption {
  type: string; // e.g., 'checked', 'carry-on'
  weight: string; // e.g., '23kg'
  price: number;
  currency: string;
  [key: string]: any; // Additional properties as needed
}
```

---

## Validation Rules

### Flight Information
- `flightID`: Required, non-empty string
- `originAirportCode`: Required, 3-character IATA code
- `destinationAirportCode`: Required, 3-character IATA code
- `originCIty`: Required, non-empty string
- `destinationCIty`: Required, non-empty string
- `departureDate`: Required, valid date in YYYY-MM-DD format
- `arrivalDate`: Required, valid date in YYYY-MM-DD format

### Pricing
- `totalPrice`: Required, positive number
- `currency`: Required, 3-character currency code (e.g., USD, EUR)

### Traveller Information
- `firstName`: Required, minimum 2 characters
- `lastName`: Required, minimum 2 characters
- `birthDate`: Required, valid date in YYYY-MM-DD format
- `travelerType`: Required, must be 'adult', 'child', or 'infant'
- `nationality`: Required, valid country name or ISO code
- `passportNumber`: Required, minimum 6 characters
- `issuingCountry`: Required, valid country name or ISO code
- `expiryDate`: Required, valid future date in YYYY-MM-DD format

### Contact Details
- `email`: Required, valid email format
- `phone`: Required, valid international phone number format

### Baggage Options
- `selectedBaggageOption`: Optional object with flexible structure

---

## Application Fee

The application fee is calculated separately and should be included in the total price sent to the booking endpoint:



## Error Handling

### Standard Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Error type",
  "statusCode": 400,
  "timestamp": "2025-02-27T09:05:47.193Z",
  "path": "/booking/book-flight",
  "errors": {
    "flightID": "Flight ID is required",
    "travellersInfo.0.firstName": "First name is required"
  }
}
```

### Common Booking Errors

**Authentication Required:**
```json
{
  "success": false,
  "message": "User not authenticated",
  "statusCode": 401
}
```

**Email Not Verified:**
```json
{
  "success": false,
  "message": "User email not verified",
  "statusCode": 401
}
```

**Invalid Flight ID:**
```json
{
  "success": false,
  "message": "Flight not found",
  "statusCode": 404
}
```

**Validation Errors:**
```json
{
  "success": false,
  "message": "Please check the following fields",
  "errors": {
    "travellersInfo.0.passportNumber": "Passport number must be at least 6 characters",
    "contactDetails.email": "Invalid email format"
  }
}
```

**Booking Not Found:**
```json
{
  "success": false,
  "message": "Booking with ID 507f1f77bcf86cd799439011 not found",
  "statusCode": 404
}
```

**Unauthorized Access:**
```json
{
  "success": false,
  "message": "You are not authorized to view this booking",
  "statusCode": 403
}
```

---


## Summary

The booking system now works as follows:

1. **Frontend/Mobile** calls `/booking/calculate-fee?basePrice=X` to get the total including application fee
2. **Frontend/Mobile** creates booking with the calculated `totalPrice`
3. **Backend** stores the booking with the provided total price (no additional fee calculation)
4. **Payment** uses the same total price from the booking
5. **No amount mismatch** occurs because all systems use the same calculated total

This ensures consistency between booking creation and payment processing while giving frontend/mobile full control over price calculation and display.