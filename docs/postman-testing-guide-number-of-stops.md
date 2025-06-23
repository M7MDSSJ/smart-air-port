# Postman Testing Guide: Number of Stops Feature

This guide will help you test the newly added `numberOfStops` field for both one-way and round-trip flight bookings.

## Prerequisites

1. **Authentication**: You need a valid JWT token
   - First, register/login to get a JWT token
   - Use the token in the Authorization header for all booking requests

2. **Base URL**: `http://localhost:3000` (adjust if different)

3. **Required Headers**:
   ```
   Content-Type: application/json
   Authorization: Bearer YOUR_JWT_TOKEN
   ```

## Test Cases

### 1. One-Way Booking with Number of Stops

#### Test Case 1.1: Direct Flight (0 stops)
```http
POST /booking/book-flight
```

**Request Body:**
```json
{
  "bookingType": "ONE_WAY",
  "flightID": "OW123456",
  "numberOfStops": 0,
  "originAirportCode": "LGA",
  "destinationAirportCode": "DAD",
  "originCIty": "New York",
  "destinationCIty": "Da Nang",
  "departureDate": "2024-12-28",
  "arrivalDate": "2024-12-29",
  "selectedBaggageOption": {
    "type": "checked",
    "weight": "23kg",
    "price": 50
  },
  "totalPrice": 800.00,
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
  }
}
```

#### Test Case 1.2: One Stop Flight
```json
{
  "bookingType": "ONE_WAY",
  "flightID": "OW789012",
  "numberOfStops": 1,
  "originAirportCode": "LGA",
  "destinationAirportCode": "DAD",
  "originCIty": "New York",
  "destinationCIty": "Da Nang",
  "departureDate": "2024-12-28",
  "arrivalDate": "2024-12-29",
  "selectedBaggageOption": {
    "type": "checked",
    "weight": "23kg",
    "price": 50
  },
  "totalPrice": 750.00,
  "currency": "USD",
  "travellersInfo": [
    {
      "firstName": "Sarah",
      "lastName": "Johnson",
      "birthDate": "1995-05-15",
      "travelerType": "adult",
      "nationality": "American",
      "passportNumber": "B98765432",
      "issuingCountry": "United States",
      "expiryDate": "2029-05-15"
    }
  ],
  "contactDetails": {
    "email": "sarah.johnson@example.com",
    "phone": "+12345678901"
  }
}
```

#### Test Case 1.3: Two Stops Flight
```json
{
  "bookingType": "ONE_WAY",
  "flightID": "OW345678",
  "numberOfStops": 2,
  "originAirportCode": "LGA",
  "destinationAirportCode": "DAD",
  "originCIty": "New York",
  "destinationCIty": "Da Nang",
  "departureDate": "2024-12-28",
  "arrivalDate": "2024-12-30",
  "selectedBaggageOption": {
    "type": "checked",
    "weight": "23kg",
    "price": 50
  },
  "totalPrice": 650.00,
  "currency": "USD",
  "travellersInfo": [
    {
      "firstName": "Maria",
      "lastName": "Garcia",
      "birthDate": "1988-08-20",
      "travelerType": "adult",
      "nationality": "Spanish",
      "passportNumber": "C11223344",
      "issuingCountry": "Spain",
      "expiryDate": "2028-08-20"
    }
  ],
  "contactDetails": {
    "email": "maria.garcia@example.com",
    "phone": "+34123456789"
  }
}
```

### 2. Round-Trip Booking with Number of Stops

