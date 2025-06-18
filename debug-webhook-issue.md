# Debug Webhook Issue - Payment Not Updating

## Problem Summary
- Payment successful on Stripe (Transaction ID: `pi_3RbOiwPxWTngOvfG1DTacmx3`)
- Booking status remains "pending" and paymentStatus remains "processing"
- Webhook not properly updating the booking status

## Debugging Steps

### Step 1: Check Current Booking Status

Use the debug endpoint to get detailed information:

```bash
GET http://localhost:3001/payment/debug/payment-details/6852e74e9cd22625b36751d9
Authorization: Bearer YOUR_JWT_TOKEN
```

### Step 2: Check Stripe Webhook Configuration

Verify your Stripe webhook endpoint configuration:

1. **Stripe Dashboard** → **Developers** → **Webhooks**
2. Check which endpoint URL is configured:
   - ✅ Correct: `https://your-domain.com/payment/stripe/webhook`
   - ❌ Wrong: `https://your-domain.com/payment/webhook` (requires x-provider header)

3. Check which events are enabled:
   - ✅ Required: `payment_intent.succeeded`
   - ✅ Optional: `payment_intent.payment_failed`
   - ✅ Optional: `payment_intent.canceled`

### Step 3: Test Webhook Endpoints

#### Test Stripe-Specific Webhook Endpoint

```bash
curl -X POST http://localhost:3001/payment/stripe/webhook \
  -H "Content-Type: application/json" \
  -H "stripe-signature: test_signature" \
  -d '{"test": "data"}'
```

Expected: Should see detailed logging in server console

#### Test Generic Webhook Endpoint

```bash
curl -X POST http://localhost:3001/payment/webhook \
  -H "Content-Type: application/json" \
  -H "stripe-signature: test_signature" \
  -H "x-provider: stripe" \
  -d '{"test": "data"}'
```

Expected: Should see detailed logging in server console

### Step 4: Manual Payment Status Sync

Use the debug sync endpoint to manually update the payment status:

```bash
POST http://localhost:3001/payment/debug/sync-payment-status
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "bookingId": "6852e74e9cd22625b36751d9"
}
```

This will:
1. Check the current booking status
2. Fetch the payment intent from Stripe
3. Compare statuses
4. Manually trigger the payment confirmation if needed

### Step 5: Check Server Logs

Look for these log patterns in your server console:

#### Successful Webhook Processing:
```
=== STRIPE WEBHOOK RECEIVED ===
✅ Stripe webhook event verified successfully: payment_intent.succeeded
=== HANDLING PAYMENT INTENT SUCCEEDED ===
✅ Processing successful payment for booking: 6852e74e9cd22625b36751d9
🔍 Looking for booking with ID: 6852e74e9cd22625b36751d9
📋 Found booking: {...}
🔄 Updating booking status to confirmed...
✅ Booking updated successfully: {...}
```

#### Failed Webhook Processing:
```
❌ Webhook signature verification failed: ...
❌ No booking ID found in payment intent metadata: ...
❌ Booking not found: ...
```

### Step 6: Common Issues and Solutions

#### Issue 1: Wrong Webhook Endpoint
**Problem**: Stripe is sending webhooks to `/payment/webhook` instead of `/payment/stripe/webhook`

**Solution**: Update Stripe webhook configuration to use the correct endpoint

#### Issue 2: Missing x-provider Header
**Problem**: Using generic webhook endpoint without `x-provider: stripe` header

**Solution**: Either:
- Use `/payment/stripe/webhook` endpoint (recommended)
- Add `x-provider: stripe` header to webhook configuration

#### Issue 3: Webhook Signature Verification Failed
**Problem**: `STRIPE_WEBHOOK_SECRET` doesn't match Stripe configuration

**Solution**: 
1. Go to Stripe Dashboard → Webhooks → Your webhook
2. Click "Reveal" next to "Signing secret"
3. Update your `.env` file with the correct secret

#### Issue 4: Missing Booking ID in Metadata
**Problem**: Payment intent doesn't have `bookingId` in metadata

**Solution**: Check payment intent creation to ensure metadata is set:
```javascript
metadata: {
  bookingId: "your_booking_id"
}
```

### Step 7: Environment Variables Check

Verify these environment variables are set correctly:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Step 8: Test Payment Flow End-to-End

1. Create a new booking
2. Create payment intent
3. Complete payment on frontend
4. Check if webhook is received
5. Verify booking status is updated

## Quick Fix Commands

### Force Update Booking Status (Emergency Fix)
If you need to manually update the booking status immediately:

```bash
# Connect to MongoDB and run:
db.bookings.updateOne(
  { _id: ObjectId("6852e74e9cd22625b36751d9") },
  { 
    $set: { 
      status: "confirmed", 
      paymentStatus: "completed",
      paymentCompletedAt: new Date()
    }
  }
)
```

### Check Payment Intent in Stripe CLI
```bash
stripe payment_intents retrieve pi_3RbOiwPxWTngOvfG1DTacmx3
```

## Expected Resolution

After following these steps, you should:
1. Identify why the webhook isn't being processed
2. Fix the webhook configuration or endpoint
3. See the booking status update to "confirmed"
4. See the paymentStatus update to "completed"

## Prevention

To prevent this issue in the future:
1. Set up webhook monitoring/alerting
2. Add health checks for webhook endpoints
3. Implement retry mechanisms for failed webhook processing
4. Add comprehensive logging for all payment flows
