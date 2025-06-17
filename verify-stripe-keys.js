#!/usr/bin/env node

/**
 * Stripe Keys Verification Script
 * Verifies that both frontend and backend are using the correct Stripe keys
 */

const fs = require('fs');
const axios = require('axios');

// Your actual Stripe keys from dashboard
const DASHBOARD_KEYS = {
  publishable: 'pk_test_51QuhXLPxWTngOvfGxTBKxBNfg2txQhECzNMyQ79JRy8sT4ENhZvPHxo9qhZcM5zHVbkglSZ3OSyeUqF45dXor7dS00gXl5RobY',
  secret: 'sk_test_51QuhXLPxWTngOvfGXZbJu1JaO6Sy4TNWlltwIHUj339qKiQNji8wKDVICr2wdkBKTSqU1Ph4RX32m3F1CLIUHpVO00wGIMj605'
};

const API_BASE_URL = 'https://sky-shifters.duckdns.org';

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

async function verifyStripeKeys() {
  log('='.repeat(60), 'cyan');
  log('STRIPE KEYS VERIFICATION', 'cyan');
  log('='.repeat(60), 'cyan');
  
  log('\n📋 Your Dashboard Keys:', 'white');
  log(`Publishable: ${DASHBOARD_KEYS.publishable}`, 'white');
  log(`Secret:      ${DASHBOARD_KEYS.secret}`, 'white');
  
  // Check frontend .env
  log('\n🎨 Frontend Configuration:', 'blue');
  try {
    const frontendEnvPath = '../Sky-Shifters/.env';
    const frontendEnv = fs.readFileSync(frontendEnvPath, 'utf8');
    const frontendKey = frontendEnv.match(/VITE_STRIPE_PUBLISHABLE_KEY=(.*)/)?.[1];
    
    log(`File: ${frontendEnvPath}`, 'white');
    log(`Key:  ${frontendKey}`, 'white');
    
    if (frontendKey === DASHBOARD_KEYS.publishable) {
      logSuccess('Frontend publishable key matches dashboard');
    } else {
      logError('Frontend publishable key does NOT match dashboard');
      log(`Expected: ${DASHBOARD_KEYS.publishable}`, 'red');
      log(`Found:    ${frontendKey}`, 'red');
    }
  } catch (error) {
    logError(`Failed to read frontend .env: ${error.message}`);
  }
  
  // Check backend .env
  log('\n🔧 Backend Configuration:', 'blue');
  try {
    const backendEnvPath = '.env';
    const backendEnv = fs.readFileSync(backendEnvPath, 'utf8');
    const backendSecret = backendEnv.match(/STRIPE_SECRET_KEY=(.*)/)?.[1];
    const backendPublic = backendEnv.match(/STRIPE_PUBLIC_KEY=(.*)/)?.[1];
    
    log(`File: ${backendEnvPath}`, 'white');
    log(`Secret Key:      ${backendSecret}`, 'white');
    log(`Publishable Key: ${backendPublic}`, 'white');
    
    if (backendSecret === DASHBOARD_KEYS.secret) {
      logSuccess('Backend secret key matches dashboard');
    } else {
      logError('Backend secret key does NOT match dashboard');
      log(`Expected: ${DASHBOARD_KEYS.secret}`, 'red');
      log(`Found:    ${backendSecret}`, 'red');
    }
    
    if (backendPublic === DASHBOARD_KEYS.publishable) {
      logSuccess('Backend publishable key matches dashboard');
    } else {
      logError('Backend publishable key does NOT match dashboard');
      log(`Expected: ${DASHBOARD_KEYS.publishable}`, 'red');
      log(`Found:    ${backendPublic}`, 'red');
    }
  } catch (error) {
    logError(`Failed to read backend .env: ${error.message}`);
  }
  
  // Check production backend
  log('\n🌐 Production Backend Check:', 'blue');
  try {
    const response = await axios.get(`${API_BASE_URL}/payment/stripe/config`);
    
    if (response.data.success) {
      const prodPublicKey = response.data.data.publicKey;
      const prodSecretPrefix = response.data.data.secretKeyPrefix;
      const keysMatch = response.data.data.keysMatch;
      
      log(`Production URL: ${API_BASE_URL}`, 'white');
      log(`Publishable Key: ${prodPublicKey}`, 'white');
      log(`Secret Key Prefix: ${prodSecretPrefix}`, 'white');
      log(`Keys Match: ${keysMatch}`, 'white');
      
      if (prodPublicKey === DASHBOARD_KEYS.publishable) {
        logSuccess('Production publishable key matches dashboard');
      } else {
        logError('Production publishable key does NOT match dashboard');
        log(`Expected: ${DASHBOARD_KEYS.publishable}`, 'red');
        log(`Found:    ${prodPublicKey}`, 'red');
      }
      
      // Check if secret key prefix matches
      const expectedSecretPrefix = DASHBOARD_KEYS.secret.substring(0, 12) + '...';
      if (prodSecretPrefix === expectedSecretPrefix) {
        logSuccess('Production secret key prefix matches dashboard');
      } else {
        logWarning('Production secret key prefix might not match dashboard');
        log(`Expected: ${expectedSecretPrefix}`, 'yellow');
        log(`Found:    ${prodSecretPrefix}`, 'yellow');
      }
      
      if (keysMatch) {
        logSuccess('Production reports keys match');
      } else {
        logWarning('Production reports keys do NOT match');
      }
    } else {
      logError('Failed to get production Stripe config');
    }
  } catch (error) {
    logError(`Failed to check production backend: ${error.message}`);
  }
  
  // Summary
  log('\n📊 Summary:', 'cyan');
  log('If all checks show ✅, your Stripe integration is correctly configured.', 'white');
  log('If any checks show ❌, you need to update the corresponding .env file.', 'white');
  log('If production shows ⚠️, you may need to restart your backend service.', 'white');
  
  log('\n🚀 Next Steps:', 'cyan');
  log('1. If local .env files are correct, deploy them to production', 'white');
  log('2. Restart your backend service if needed', 'white');
  log('3. Test payment flow using the test HTML file', 'white');
  log('4. Use test card: 4242424242424242 for testing', 'white');
}

// Run verification
verifyStripeKeys().catch(error => {
  logError(`Verification failed: ${error.message}`);
  process.exit(1);
});
