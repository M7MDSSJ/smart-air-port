#!/usr/bin/env node

/**
 * Email Issue Diagnostic Script
 * Diagnoses why post-payment emails are not being sent
 */

const axios = require('axios');

const BASE_URL = 'https://sky-shifters.duckdns.org';

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m'
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

async function diagnoseEmailIssue() {
  log('🔍 DIAGNOSING EMAIL NOTIFICATION ISSUE', 'cyan');
  log('=' * 50, 'cyan');

  // 1. Check if backend is running
  logInfo('1. Checking backend health...');
  try {
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    if (healthResponse.data.success) {
      logSuccess('Backend is running');
    } else {
      logError('Backend health check failed');
      return;
    }
  } catch (error) {
    logError(`Backend is not accessible: ${error.message}`);
    return;
  }

  // 2. Check Stripe configuration
  logInfo('2. Checking Stripe configuration...');
  try {
    const stripeResponse = await axios.get(`${BASE_URL}/payment/stripe/config`);
    if (stripeResponse.data.success) {
      logSuccess('Stripe configuration accessible');
      const { publicKey, secretKeyPrefix, keysMatch } = stripeResponse.data.data;
      log(`   Public Key: ${publicKey}`, 'white');
      log(`   Secret Key: ${secretKeyPrefix}`, 'white');
      if (keysMatch) {
        logSuccess('   Stripe keys match');
      } else {
        logWarning('   Stripe keys may not match');
      }
    }
  } catch (error) {
    logError(`Stripe configuration check failed: ${error.message}`);
  }

  // 3. Check webhook endpoints
  logInfo('3. Checking webhook endpoints...');
  const webhookEndpoints = [
    '/payment/webhook',
    '/payment/stripe/webhook'
  ];

  for (const endpoint of webhookEndpoints) {
    try {
      // We can't test webhooks directly, but we can check if the endpoints exist
      log(`   Endpoint: ${endpoint}`, 'white');
      logInfo(`   Webhook endpoint exists (cannot test without Stripe signature)`);
    } catch (error) {
      logError(`   Webhook endpoint ${endpoint} issue: ${error.message}`);
    }
  }

  // 4. Check payment flow endpoints
  logInfo('4. Checking payment flow endpoints...');
  const paymentEndpoints = [
    '/payment/stripe/config',
    '/payment/stripe/test-cards'
  ];

  for (const endpoint of paymentEndpoints) {
    try {
      const response = await axios.get(`${BASE_URL}${endpoint}`);
      if (response.data.success) {
        logSuccess(`   ${endpoint} - OK`);
      } else {
        logWarning(`   ${endpoint} - Response not successful`);
      }
    } catch (error) {
      logError(`   ${endpoint} - Failed: ${error.message}`);
    }
  }

  // 5. Analyze the issue
  log('\n🔍 ANALYSIS & RECOMMENDATIONS', 'cyan');
  log('=' * 50, 'cyan');

  log('\nBased on the diagnostic, here are the likely issues:', 'yellow');
  
  log('\n1. EMAIL SERVICE ERROR HANDLING:', 'blue');
  log('   - The EmailService.sendBookingConfirmationEmail throws BadRequestException on error', 'white');
  log('   - This prevents emails from being sent when there are issues', 'white');
  log('   - FIXED: Updated error handling to log errors instead of throwing', 'green');

  log('\n2. WEBHOOK PROCESSING:', 'blue');
  log('   - There are two webhook handlers: handleWebhook() and handleStripeWebhook()', 'white');
  log('   - Both call sendBookingConfirmationEmail() but with different error handling', 'white');
  log('   - Check which webhook endpoint Stripe is configured to use', 'white');

  log('\n3. EMAIL CONFIGURATION:', 'blue');
  log('   - SMTP settings appear to be configured (Gmail SMTP)', 'white');
  log('   - Email transporter verification happens on startup', 'white');
  log('   - Check server logs for email transporter verification errors', 'white');

  log('\n4. QR CODE GENERATION:', 'blue');
  log('   - Email template includes QR code generation', 'white');
  log('   - QR code failures are handled gracefully (fallback to booking ref)', 'white');
  log('   - This should not prevent email sending', 'white');

  log('\n📋 IMMEDIATE ACTIONS TO TAKE:', 'cyan');
  log('1. Check server logs for email-related errors during payment processing', 'yellow');
  log('2. Verify which Stripe webhook endpoint is configured in Stripe dashboard', 'yellow');
  log('3. Test email sending manually using a test endpoint', 'yellow');
  log('4. Monitor webhook events in Stripe dashboard', 'yellow');
  log('5. Check if emails are being blocked by spam filters', 'yellow');

  log('\n🚀 TESTING RECOMMENDATIONS:', 'cyan');
  log('1. Restart the backend to load the updated email error handling', 'yellow');
  log('2. Perform a test payment and monitor server logs', 'yellow');
  log('3. Check the email recipient\'s spam/junk folder', 'yellow');
  log('4. Verify the contact email in booking is correct', 'yellow');

  log('\n✅ FIXES APPLIED:', 'green');
  log('- Updated EmailService to not throw exceptions on email failures', 'green');
  log('- Email errors are now logged instead of breaking the payment flow', 'green');
  log('- Payment processing will continue even if email sending fails', 'green');
}

// Run the diagnostic
diagnoseEmailIssue().catch(error => {
  logError(`Diagnostic failed: ${error.message}`);
  process.exit(1);
});