#### Test Case 2.1: Round-Trip with Different Stops
```json
{
  "bookingType": "ROUND_TRIP",
  "flightData": [
    {
      "flightID": "GO123456",
      "typeOfFlight": "GO",
      "numberOfStops": 1,
      "originAirportCode": "LGA",
      "destinationAirportCode": "DAD",
      "originCIty": "New York",
      "destinationCIty": "Da Nang",
      "departureDate": "2024-12-28",
      "arrivalDate": "2024-12-29",
      "selectedBaggageOption": {
        "type": "checked",
        "weight": "23kg",
        "price": 50
      }
    },
    {
      "flightID": "RT789012",
      "typeOfFlight": "RETURN",
      "numberOfStops": 0,
      "originAirportCode": "DAD",
      "destinationAirportCode": "LGA",
      "originCIty": "Da Nang",
      "destinationCIty": "New York",
      "departureDate": "2025-01-05",
      "arrivalDate": "2025-01-06",
      "selectedBaggageOption": {
        "type": "checked",
        "weight": "23kg",
        "price": 50
      }
    }
  ],
  "totalPrice": 1500.00,
  "currency": "USD",
  "travellersInfo": [
    {
      "firstName": "John",
      "lastName": "Doe",
      "birthDate": "1990-01-01",
      "travelerType": "adult",
      "nationality": "American",
      "passportNumber": "D55667788",
      "issuingCountry": "United States",
      "expiryDate": "2030-01-01"
    }
  ],
  "contactDetails": {
    "email": "john.doe@example.com",
    "phone": "+12345678901"
  }
}
```

### 3. Validation Test Cases

#### Test Case 3.1: Invalid Number of Stops (Negative)
```json
{
  "bookingType": "ONE_WAY",
  "flightID": "OW123456",
  "numberOfStops": -1,
  "originAirportCode": "LGA",
  "destinationAirportCode": "DAD",
  "originCIty": "New York",
  "destinationCIty": "Da Nang",
  "departureDate": "2024-12-28",
  "arrivalDate": "2024-12-29",
  "totalPrice": 800.00,
  "currency": "USD",
  "travellersInfo": [
    {
      "firstName": "Test",
      "lastName": "User",
      "birthDate": "1990-01-01",
      "travelerType": "adult",
      "nationality": "American",
      "passportNumber": "T12345678",
      "issuingCountry": "United States",
      "expiryDate": "2030-01-01"
    }
  ],
  "contactDetails": {
    "email": "test@example.com",
    "phone": "+12345678901"
  }
}
```

**Expected Response:** 400 Bad Request with validation error

#### Test Case 3.2: Invalid Number of Stops (Too High)
```json
{
  "bookingType": "ONE_WAY",
  "flightID": "OW123456",
  "numberOfStops": 5,
  "originAirportCode": "LGA",
  "destinationAirportCode": "DAD",
  "originCIty": "New York",
  "destinationCIty": "Da Nang",
  "departureDate": "2024-12-28",
  "arrivalDate": "2024-12-29",
  "totalPrice": 800.00,
  "currency": "USD",
  "travellersInfo": [
    {
      "firstName": "Test",
      "lastName": "User",
      "birthDate": "1990-01-01",
      "travelerType": "adult",
      "nationality": "American",
      "passportNumber": "T12345678",
      "issuingCountry": "United States",
      "expiryDate": "2030-01-01"
    }
  ],
  "contactDetails": {
    "email": "test@example.com",
    "phone": "+12345678901"
  }
}
```

**Expected Response:** 400 Bad Request with validation error

## Expected Responses

### Successful Booking Response
```json
{
  "success": true,
  "message": "Flight booked successfully",
  "data": {
    "success": true,
    "message": "Flight booked successfully",
    "bookingId": "674a1234567890abcdef1234",
    "bookingRef": "AB123456",
    "status": "pending"
  },
  "error": null,
  "meta": null
}
```

### Validation Error Response
```json
{
  "success": false,
  "message": "Please check the following fields",
  "errors": {
    "numberOfStops": "Number of stops must be non-negative, Number of stops cannot exceed 2"
  }
}
```

## Testing Steps

1. **Setup Authentication**
   - Register a new user or login with existing credentials
   - Copy the JWT token from the response

2. **Test Valid Cases**
   - Test each valid numberOfStops value (0, 1, 2)
   - Test both one-way and round-trip bookings
   - Verify the response includes the booking details

3. **Test Validation**
   - Test negative values
   - Test values greater than 2
   - Test non-numeric values
   - Verify proper error messages

4. **Verify Database Storage**
   - Check that the numberOfStops field is properly saved
   - Verify it appears in booking retrieval endpoints

## Notes

- The `numberOfStops` field is optional - you can omit it entirely
- Valid values are 0, 1, or 2
- The field works for both legacy one-way bookings and new round-trip bookings
- Make sure to use future dates for departure/arrival dates
- Adjust the email addresses to avoid conflicts if testing multiple times
