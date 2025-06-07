### 1. Create Payment Intent
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

### 2. Payment Confirmation via Webhook
Payment confirmation is handled automatically and securely via Stripe webhooks. After the user completes payment using Stripe.js on the frontend, Stripe sends a webhook event (such as `payment_intent.succeeded`) to the backend at `/payment/webhook`.

The backend verifies the event using the `STRIPE_WEBHOOK_SECRET` and updates the booking/payment status accordingly. The frontend does **not** need to call a confirm endpoint after payment. Instead, it should poll or query the backend for payment/booking status:

- Use `GET /payment/status/{bookingId}` to check if the payment was successful and the booking is confirmed.

**Note:**
If you need to test or debug webhooks, see the section below on Webhook Security & Configuration.

### 3. Get Payment Status
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

## Stripe Test Cards
For testing purposes, you can use these test card numbers:
- **Visa**: 4242424242424242
- **Visa (debit)**: 4000056655665556
- **Mastercard**: 5555555555554444
- **American Express**: 378282246310005
- **Declined**: 4000000000000002

## Webhook Security & Configuration

### Setting the Stripe Webhook Secret
To securely process Stripe webhook events, you **must** set the `STRIPE_WEBHOOK_SECRET` in your `.env` file. This secret is provided by Stripe when you create a webhook endpoint in the Stripe Dashboard.

Example `.env` entry:
```
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXXXXXXXXXX
```

### Why the Webhook Secret Matters
The backend uses the `STRIPE_WEBHOOK_SECRET` to verify the signature of incoming webhook requests from Stripe. This ensures that only legitimate events from Stripe are processed, protecting your application from spoofed or malicious requests.

- **Never share your webhook secret publicly.**
- If you rotate or change your webhook secret in Stripe, update your `.env` file accordingly and restart the backend.

### How the Backend Uses the Secret
The backend reads `STRIPE_WEBHOOK_SECRET` from the environment and uses it to verify the `Stripe-Signature` header on all incoming webhook requests to `/payment/webhook`. If the signature is invalid, the request is rejected and not processed.

### Testing Webhooks
You can test webhook delivery and signature verification using the Stripe CLI or the Stripe Dashboard. Make sure your backend is running and accessible to receive webhook events during testing.

## Fastify Note for Stripe Webhooks

If you are using Fastify (as in this project), you **must** enable raw body support for Stripe webhook signature verification to work. In your `main.ts`, pass `{ rawBody: true }` as the third argument to `NestFactory.create`:

```typescript
const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter({ /* ... */ }),
  { rawBody: true } // <-- Required for Stripe webhooks
);
```

This ensures that Stripe's signature verification receives the unparsed request body. Without this, webhook requests will fail with signature errors or missing payload errors.

