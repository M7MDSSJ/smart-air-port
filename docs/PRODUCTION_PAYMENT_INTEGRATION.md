# Production Payment Integration Guide

## 🚀 **Overview**

This guide covers the complete production-ready Stripe payment integration for your Smart Airport booking system.

## 🔧 **Backend API Endpoints**

### **1. Create Payment Intent**
```
POST /payment/create-payment-intent
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

Request:
{
  "bookingId": "string",
  "amount": number,
  "currency": "USD"
}

Response:
{
  "success": true,
  "data": {
    "paymentIntentId": "pi_xxx",
    "clientSecret": "pi_xxx_secret_xxx",
    "status": "requires_payment_method",
    "amount": 450.99,
    "currency": "usd"
  }
}
```

### **2. Confirm Payment (Optional)**
```
POST /payment/confirm-payment
Authorization: Bearer {JWT_TOKEN}

Request:
{
  "paymentIntentId": "pi_xxx",
  "bookingId": "booking_id"
}

Response (if payment already succeeded):
{
  "success": true,
  "data": {
    "paymentStatus": "completed",
    "bookingStatus": "confirmed",
    "booking": { ... }
  }
}

Response (if payment not completed):
{
  "success": false,
  "data": {
    "paymentStatus": "requires_payment_method",
    "message": "Payment requires payment method. Use Stripe.js on frontend to complete payment.",
    "clientSecret": "pi_xxx_secret_xxx"
  }
}
```

### **3. Payment Status**
```
GET /payment/status/{bookingId}
Authorization: Bearer {JWT_TOKEN}

Response:
{
  "success": true,
  "data": {
    "paymentStatus": "completed|pending|failed",
    "bookingStatus": "confirmed|pending",
    "stripeStatus": "succeeded|requires_payment_method"
  }
}
```

### **4. Webhook Handler**
```
POST /payment/webhook
Stripe-Signature: {webhook_signature}

Handles Stripe events:
- payment_intent.succeeded
- payment_intent.payment_failed
```

## 🌐 **Frontend Integration**

### **Required Dependencies**
```bash
npm install @stripe/stripe-js
```

### **Environment Variables**
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```


### **Environment Variables (Backend)**
```env
STRIPE_SECRET_KEY=sk_live_your_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

### **Webhook Setup**
1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://yourdomain.com/payment/webhook`
3. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
4. Copy webhook secret to environment variables

## 📊 **Payment Flow Diagram**

```
Frontend                Backend                 Stripe
   |                       |                      |
   |-- Create Intent ----->|                      |
   |                       |-- Create Intent --->|
   |                       |<-- Client Secret ---|
   |<-- Client Secret -----|                      |
   |                       |                      |
   |-- Confirm Payment --->|                      |
   |   (with card data)    |                      |
   |<-- Payment Result ----|                      |
   |                       |                      |
   |                       |<-- Webhook Event ----|
   |                       |                      |
   |-- Optional: Confirm ->|                      |
   |<-- Booking Updated ---|                      |
```

## ✅ **Testing**

### **Test Cards**
```
Success: 4242424242424242
Decline: 4000000000000002
Insufficient Funds: 4000000000009995
```

### **Test Flow**
1. Create booking
2. Create payment intent
3. Use Stripe.js to confirm payment with test card
4. Verify booking status updated
5. Check webhook events in Stripe Dashboard

## 🚨 **Error Handling**



### **Error Response Format**
```json
{
  "success": false,
  "message": "Error description",
  "data": {
    "error_code": "card_declined",
    "error_message": "Your card was declined."
  }
}
```


## 📱 **Mobile Integration**

### **Flutter**
```yaml
dependencies:
  flutter_stripe: ^latest_version
```

## 🔄 **Webhook Events**

Your backend automatically handles:
- `payment_intent.succeeded` → Updates booking to confirmed
- `payment_intent.payment_failed` → Updates payment status to failed
