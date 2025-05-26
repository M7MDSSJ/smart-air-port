# Production Payment Testing Guide

## 🧪 **Quick Test Setup**

### **1. Test the Backend API**

**Create Payment Intent:**
```bash
curl -X POST http://localhost:3000/payment/create-payment-intent \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "your_booking_id",
    "amount": 450.99,
    "currency": "USD"
  }'
```

**Expected Response:**
```json
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

### **2. Test Payment Confirmation (Should Fail)**

```bash
curl -X POST http://localhost:3000/payment/confirm-payment \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentIntentId": "pi_xxx",
    "bookingId": "your_booking_id"
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "data": {
    "paymentStatus": "requires_payment_method",
    "message": "Payment requires payment method. Use Stripe.js on frontend to complete payment.",
    "clientSecret": "pi_xxx_secret_xxx"
  }
}
```

## 🌐 **Frontend Test Page**

Create a simple HTML file to test the complete flow:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Payment Test</title>
    <script src="https://js.stripe.com/v3/"></script>
    <style>
        body { font-family: Arial, sans-serif; max-width: 500px; margin: 50px auto; }
        #card-element { padding: 10px; border: 1px solid #ccc; border-radius: 4px; }
        button { width: 100%; padding: 15px; background: #007bff; color: white; border: none; border-radius: 4px; margin-top: 20px; }
        .error { color: red; margin-top: 10px; }
        .success { color: green; margin-top: 10px; }
    </style>
</head>
<body>
    <h2>Payment Test</h2>
    
    <div>
        <label>Booking ID:</label>
        <input type="text" id="bookingId" placeholder="Enter booking ID" style="width: 100%; padding: 10px; margin: 10px 0;">
    </div>
    
    <div>
        <label>Amount:</label>
        <input type="number" id="amount" value="450.99" style="width: 100%; padding: 10px; margin: 10px 0;">
    </div>
    
    <div>
        <label>JWT Token:</label>
        <input type="text" id="jwtToken" placeholder="Enter JWT token" style="width: 100%; padding: 10px; margin: 10px 0;">
    </div>
    
    <form id="payment-form">
        <div id="card-element"></div>
        <button type="submit" id="submit-payment">Pay Now</button>
    </form>
    
    <div id="messages"></div>

    <script>
        // Initialize Stripe
        const stripe = Stripe('pk_test_51QuhXLPxWTngOvfGXZbJu1JaO6Sy4TNWlltwIHUj339qKiQNji8wKDVICr2wdkBKTSqU1Ph4RX32m3F1CLIUHpVO00wGIMj605');
        const elements = stripe.elements();
        const cardElement = elements.create('card');
        cardElement.mount('#card-element');

        const form = document.getElementById('payment-form');
        const messages = document.getElementById('messages');

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            const bookingId = document.getElementById('bookingId').value;
            const amount = parseFloat(document.getElementById('amount').value);
            const jwtToken = document.getElementById('jwtToken').value;
            
            if (!bookingId || !amount || !jwtToken) {
                showMessage('Please fill in all fields', 'error');
                return;
            }

            showMessage('Processing payment...', 'info');

            try {
                // Step 1: Create payment intent
                const response = await fetch('http://localhost:3000/payment/create-payment-intent', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${jwtToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        bookingId: bookingId,
                        amount: amount,
                        currency: 'USD'
                    })
                });

                const result = await response.json();
                
                if (!result.success) {
                    showMessage(`Error: ${result.message}`, 'error');
                    return;
                }

                const { clientSecret } = result.data;

                // Step 2: Confirm payment with Stripe
                const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
                    payment_method: {
                        card: cardElement,
                        billing_details: {
                            name: 'Test Customer'
                        }
                    }
                });

                if (error) {
                    showMessage(`Payment failed: ${error.message}`, 'error');
                    return;
                }

                if (paymentIntent.status === 'succeeded') {
                    showMessage('Payment succeeded!', 'success');
                    
                    // Step 3: Confirm with backend
                    const confirmResponse = await fetch('http://localhost:3000/payment/confirm-payment', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${jwtToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            paymentIntentId: paymentIntent.id,
                            bookingId: bookingId
                        })
                    });

                    const confirmResult = await confirmResponse.json();
                    
                    if (confirmResult.success) {
                        showMessage('Booking confirmed successfully!', 'success');
                    } else {
                        showMessage('Payment succeeded but booking confirmation failed', 'error');
                    }
                } else {
                    showMessage(`Payment status: ${paymentIntent.status}`, 'error');
                }

            } catch (error) {
                showMessage(`Error: ${error.message}`, 'error');
            }
        });

        function showMessage(message, type) {
            messages.innerHTML = `<div class="${type}">${message}</div>`;
        }
    </script>
</body>
</html>
```

## 🧪 **Test Scenarios**

### **1. Successful Payment**
- Use test card: `4242424242424242`
- Expiry: Any future date
- CVC: Any 3 digits
- Expected: Payment succeeds, booking confirmed

### **2. Declined Payment**
- Use test card: `4000000000000002`
- Expected: Payment fails with decline message

### **3. Insufficient Funds**
- Use test card: `4000000000009995`
- Expected: Payment fails with insufficient funds

### **4. Invalid Data**
- Use invalid booking ID
- Expected: Error from backend

### **5. Unauthorized Access**
- Use invalid JWT token
- Expected: 401 Unauthorized

## 📊 **Test Results Checklist**

- [ ] Payment intent created successfully
- [ ] Client secret returned
- [ ] Stripe.js loads correctly
- [ ] Card element displays
- [ ] Payment confirmation works
- [ ] Booking status updates
- [ ] Error handling works
- [ ] Webhook events received (check Stripe Dashboard)

## 🔧 **Debugging Tips**

### **Check Browser Console**
- Look for JavaScript errors
- Verify API responses
- Check network requests

### **Check Server Logs**
- Payment intent creation logs
- Payment confirmation logs
- Error messages

### **Check Stripe Dashboard**
- Payment intents created
- Payment status
- Webhook events

## 🚀 **Production Deployment**

### **Before Going Live:**
1. Replace test keys with live keys
2. Test with real cards (small amounts)
3. Configure production webhook URL
4. Enable HTTPS
5. Test webhook delivery
6. Monitor error rates

### **Live Testing:**
1. Use real credit cards
2. Test small amounts first ($1-5)
3. Verify webhook delivery
4. Check payment appears in Stripe Dashboard
5. Confirm booking updates correctly

## 📞 **Troubleshooting**

### **Common Issues:**
- **CORS errors**: Configure CORS in backend
- **Invalid publishable key**: Check environment variables
- **Webhook not received**: Verify webhook URL and secret
- **Payment fails**: Check card details and Stripe logs

### **Support Resources:**
- Stripe Dashboard: https://dashboard.stripe.com
- Stripe Logs: Check Events tab
- Network tab in browser dev tools
- Server logs for backend errors
