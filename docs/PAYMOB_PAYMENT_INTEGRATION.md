# Paymob Payment Integration Documentation

This document outlines the integration of Paymob payment gateway with the Smart Airport backend system for Flutter SDK integration.

## Overview

Paymob is a payment gateway that supports various payment methods including credit cards, mobile wallets, and bank transfers. This integration focuses on credit card payments through Paymob's Flutter SDK for native mobile app integration.

## Configuration

### Environment Variables

The following environment variables must be set for Paymob integration:

```env
PAYMOB_API_KEY=your_paymob_api_key
PAYMOB_MERCHANT_ID=your_merchant_id
PAYMOB_HMAC_SECRET=your_hmac_secret
PAYMOB_CARD_INTEGRATION_ID=your_card_integration_id
```

**Note:** `PAYMOB_IFRAME_ID` is no longer required as this integration uses the Flutter SDK approach instead of iframe.

### Flutter SDK Setup

To use this backend with the Paymob Flutter SDK, add the following dependency to your Flutter app:

```yaml
dependencies:
  paymob_payment: ^2.0.0  # Use the latest version
```

## API Endpoints

### 1. Create Payment Key for SDK Integration

**Endpoint**: `POST /payment/paymob/create-payment-key`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body**:
```json
{
  "bookingId": "60d5ecb8f8a9b81234567890",
  "mobileNumber": "+201234567890",
  "email": "user@example.com"
}
```

**Parameters**:
- `bookingId` (required): The ID of the booking to pay for
- `mobileNumber` (optional): User's mobile number for payment receipt
- `email` (optional): User's email for payment receipt (defaults to user's account email)

**Response**:
```json
{
  "success": true,
  "paymentKey": "ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnBjM01pT2lKb2RIUndjem92TDNkM2R5NW5hV1F1WTI5dEwzQnliM1J2Y25NdVkyOXRiV1V1WTI5dEluMC5lVlF5UjF4b2JtUmhZMkZ5YkZOUFZ6Rk9iVXRQYjNKeVoybHZWRzF2Y0hKdlptbHNaU0lzSW1sa0lqb2liR1ZtZENKOS5JQ1JZbF9aYlR5Z1pUY0VWZ2h6cFp1Y3l3bWx2YlV0YVJ3a0l3Y3R4d1VQY3VqZ2Z4Q1FZR2l2V2VhV0lPZ1lR",
  "integrationId": "123456",
  "orderId": 1234567890,
  "amountCents": 10000,
  "currency": "EGP",
  "expiresAt": "2025-06-07T09:25:30.123Z",
  "merchantOrderId": "60d5ecb8f8a9b81234567890"
}
```

### 2. Verify Payment Status

**Endpoint**: `POST /payment/paymob/verify-payment`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body**:
```json
{
  "bookingId": "60d5ecb8f8a9b81234567890",
  "transactionId": "txn_1234567890"
}
```

**Response**:
```json
{
  "success": true,
  "paymentStatus": "completed",
  "transactionId": "txn_1234567890",
  "amount": 100.00,
  "currency": "EGP",
  "paidAt": "2025-06-07T08:26:30.123Z",
  "metadata": {
    "paymobOrderId": 1234567890,
    "integrationId": "123456"
  }
}
```

### 3. Get Payment Status by Booking ID

**Endpoint**: `GET /payment/paymob/status/:bookingId`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response**:
```json
{
  "success": true,
  "paymentStatus": "pending",
  "paymentKey": "ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5...",
  "integrationId": "123456",
  "orderId": 1234567890,
  "amount": 100.00,
  "currency": "EGP",
  "expiresAt": "2025-06-07T09:25:30.123Z",
  "createdAt": "2025-06-07T08:25:30.123Z",
  "transactionId": null
}
```

## Flutter SDK Integration

### Using the Payment Data in Flutter

After receiving the payment data from the backend, use it with the Paymob Flutter SDK:

```dart
import 'package:paymob_payment/paymob_payment.dart';

// Initialize Paymob
PaymobPayment.instance.initialize(
  apiKey: "YOUR_API_KEY", // This should match your backend configuration
  integrationID: int.parse(paymentData['integrationId']),
  iFrameID: 12345, // Not used in SDK mode, but required by the package
);

// Start payment
PaymobResponse? response = await PaymobPayment.instance.pay(
  context: context,
  currency: paymentData['currency'],
  amountInCents: paymentData['amountCents'],
  paymentToken: paymentData['paymentKey'],
);

// Handle response
if (response != null) {
  if (response.success == true) {
    // Payment successful
    print("Transaction ID: ${response.transactionID}");
    // Verify payment with backend
    await verifyPaymentWithBackend(response.transactionID);
  } else {
    // Payment failed
    print("Payment failed: ${response.responseMessage}");
  }
}
```

### Payment Verification Flow

