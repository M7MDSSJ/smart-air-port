# Email Notification Testing Guide

## 🎯 Overview
This guide will help you test the email notification system that sends booking confirmation emails after successful payment. The system includes QR codes, professional HTML templates, and comprehensive booking details.

## 📧 What Gets Sent
After successful payment, users receive a professional email containing:
- **Booking Reference** (prominent display)
- **Flight Details** (airports, dates, times)
- **Passenger Information** (names, traveler types)
- **Payment Summary** (total amount paid)
- **QR Code** (for mobile boarding pass)
- **Next Steps** (check-in instructions)
- **Contact Information** (support details)

## 🛠 Prerequisites
1. **Server Running**: Make sure your NestJS server is running
2. **Gmail SMTP**: Configured and working (already set up)
3. **Valid Email**: Use a real email address you can access
4. **Postman**: For API testing

## 📋 Step-by-Step Testing Process

### Step 1: User Authentication
First, get an access token for API calls.

**POST** `http://localhost:3000/users/login`

```json
{
  "email": "your-email@example.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "..."
  }
}
```

**Copy the `accessToken`** for use in subsequent requests.

### Step 2: Create a Booking
Create a booking that will trigger the email after payment.

**POST** `http://localhost:3000/booking/book-flight`

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

**Body:**
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
  "totalPrice": 2000.00,
  "currency": "USD",
  "travellersInfo": [
    {
      "firstName": "Ahmed",
      "lastName": "Mohamed",
      "birthDate": "2000-02-01",
      "travelerType": "adult",
      "nationality": "EG",
      "passportNumber": "A12345678",
      "issuingCountry": "Egypt",
      "expiryDate": "2030-02-01"
    },
    {
      "firstName": "Sara",
      "lastName": "Ahmed",
      "birthDate": "1995-05-15",
      "travelerType": "adult",
      "nationality": "Egypt",
      "passportNumber": "B87654321",
      "issuingCountry": "EG",
      "expiryDate": "2029-05-15"
    }
  ],
  "contactDetails": {
    "email": "your-test-email@gmail.com",
    "phone": "+201234567890"
  }
}
```

**Important Notes:**
- Use **your real email** in `contactDetails.email` to receive the confirmation
- The `totalPrice` should be the final amount (no additional fees will be added)
- Make sure all traveler information is valid

**Response:**
```json
{
  "success": true,
  "message": "Flight booked successfully",
  "data": {
    "bookingId": "507f1f77bcf86cd799439011",
    "bookingRef": "AB123456",
    "status": "pending"
  }
}
```

**Copy the `bookingId`** for the payment step.

### Step 3: Process Payment (This Triggers Email!)
Now process the payment, which will automatically send the confirmation email.

**POST** `http://localhost:3000/payment/test-card-payment`

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

**Body:**
```json
{
  "bookingId": "507f1f77bcf86cd799439011",
  "amount": 2000.00,
  "currency": "USD",
  "testCard": "pm_card_visa"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Card payment test successful",
  "data": {
    "success": true,
    "paymentStatus": "completed",
    "bookingStatus": "confirmed",
    "stripeStatus": "succeeded",
    "paymentIntentId": "pi_...",
    "testPaymentMethod": "pm_card_visa",
    "booking": {
      "_id": "507f1f77bcf86cd799439011",
      "bookingRef": "AB123456",
      "status": "confirmed",
      "paymentStatus": "completed"
    },
    "message": "Card payment processed successfully from backend"
  }
}
```

### Step 4: Check Your Email! 📬
Within 30 seconds of successful payment, check the email address you used in `contactDetails.email`.

**Email Subject:** `✈️ Booking Confirmed - AB123456 | LGA → DAD`

## 📧 Email Content Verification

### Check These Elements:
1. **Header**: Smart Airport branding with gradient background
2. **Booking Reference**: Large, prominent display (e.g., "AB123456")
3. **Flight Route**: LGA → DAD with city names
4. **Dates & Times**: Properly formatted departure/arrival
5. **Passenger Table**: Names and traveler types
6. **Baggage Info**: If selected, shows baggage details
7. **Total Price**: $2,000.00 USD with "Payment completed successfully"
8. **QR Code**: Scannable QR code for mobile boarding pass
9. **Next Steps**: Check-in instructions and tips
10. **Contact Info**: Your email and phone from booking
11. **Footer**: Support information and branding

