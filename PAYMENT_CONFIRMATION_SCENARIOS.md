# Payment Confirmation Scenarios

## 🎯 **Overview**

The payment confirmation endpoint now handles multiple scenarios intelligently, including when payments are already completed.

## 📋 **Test Scenarios**

### **Scenario 1: First Time Payment Confirmation**

**Steps:**
1. Create booking
2. Use test card payment endpoint
3. Call confirm payment endpoint

**Expected Response:**
```json
{
  "success": true,
  "message": "Payment confirmed successfully.",
  "data": {
    "success": true,
    "paymentStatus": "completed",
    "bookingStatus": "confirmed",
    "stripeStatus": "succeeded",
    "booking": { ... },
    "message": "Payment confirmed successfully.",
    "alreadyCompleted": false
  }
}
```

### **Scenario 2: Payment Already Completed**

**Steps:**
1. Use same booking from Scenario 1
2. Call confirm payment endpoint again

**Expected Response:**
```json
{
  "success": true,
  "message": "Payment was already completed. No action needed.",
  "data": {
    "success": true,
    "paymentStatus": "completed",
    "bookingStatus": "confirmed",
    "stripeStatus": "succeeded",
    "booking": { ... },
    "message": "Payment was already completed. No action needed.",
    "alreadyCompleted": true
  }
}
```

### **Scenario 3: Payment Requires Payment Method**