1. **Create Payment Key**: Call `/payment/paymob/create-payment-key` to get payment data
2. **Process Payment**: Use the Flutter SDK with the received payment key
3. **Verify Payment**: Call `/payment/paymob/verify-payment` with the transaction ID
4. **Check Status**: Optionally use `/payment/paymob/status/:bookingId` to check current status


## Webhook Handling

### Paymob Webhook

**Endpoint**: `POST /payment/webhook/paymob`

**Headers**:
```
Content-Type: application/json
x-paymob-signature: HMAC_SIGNATURE  // If HMAC verification is enabled
```

**Example Payload**:
```json
{
  "obj": {
    "order": {
      "id": "1234567890",
      "created_at": "2025-06-07T08:25:30.123Z",
      "amount_cents": 10000,
      "currency": "EGP"
    },
    "is_3d_secure": false,
    "is_void": false,
    "is_refunded": false,
    "id": 1234567890,
    "pending": false,
    "source_data": {
      "sub_type": "TOKEN",
      "pan": "2345",
      "type": "card"
    },
    "success": true
  }
}
```

### Stripe Webhook

**Endpoint**: `POST /payment/webhook/stripe`

**Headers**:
```
Stripe-Signature: SIGNATURE
Content-Type: application/json
```

## Testing

### Test Cards

#### Paymob Test Cards

| Card Number | Expiry | CVV | 3D Secure | Expected Result |
|-------------|---------|-----|------------|-----------------|
| 4987654321098769 | Any future date | 123 | No | Success |
| 4000000000000002 | Any future date | 123 | No | Insufficient Funds |
| 4000000000000119 | Any future date | 123 | No | Expired Card |
| 4000000000000069 | Any future date | 123 | Yes | 3D Secure Verification Required |

#### Stripe Test Cards

| Card Number | Expiry | CVV | Expected Result |
|-------------|---------|-----|-----------------|
| 4242424242424242 | Any future date | Any 3 digits | Success |
| 4000000000009995 | Any future date | Any 3 digits | Insufficient Funds |
| 4000000000000002 | Any future date | Any 3 digits | Success (3D Secure) |

### Testing Paymob Integration

#### Test Cards
For testing card payments in Paymob's sandbox environment:

```plaintext
Card Number: 4987654321098769
Cardholder Name: Test Account
Expiry Date: Any future date
CVV: 123
```

#### Test Mobile Wallet
For testing mobile wallet payments:
```plaintext
Phone Number: 01234567890
PIN/OTP: Any numbers
```

#### SDK Integration Testing Flow
1. Create a booking using the booking endpoint
2. Call `/payment/paymob/create-payment-key` with the booking ID
3. Receive payment key, integration ID, and other SDK data
4. In Flutter app, use the Paymob SDK with the received payment data
5. Use test cards/wallet numbers to complete payment
6. Call `/payment/paymob/verify-payment` to verify the payment status
7. Optionally check payment status using `/payment/paymob/status/:bookingId`

#### Testing with Postman

**Step 1: Create Payment Key**
```bash
POST {{base_url}}/payment/paymob/create-payment-key
Authorization: Bearer {{jwt_token}}
Content-Type: application/json

{
  "bookingId": "your_booking_id",
  "mobileNumber": "+201234567890",
  "email": "test@example.com"
}
```

**Step 2: Verify Payment (after SDK payment)**
```bash
POST {{base_url}}/payment/paymob/verify-payment
Authorization: Bearer {{jwt_token}}
Content-Type: application/json

{
  "bookingId": "your_booking_id",
  "transactionId": "transaction_id_from_sdk"
}
```

**Step 3: Check Payment Status**
```bash
GET {{base_url}}/payment/paymob/status/your_booking_id
Authorization: Bearer {{jwt_token}}
```


---

## Important Notes

### Currency Support
**Note:** As of June 2025, Paymob only supports the EGP (Egyptian Pound) currency. All backend requests to Paymob (order registration and payment key) will use `"EGP"` as the currency, regardless of the booking's original currency. If your booking is in another currency, the backend will convert the amount to EGP for Paymob processing.

If you see errors like `"usd" is not a valid choice.`, ensure your integration is sending/using `"EGP"` for all Paymob API calls.

### SDK vs Iframe Integration
This backend now supports **Flutter SDK integration** instead of the iframe approach. Key differences:

- **No iframe URL**: The response no longer includes `paymentUrl` or `iframeId`
- **Payment Key**: Use the `paymentKey` directly with the Flutter SDK
- **Integration ID**: Use the `integrationId` for SDK initialization
- **Native Experience**: Payments happen natively within your Flutter app
- **Better UX**: No need to open web views or external browsers

### Migration from Iframe
If you're migrating from the iframe approach:

1. Remove any iframe/WebView code from your Flutter app
2. Install the Paymob Flutter SDK package
3. Update your payment flow to use the SDK with the payment key
4. Use the new verification endpoints for payment confirmation

---


