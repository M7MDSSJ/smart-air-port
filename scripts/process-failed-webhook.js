#!/usr/bin/env node

/**
 * Webhook Recovery Script
 * 
 * This script helps process failed Stripe webhooks manually.
 * Usage: node scripts/process-failed-webhook.js <payment_intent_id> <booking_id>
 * 
 * Example: node scripts/process-failed-webhook.js pi_3RbU5CPxWTngOvfG2EzVk5Ef 685337c54644432bdeea2c44
 */

const https = require('https');

// Configuration
const API_BASE_URL = process.env.API_URL || 'https://sky-shifters.duckdns.org';
const DEBUG_ENDPOINT = '/payment/debug/force-process-webhook';

function processWebhook(paymentIntentId, bookingId, bookingRef, amount = null) {
  const webhookData = {
    id: `evt_${Date.now()}_manual`,
    object: "event",
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: paymentIntentId,
        object: "payment_intent",
        amount: amount ? Math.round(amount * 100) : 19124, // Default to $191.24 in cents if not provided
        currency: "usd",
        status: "succeeded",
        metadata: {
          bookingId: bookingId,
          bookingRef: bookingRef || `MANUAL_${Date.now()}`
        }
      }
    }
  };

  const postData = JSON.stringify(webhookData);
  
  const options = {
    hostname: 'sky-shifters.duckdns.org',
    port: 443,
    path: DEBUG_ENDPOINT,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  console.log('🔄 Processing failed webhook...');
  console.log(`📋 Payment Intent: ${paymentIntentId}`);
  console.log(`📋 Booking ID: ${bookingId}`);
  console.log(`📋 Booking Ref: ${bookingRef || 'AUTO-GENERATED'}`);
  console.log('');

  const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        
        if (res.statusCode === 200 && response.success) {
          console.log('✅ SUCCESS: Webhook processed successfully!');
          console.log(`📧 Email sent: ${response.data?.emailSent || 'Unknown'}`);
          console.log(`💾 Payment record created: ${response.data?.paymentCreated || 'Unknown'}`);
          console.log(`📋 Booking status: ${response.data?.bookingStatus || 'Unknown'}`);
        } else {
          console.log('❌ FAILED: Webhook processing failed');
          console.log(`Status: ${res.statusCode}`);
          console.log(`Response:`, response);
        }
      } catch (error) {
        console.log('❌ ERROR: Failed to parse response');
        console.log(`Status: ${res.statusCode}`);
        console.log(`Raw response: ${data}`);
      }
    });
  });

  req.on('error', (error) => {
    console.log('❌ REQUEST ERROR:', error.message);
  });

  req.write(postData);
  req.end();
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('❌ Usage: node scripts/process-failed-webhook.js <payment_intent_id> <booking_id> [booking_ref] [amount]');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/process-failed-webhook.js pi_3RbU5CPxWTngOvfG2EzVk5Ef 685337c54644432bdeea2c44');
    console.log('  node scripts/process-failed-webhook.js pi_3RbU5CPxWTngOvfG2EzVk5Ef 685337c54644432bdeea2c44 GA938571');
    console.log('  node scripts/process-failed-webhook.js pi_3RbU5CPxWTngOvfG2EzVk5Ef 685337c54644432bdeea2c44 GA938571 191.24');
    console.log('');
    console.log('💡 You can find these values in your server logs when a payment succeeds but webhook fails.');
    process.exit(1);
  }

  const [paymentIntentId, bookingId, bookingRef, amount] = args;

  // Validate payment intent ID format
  if (!paymentIntentId.startsWith('pi_')) {
    console.log('❌ Invalid payment intent ID format. Should start with "pi_"');
    process.exit(1);
  }

  // Validate booking ID format (MongoDB ObjectId)
  if (!/^[0-9a-fA-F]{24}$/.test(bookingId)) {
    console.log('❌ Invalid booking ID format. Should be a 24-character MongoDB ObjectId');
    process.exit(1);
  }

  console.log('🚀 Smart Airport - Webhook Recovery Tool');
  console.log('==========================================');
  
  processWebhook(paymentIntentId, bookingId, bookingRef, amount ? parseFloat(amount) : null);
}

// Handle script execution
if (require.main === module) {
  main();
}

module.exports = { processWebhook };
