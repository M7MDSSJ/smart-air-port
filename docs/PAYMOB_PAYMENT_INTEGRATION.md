#Commentted for now (later)

<!-- ## API Endpoints

### 1. Create Payment

**Endpoint**: `POST /payment/create`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body**:
```json
{
  "bookingId": "60f1a9b3d4a8c90015e8e5a1",
  "amount": 10000,
  "currency": "EGP",
  "provider": "paymob",
  "method": "credit_card",
  "metadata": {
    "description": "Flight booking payment"
  }
}
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "_id": "60f1a9b3d4a8c90015e8e5a1",
    "userId": "68356f1cfa0244760ba9c27e",
    "bookingId": "60f1a9b3d4a8c90015e8e5a1",
    "amount": 10000,
    "currency": "EGP",
    "status": "pending",
    "provider": "paymob",
    "method": "credit_card",
    "createdAt": "2025-06-07T08:25:30.123Z"
  }
}
```

### 2. Get Payment by ID

**Endpoint**: `GET /payment/:id`

**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response**:
```json
{
  "status": "success",
  "data": {
    "_id": "60f1a9b3d4a8c90015e8e5a1",
    "userId": "68356f1cfa0244760ba9c27e",
    "bookingId": "60f1a9b3d4a8c90015e8e5a1",
    "amount": 10000,
    "currency": "EGP",
    "status": "completed",
    "provider": "paymob",
    "method": "credit_card",
    "transactionId": "txn_1234567890",
    "paidAt": "2025-06-07T08:26:30.123Z",
    "createdAt": "2025-06-07T08:25:30.123Z"
  }
}
```

### 3. Create Paymob Payment Key

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
  "data": {
    "paymentKey": "ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnBjM01pT2lKb2RIUndjem92TDNkM2R5NW5hV1F1WTI5dEwzQnliM1J2Y25NdVkyOXRiV1V1WTI5dEluMC5lVlF5UjF4b2JtUmhZMkZ5YkZOUFZ6Rk9iVXRQYjNKeVoybHZWRzF2Y0hKdlptbHNaU0lzSW1sa0lqb2liR1ZtZENKOS5JQ1JZbF9aYlR5Z1pUY0VWZ2h6cFp1Y3l3bWx2YlV0YVJ3a0l3Y3R4d1VQY3VqZ2Z4Q1FZR2l2V2VhV0lPZ1lR",
    "integrationId": 123456,
    "iframeId": 654321
  },
  "error": null,
  "meta": null
}
```


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

#### Integration Testing Flow
1. Create a booking using the booking endpoint
2. Call `/payment/paymob/create-payment-key` with the booking ID
3. Receive payment key and iframe ID
4. In Flutter app, load the payment iframe using the provided ID
5. Use test cards/wallet numbers to complete payment
6. Verify payment status via webhook


---

**Note:** As of June 2025, Paymob only supports the EGP (Egyptian Pound) currency. All backend requests to Paymob (order registration and payment key) will use `"EGP"` as the currency, regardless of the booking's original currency. If your booking is in another currency, the backend will convert the amount to EGP for Paymob processing.

If you see errors like `"usd" is not a valid choice.`, ensure your integration is sending/using `"EGP"` for all Paymob API calls.
---

 -->
