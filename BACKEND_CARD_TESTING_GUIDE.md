# Backend Card Testing Guide

## 🎯 **Overview**

Test real card payments from the backend without waiting for frontend team. Multiple approaches available.

## 🔧 **Option 1: New Backend Test Endpoint (Easiest)**

### **Test Card Payment Endpoint**
```
POST /payment/test-card-payment
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

Request:
{
  "bookingId": "your_booking_id",
  "amount": 450.99,
  "currency": "USD",
  "testCard": "pm_card_visa"
}

Response (Success):
{
  "success": true,
  "message": "Card payment test successful",
  "data": {
    "paymentStatus": "completed",
    "bookingStatus": "confirmed",
    "stripeStatus": "succeeded",
    "paymentIntentId": "pi_xxx",
    "testPaymentMethod": "pm_card_visa",
    "booking": { ... }
  }
}
```

### **Available Test Cards**
```json
{
  "pm_card_visa": "Visa success",
  "pm_card_visa_debit": "Visa debit success", 
  "pm_card_mastercard": "Mastercard success",
  "pm_card_amex": "American Express success",
  "pm_card_visa_chargeDispute": "Visa with chargeback",
  "pm_card_visa_debit_chargeDispute": "Visa debit with chargeback",
  "pm_card_chargeDeclined": "Always declined",
  "pm_card_chargeDeclinedInsufficientFunds": "Insufficient funds",
  "pm_card_chargeDeclinedLostCard": "Lost card",
  "pm_card_chargeDeclinedStolenCard": "Stolen card"
}
```

### **Test Examples**

**Successful Payment:**
```bash
curl -X POST http://localhost:3000/payment/test-card-payment \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "6833e0430eb8c318476e9103",
    "amount": 450.99,
    "currency": "USD",
    "testCard": "pm_card_visa"
  }'
```

**Declined Payment:**
```bash
curl -X POST http://localhost:3000/payment/test-card-payment \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "6833e0430eb8c318476e9103",
    "amount": 450.99,
    "currency": "USD",
    "testCard": "pm_card_chargeDeclined"
  }'
```

**Insufficient Funds:**
```bash
curl -X POST http://localhost:3000/payment/test-card-payment \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "6833e0430eb8c318476e9103",
    "amount": 450.99,
    "currency": "USD",
    "testCard": "pm_card_chargeDeclinedInsufficientFunds"
  }'
```


## 📋 **Complete Test Scenarios**

### **Test 1: Successful Payment Flow**
```bash
# 1. Create booking
curl -X POST http://localhost:3000/booking/book-flight \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... booking data ... }'

# 2. Test card payment
curl -X POST http://localhost:3000/payment/test-card-payment \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "BOOKING_ID_FROM_STEP_1",
    "amount": 450.99,
    "currency": "USD",
    "testCard": "pm_card_visa"
  }'

# 3. Verify payment status
curl -X GET http://localhost:3000/payment/status/BOOKING_ID_FROM_STEP_1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### **Test 2: Failed Payment Flow**
```bash
# Test with declined card
curl -X POST http://localhost:3000/payment/test-card-payment \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "BOOKING_ID",
    "amount": 450.99,
    "currency": "USD",
    "testCard": "pm_card_chargeDeclined"
  }'
```

### **Test 3: Amount Validation**
```bash
# Test with wrong amount
curl -X POST http://localhost:3000/payment/test-card-payment \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "BOOKING_ID",
    "amount": 999.99,
    "currency": "USD",
    "testCard": "pm_card_visa"
  }'
```

## 🔍 **Verification Steps**

### **Check Stripe Dashboard**
1. Go to https://dashboard.stripe.com/test/payments
2. Verify payment appears
3. Check payment status
4. Review metadata

### **Check Server Logs**
```bash
# Look for these log messages:
- "Payment intent created and confirmed"
- "Card payment test successful"
- "Failed to process card payment"
```

### **Check Database**
```bash
# Verify booking status updated
# Check payment fields populated
```

### **Check Webhooks**
```bash
# Go to Stripe Dashboard → Webhooks
# Verify events are being sent
# Check event delivery status
```

## 🎯 **Quick Test Commands**

### **Postman Collection Variables**
```json
{
  "baseUrl": "http://localhost:3000",
  "authToken": "YOUR_JWT_TOKEN",
  "bookingId": "YOUR_BOOKING_ID"
}
```

### **Postman Test Requests**
```javascript
// Test successful payment
pm.test("Payment successful", function () {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.true;
    pm.expect(response.data.paymentStatus).to.eql("completed");
});

// Test failed payment
pm.test("Payment declined", function () {
    pm.response.to.have.status(200);
    const response = pm.response.json();
    pm.expect(response.success).to.be.false;
});
```

## 🚨 **Troubleshooting**

### **Common Issues**
- **Invalid payment method**: Use correct `pm_card_*` format
- **Amount mismatch**: Ensure amount matches booking total
- **Invalid booking ID**: Check booking exists
- **Webhook not received**: Verify webhook URL and secret

### **Debug Commands**
```bash
# Check Stripe CLI version
stripe version

# Test webhook endpoint
stripe listen --forward-to localhost:3000/payment/webhook --print-json

# Validate webhook secret
stripe webhooks list
```

## ✅ **Success Criteria**

- [ ] Payment intent created successfully
- [ ] Payment confirmed with test card
- [ ] Booking status updated to "confirmed"
- [ ] Payment status updated to "completed"
- [ ] Webhook events received
- [ ] Stripe Dashboard shows payment
- [ ] Server logs show success messages

**You can now test complete payment flows without waiting for frontend!** 🎉
