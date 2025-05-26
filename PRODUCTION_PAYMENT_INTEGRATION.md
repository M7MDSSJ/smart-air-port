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

### **Complete Payment Flow**

```javascript
// 1. Initialize Stripe
import { loadStripe } from '@stripe/stripe-js';
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

// 2. Payment Function
const processPayment = async (bookingId, amount, cardElement) => {
  try {
    // Step 1: Create payment intent
    const response = await fetch(`${API_BASE_URL}/payment/create-payment-intent`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bookingId: bookingId,
        amount: amount,
        currency: 'USD'
      })
    });

    const { data } = await response.json();
    const { clientSecret, paymentIntentId } = data;

    // Step 2: Confirm payment with Stripe.js
    const stripe = await stripePromise;
    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: {
          name: 'Customer Name',
          email: 'customer@email.com'
        }
      }
    });

    // Step 3: Handle result
    if (error) {
      console.error('Payment failed:', error);
      return { success: false, error: error.message };
    }

    if (paymentIntent.status === 'succeeded') {
      // Step 4: Optional - Update booking status
      await fetch(`${API_BASE_URL}/payment/confirm-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentIntentId: paymentIntent.id,
          bookingId: bookingId
        })
      });

      return { success: true, paymentIntent };
    }

    return { success: false, error: 'Payment not completed' };

  } catch (error) {
    console.error('Payment error:', error);
    return { success: false, error: error.message };
  }
};
```

### **HTML Payment Form**
```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://js.stripe.com/v3/"></script>
</head>
<body>
  <form id="payment-form">
    <div id="card-element">
      <!-- Stripe Elements will create form elements here -->
    </div>
    <button id="submit-payment">Pay $450.99</button>
  </form>

  <script>
    const stripe = Stripe('pk_test_your_publishable_key');
    const elements = stripe.elements();
    const cardElement = elements.create('card');
    cardElement.mount('#card-element');

    document.getElementById('payment-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      
      // Use the processPayment function from above
      const result = await processPayment('booking_id', 450.99, cardElement);
      
      if (result.success) {
        window.location.href = '/success';
      } else {
        alert('Payment failed: ' + result.error);
      }
    });
  </script>
</body>
</html>
```

## 🔐 **Security Configuration**

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

### **Common Errors**
```javascript
// Handle these scenarios:
- Card declined
- Insufficient funds
- Network errors
- Invalid payment intent
- Webhook failures
```

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

## 🎯 **Production Checklist**

- [ ] Replace test keys with live keys
- [ ] Configure webhook endpoint
- [ ] Test with real cards (small amounts)
- [ ] Implement proper error handling
- [ ] Add payment logging
- [ ] Set up monitoring
- [ ] Configure HTTPS
- [ ] Test webhook delivery
- [ ] Implement refund functionality
- [ ] Add payment analytics

## 📱 **Mobile Integration**

### **React Native**
```bash
npm install @stripe/stripe-react-native
```

### **Flutter**
```yaml
dependencies:
  flutter_stripe: ^latest_version
```

## 🔄 **Webhook Events**

Your backend automatically handles:
- `payment_intent.succeeded` → Updates booking to confirmed
- `payment_intent.payment_failed` → Updates payment status to failed

## 📞 **Support**

- **Stripe Documentation**: https://stripe.com/docs
- **Test Cards**: https://stripe.com/docs/testing
- **Webhook Testing**: https://stripe.com/docs/webhooks/test