### QR Code Testing:
1. **Scan the QR code** with your phone
2. **Should contain**: `BOOKING:YOUR_BOOKING_REF` (e.g., `BOOKING:AB123456`)
3. **Format**: Simple text format for better compatibility
4. **Fallback**: If QR code doesn't show, booking reference will be displayed prominently

### Quick QR Code Test:
Before testing the full flow, test QR code generation:
**GET** `http://localhost:3000/email-test/qr-code?bookingRef=AB123456`

## 🔧 Troubleshooting

### QR Code Issues Fixed! 🎉
The QR code generation has been improved with:
- ✅ **Better error handling** and fallback display
- ✅ **Simplified QR data** (just booking reference)
- ✅ **Enhanced email template** with proper styling
- ✅ **Fallback display** if QR code fails to generate

### New Debug Endpoints:

#### Test QR Code Generation:
**GET** `http://localhost:3000/email-test/qr-code?bookingRef=TEST123`

This will test QR code generation and return:
```json
{
  "success": true,
  "data": {
    "success": true,
    "qrCodeDataURL": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "dataLength": 1234
  }
}
```

#### Preview Email Template:
**GET** `http://localhost:3000/email-test/email-preview?bookingRef=TEST123`

This generates a test email and returns the HTML for inspection.

### Email Not Received?
1. **Check Spam/Junk folder**
2. **Verify email address** in booking request
3. **Check server logs** for email sending errors
4. **Gmail SMTP** might have rate limits

### Payment Failed?
1. **Check booking amount** matches payment amount exactly
2. **Verify booking exists** and is in "pending" status
3. **Check authentication** token is valid

### QR Code Not Showing?
1. **Test QR generation**: Use `/email-test/qr-code` endpoint
2. **Check logs**: Look for QR generation success/failure messages
3. **Fallback display**: Even if QR fails, booking reference will show
4. **Email client**: Some email clients block images by default

### Server Errors?
1. **Check console logs** for detailed error messages
2. **Verify all dependencies** are installed (`qrcode` package)
3. **Check email service** configuration

## 📊 Testing Checklist

### Before Testing:
- [ ] Server is running on port 3000
- [ ] User account exists and email is verified
- [ ] Gmail SMTP is configured and working
- [ ] Postman is set up with collections

### During Testing:
- [ ] Authentication successful (got access token)
- [ ] Booking created successfully (got booking ID)
- [ ] Payment processed successfully (status: completed)
- [ ] Email received within 30 seconds
- [ ] All email content is correct and formatted properly
- [ ] QR code scans successfully

### Email Quality Check:
- [ ] Professional appearance and branding
- [ ] Mobile-responsive design
- [ ] All booking details accurate
- [ ] QR code generates and scans correctly
- [ ] Contact information matches booking
- [ ] Next steps are clear and helpful

## 🎨 Email Template Features

### Design Elements:
- **Gradient Header**: Purple gradient with white text
- **Responsive Layout**: Works on mobile and desktop
- **Professional Typography**: Clean, readable fonts
- **Color Coding**: Different sections with appropriate colors
- **Interactive Elements**: QR code for mobile scanning

### Content Sections:
1. **Header**: Branding and booking confirmation
2. **Flight Info**: Route, dates, times in organized layout
3. **Passengers**: Table format with names and types
4. **Baggage**: Optional section if baggage selected
5. **Payment**: Total amount with success confirmation
6. **QR Code**: Mobile boarding pass with instructions
7. **Next Steps**: Helpful travel tips and instructions
8. **Contact**: Booking contact details
9. **Footer**: Support information and disclaimers

## 🚀 Success Criteria

Your email notification system is working correctly if:
1. ✅ Email is sent immediately after successful payment
2. ✅ Email contains all booking details accurately
3. ✅ QR code generates and scans properly
4. ✅ Email design is professional and mobile-friendly
5. ✅ No errors in server logs during the process
6. ✅ Payment amount matches booking total exactly

## 📞 Support

If you encounter issues:
1. **Check server logs** for detailed error messages
2. **Verify email configuration** in environment variables
3. **Test with different email addresses** to rule out provider issues
4. **Review Postman requests** for correct formatting

The email notification system is now fully integrated and ready for production use! 🎉
