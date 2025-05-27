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

## Table of Contents
1. [Booking Endpoints](#booking-endpoints)
2. [Data Models](#data-models)
3. [Validation Rules](#validation-rules)
4. [Error Handling](#error-handling)
5. [Application Fee](#application-fee)

---

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

### 4. Calculate Application Fee
**GET** `/booking/calculate-fee?basePrice={amount}`

Calculate the application fee and total price for a given base price. This endpoint helps frontend/mobile applications determine the final amount before creating a booking.

**Query Parameters:**
- `basePrice`: Base ticket price (number)

**Example Request:**
```
GET /booking/calculate-fee?basePrice=1500
```

**Response (200):**
```json
{
  "success": true,
  "message": "Application fee calculated successfully",
  "data": {
    "success": true,
    "calculation": {
      "basePrice": 1500.00,
      "applicationFee": 37.50,
      "totalPrice": 1537.50
    }
  },
  "error": null,
  "meta": null
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Invalid base price provided",
  "error": "Bad Request",
  "statusCode": 400
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

### Fee Calculation
- **Percentage**: 2.5% of the base ticket price
- **Minimum Fee**: $5.00 USD
- **Maximum Fee**: $50.00 USD

### How It Works
1. **Frontend/Mobile**: Use the `/booking/calculate-fee` endpoint to get the total price including fee
2. **Booking Request**: Send the calculated total price in the `totalPrice` field
3. **Payment**: Use the same total price for payment processing

### Example Workflow
```javascript
// Step 1: Calculate total with fee
const response = await fetch('/booking/calculate-fee?basePrice=1500');
const { calculation } = response.data;
// calculation = { basePrice: 1500.00, applicationFee: 37.50, totalPrice: 1537.50 }

// Step 2: Create booking with total price
const bookingData = {
  // ... other booking data
  totalPrice: calculation.totalPrice, // 1537.50
  currency: "USD"
};

// Step 3: Process payment with same amount
const paymentData = {
  bookingId: "...",
  amount: calculation.totalPrice, // 1537.50
  currency: "USD"
};
```

### Fee Rules
1. The fee is calculated on the base ticket price before taxes and baggage fees
2. Frontend/mobile must calculate and include the fee in the `totalPrice`
3. The fee is charged in the same currency as the ticket
4. Minimum and maximum limits ensure fair pricing across all price ranges
5. Payment amount must match the booking's total price exactly

---

## Booking Status

### Status Values
- `pending`: Booking created, awaiting payment
- `confirmed`: Payment completed, booking confirmed
- `cancelled`: Booking cancelled by user or system

### Payment Status Values
- `pending`: Payment not yet initiated
- `processing`: Payment in progress
- `completed`: Payment successful
- `failed`: Payment failed
- `refunded`: Payment refunded

---

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

## Mobile/Frontend Integration Tips

### 1. Authentication Flow
```javascript
// Ensure user is authenticated and verified before booking
const token = localStorage.getItem('accessToken');
const userProfile = await getUserProfile(token);

if (!userProfile.isVerified) {
  // Redirect to email verification
  redirectToEmailVerification();
  return;
}
```

### 2. Form Validation
Implement client-side validation matching server requirements:
```javascript
const validateTraveler = (traveler) => {
  const errors = {};

  if (!traveler.firstName || traveler.firstName.length < 2) {
    errors.firstName = 'First name must be at least 2 characters';
  }

  if (!traveler.passportNumber || traveler.passportNumber.length < 6) {
    errors.passportNumber = 'Passport number must be at least 6 characters';
  }

  // Validate passport expiry is in the future
  const expiryDate = new Date(traveler.expiryDate);
  if (expiryDate <= new Date()) {
    errors.expiryDate = 'Passport must not be expired';
  }

  return errors;
};
```

### 3. Price Calculation and Display
Use the calculate-fee endpoint to get accurate pricing:
```javascript
const calculateAndDisplayPrice = async (basePrice) => {
  try {
    const response = await fetch(`/booking/calculate-fee?basePrice=${basePrice}`);
    const data = await response.json();
    const { calculation } = data.data;

    return {
      basePrice: formatCurrency(calculation.basePrice),
      applicationFee: formatCurrency(calculation.applicationFee),
      totalPrice: formatCurrency(calculation.totalPrice),
      rawTotal: calculation.totalPrice // Use this for booking and payment
    };
  } catch (error) {
    console.error('Error calculating price:', error);
    throw error;
  }
};
```

### 4. Complete Booking Flow
```javascript
const completeBookingFlow = async (flightData, travelers, contactDetails) => {
  try {
    // Step 1: Calculate total price with fee
    const priceCalculation = await fetch(`/booking/calculate-fee?basePrice=${flightData.basePrice}`);
    const { calculation } = (await priceCalculation.json()).data;

    // Step 2: Create booking with calculated total
    const bookingData = {
      ...flightData,
      totalPrice: calculation.totalPrice, // Important: use calculated total
      travellersInfo: travelers,
      contactDetails: contactDetails
    };

    const bookingResponse = await fetch('/booking/book-flight', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAccessToken()}`
      },
      body: JSON.stringify(bookingData)
    });

    const booking = await bookingResponse.json();

    // Step 3: Process payment with same amount
    const paymentData = {
      bookingId: booking.data.bookingId,
      amount: calculation.totalPrice, // Same amount as booking
      currency: bookingData.currency
    };

    const paymentResponse = await processPayment(paymentData);

    return {
      booking: booking.data,
      payment: paymentResponse
    };

  } catch (error) {
    handleBookingError(error);
    throw error;
  }
};
```

### 5. Error Handling
```javascript
const handleBookingError = (error) => {
  if (error.status === 401) {
    // Redirect to login or refresh token
    handleAuthError();
  } else if (error.status === 400 && error.errors) {
    // Display validation errors
    displayValidationErrors(error.errors);
  } else {
    // Display generic error message
    showErrorMessage(error.message);
  }
};
```

### 6. Booking Reference Storage
```javascript
const createBooking = async (bookingData) => {
  try {
    const response = await api.post('/booking/book-flight', bookingData);

    // Store booking reference for easy access
    localStorage.setItem('lastBookingRef', response.data.bookingRef);

    // Redirect to booking confirmation
    redirectToBookingConfirmation(response.data.bookingId);
  } catch (error) {
    handleBookingError(error);
  }
};
```

---

## Security Considerations

1. **Authentication**: All endpoints require valid JWT tokens
2. **Authorization**: Users can only access their own bookings
3. **Data Validation**: All input is validated server-side
4. **Sensitive Data**: Passport numbers and personal information are handled securely
5. **Rate Limiting**: Prevents abuse of booking endpoints
6. **HTTPS**: All communication must use HTTPS in production
7. **Price Integrity**: Payment amount must exactly match booking total price

---

## Summary

The booking system now works as follows:

1. **Frontend/Mobile** calls `/booking/calculate-fee?basePrice=X` to get the total including application fee
2. **Frontend/Mobile** creates booking with the calculated `totalPrice`
3. **Backend** stores the booking with the provided total price (no additional fee calculation)
4. **Payment** uses the same total price from the booking
5. **No amount mismatch** occurs because all systems use the same calculated total

This ensures consistency between booking creation and payment processing while giving frontend/mobile full control over price calculation and display.