**Steps:**
1. Create payment intent only (don't use test card endpoint)
2. Call confirm payment endpoint

**Expected Response:**
```json
{
  "success": false,
  "message": "Payment requires payment method. Use Stripe.js on frontend to complete payment.",
  "data": {
    "success": false,
    "paymentStatus": "requires_payment_method",
    "stripeStatus": "requires_payment_method",
    "message": "Payment requires payment method. Use Stripe.js on frontend to complete payment.",
    "clientSecret": "pi_xxx_secret_xxx"
  }
}
```

## 🧪 **Complete Test Flow**

### **Test 1: Normal Payment Flow**

```bash
# 1. Login
POST http://localhost:3000/users/login
{
  "email": "your-email@example.com",
  "password": "your-password"
}

# 2. Create Booking
POST http://localhost:3000/booking/book-flight
Authorization: Bearer {JWT_TOKEN}
{
  "flightID": "F9123",
  "totalPrice": 450.99,
  // ... other booking data
}

# 3. Test Card Payment
POST http://localhost:3000/payment/test-card-payment
Authorization: Bearer {JWT_TOKEN}
{
  "bookingId": "{BOOKING_ID}",
  "amount": 450.99,
  "currency": "USD",
  "testCard": "pm_card_visa"
}

# 4. Confirm Payment (First Time)
POST http://localhost:3000/payment/confirm-payment
Authorization: Bearer {JWT_TOKEN}
{
  "paymentIntentId": "{PAYMENT_INTENT_ID}",
  "bookingId": "{BOOKING_ID}"
}
# Expected: "Payment confirmed successfully."

# 5. Confirm Payment (Second Time)
POST http://localhost:3000/payment/confirm-payment
Authorization: Bearer {JWT_TOKEN}
{
  "paymentIntentId": "{PAYMENT_INTENT_ID}",
  "bookingId": "{BOOKING_ID}"
}
# Expected: "Payment was already completed. No action needed."
```

### **Test 2: Payment Intent Without Card**

```bash
# 1. Create Payment Intent Only
POST http://localhost:3000/payment/create-payment-intent
Authorization: Bearer {JWT_TOKEN}
{
  "bookingId": "{BOOKING_ID}",
  "amount": 450.99,
  "currency": "USD"
}

# 2. Try to Confirm (Should Fail)
POST http://localhost:3000/payment/confirm-payment
Authorization: Bearer {JWT_TOKEN}
{
  "paymentIntentId": "{PAYMENT_INTENT_ID}",
  "bookingId": "{BOOKING_ID}"
}
# Expected: "Payment requires payment method. Use Stripe.js on frontend to complete payment."
```

## 📊 **Response Field Explanations**

### **New Fields Added:**

- **`message`**: Descriptive message about the payment status
- **`alreadyCompleted`**: Boolean indicating if payment was already processed
- **`clientSecret`**: Provided when payment requires frontend completion

### **Message Types:**

1. **"Payment confirmed successfully."** - First time confirmation
2. **"Payment was already completed. No action needed."** - Duplicate confirmation
3. **"Payment requires payment method. Use Stripe.js on frontend to complete payment."** - Needs frontend
4. **"Payment not completed. Status: {status}"** - Other payment statuses

## 🔧 **Frontend Integration**

### **Handling Different Responses:**

```javascript
const confirmPayment = async (paymentIntentId, bookingId) => {
  try {
    const response = await fetch('/payment/confirm-payment', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ paymentIntentId, bookingId })
    });

    const result = await response.json();

    if (result.success) {
      if (result.data.alreadyCompleted) {
        // Payment was already completed
        showMessage(result.message, 'info');
        redirectToSuccess();
      } else {
        // Payment just confirmed
        showMessage(result.message, 'success');
        redirectToSuccess();
      }
    } else {
      if (result.data.paymentStatus === 'requires_payment_method') {
        // Need to use Stripe.js
        const clientSecret = result.data.clientSecret;
        await handleStripePayment(clientSecret);
      } else {
        // Other error
        showMessage(result.message, 'error');
      }
    }
  } catch (error) {
    showMessage('Payment confirmation failed', 'error');
  }
};
```

## 🎯 **Postman Test Collection**

```json
{
  "name": "Payment Confirmation Scenarios",
  "item": [
    {
      "name": "Test Already Completed Payment",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{authToken}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"paymentIntentId\": \"{{paymentIntentId}}\",\n  \"bookingId\": \"{{bookingId}}\"\n}",
          "options": {
            "raw": {
              "language": "json"
            }
          }
        },
        "url": {
          "raw": "{{baseUrl}}/payment/confirm-payment",
          "host": ["{{baseUrl}}"],
          "path": ["payment", "confirm-payment"]
        }
      },
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "pm.test('Payment confirmation response', function () {",
              "    const response = pm.response.json();",
              "    pm.expect(response.success).to.be.true;",
              "    pm.expect(response.message).to.include('Payment');",
              "    ",
              "    if (response.data.alreadyCompleted) {",
              "        pm.expect(response.message).to.include('already completed');",
              "    } else {",
              "        pm.expect(response.message).to.include('confirmed successfully');",
              "    }",
              "});"
            ]
          }
        }
      ]
    }
  ]
}
```

## ✅ **Testing Checklist**

- [ ] First payment confirmation returns success with `alreadyCompleted: false`
- [ ] Second payment confirmation returns success with `alreadyCompleted: true`
- [ ] Appropriate messages returned for each scenario
- [ ] Payment intent without card returns requires_payment_method
- [ ] Client secret provided when payment method needed
- [ ] Booking status remains consistent
- [ ] Server logs show appropriate messages

## 🚨 **Error Handling**

### **Common Scenarios:**

1. **Invalid Payment Intent ID**: Returns 404 or invalid payment intent error
2. **Invalid Booking ID**: Returns "Booking not found"
3. **Network Issues**: Returns connection error
4. **Stripe API Issues**: Returns Stripe-specific error

### **Graceful Degradation:**

- Always check `result.success` first
- Use `result.message` for user-friendly messages
- Check `result.data.alreadyCompleted` to avoid duplicate processing
- Use `result.data.clientSecret` for frontend payment completion

## 🎉 **Benefits**

✅ **Prevents Duplicate Processing** - Detects already completed payments
✅ **Clear User Messages** - Descriptive messages for each scenario  
✅ **Frontend Guidance** - Tells frontend what to do next
✅ **Idempotent Operations** - Safe to call multiple times
✅ **Better UX** - Users get appropriate feedback

**The payment confirmation endpoint is now robust and handles all edge cases!** 🚀
