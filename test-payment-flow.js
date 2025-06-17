#!/usr/bin/env node

/**
 * End-to-End Payment Flow Test
 * Tests the complete payment flow from booking creation to payment completion
 */

const axios = require('axios');
const fs = require('fs');

// Configuration
const BASE_URL = process.env.API_BASE_URL || 'https://sky-shifters.duckdns.org';

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
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

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

class PaymentFlowTester {
  constructor() {
    this.authToken = null;
    this.userId = null;
    this.bookingId = null;
    this.testResults = [];
  }

  async runTest(testName, testFunction) {
    try {
      logInfo(`Running: ${testName}`);
      const result = await testFunction();
      this.testResults.push({ name: testName, status: 'PASSED', result });
      logSuccess(`${testName} - PASSED`);
      return result;
    } catch (error) {
      this.testResults.push({ 
        name: testName, 
        status: 'FAILED', 
        error: error.message,
        details: error.response?.data || error.stack
      });
      logError(`${testName} - FAILED: ${error.message}`);
      throw error;
    }
  }

  async testStripeConfiguration() {
    return this.runTest('Stripe Configuration Check', async () => {
      const response = await axios.get(`${BASE_URL}/payment/stripe/config`);
      
      if (!response.data.success) {
        throw new Error('Failed to get Stripe configuration');
      }

      const { publicKey, secretKeyPrefix, keysMatch } = response.data.data;
      
      if (!publicKey) {
        throw new Error('Stripe public key not configured');
      }

      if (!publicKey.startsWith('pk_test_') && !publicKey.startsWith('pk_live_')) {
        throw new Error(`Invalid public key format: ${publicKey.substring(0, 20)}...`);
      }

      if (!keysMatch) {
        logWarning('Stripe keys may not match - this could cause payment failures');
        logWarning(`Frontend should use: ${publicKey}`);
      }

      return {
        publicKey: publicKey.substring(0, 30) + '...',
        secretKeyPrefix,
        keysMatch,
        keyType: publicKey.startsWith('pk_test_') ? 'test' : 'live'
      };
    });
  }

  async authenticateTestUser() {
    return this.runTest('User Authentication', async () => {
      const testEmail = 'gtrealex7@gmail.com';
      const testPassword = 'Password123!@';

      // Login with existing verified user
      const loginResponse = await axios.post(`${BASE_URL}/users/login`, {
        email: testEmail,
        password: testPassword
      });

      if (!loginResponse.data.success || !loginResponse.data.data.accessToken) {
        throw new Error('Failed to authenticate test user');
      }

      this.authToken = loginResponse.data.data.accessToken;
      this.userId = 'existing-user-id'; // We'll get this from the JWT payload

      return {
        userId: this.userId,
        email: testEmail,
        authenticated: true
      };
    });
  }

  async createTestBooking() {
    return this.runTest('Create Test Booking', async () => {
      if (!this.authToken) {
        throw new Error('Not authenticated');
      }

      // Create a test booking using the correct format
      const bookingData = {
        flightID: 'TEST-FLIGHT-' + Date.now(),
        originAirportCode: 'JFK',
        destinationAirportCode: 'LAX',
        originCIty: 'New York',
        destinationCIty: 'Los Angeles',
        departureDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
        arrivalDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0],
        selectedBaggageOption: {
          type: 'carry-on',
          weight: '7kg',
          price: 0,
          currency: 'USD'
        },
        totalPrice: 299.99,
        currency: 'USD',
        travellersInfo: [{
          firstName: 'Test',
          lastName: 'Passenger',
          birthDate: '1990-01-01',
          travelerType: 'adult',
          nationality: 'US',
          passportNumber: 'A12345678',
          issuingCountry: 'US',
          expiryDate: '2030-01-01'
        }],
        contactDetails: {
          email: 'gtrealex7@gmail.com',
          phone: '+201234567890'
        }
      };

      const response = await axios.post(`${BASE_URL}/booking/book-flight`, bookingData, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      if (!response.data.success) {
        throw new Error('Failed to create test booking');
      }

      this.bookingId = response.data.data.bookingId;

      return {
        bookingId: this.bookingId,
        bookingRef: response.data.data.bookingRef,
        status: response.data.data.status
      };
    });
  }

  async testCreatePaymentIntent() {
    return this.runTest('Create Payment Intent', async () => {
      if (!this.authToken || !this.bookingId) {
        throw new Error('Prerequisites not met');
      }

      const response = await axios.post(`${BASE_URL}/payment/create-payment-intent`, {
        bookingId: this.bookingId,
        amount: 299.99,
        currency: 'usd'
      }, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      if (!response.data.success) {
        throw new Error('Failed to create payment intent');
      }

      const { clientSecret, paymentIntentId } = response.data.data;
      
      if (!clientSecret || !clientSecret.startsWith('pi_')) {
        throw new Error(`Invalid client secret format: ${clientSecret}`);
      }

      return {
        paymentIntentId,
        clientSecretPrefix: clientSecret.substring(0, 20) + '...',
        amount: 299.99,
        currency: 'usd'
      };
    });
  }

  async testPaymentStatus() {
    return this.runTest('Check Payment Status', async () => {
      if (!this.authToken || !this.bookingId) {
        throw new Error('Prerequisites not met');
      }

      const response = await axios.get(`${BASE_URL}/payment/status/${this.bookingId}`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      if (!response.data.success) {
        throw new Error('Failed to get payment status');
      }

      return response.data.data;
    });
  }

  async generateReport() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(t => t.status === 'PASSED').length;
    const failedTests = this.testResults.filter(t => t.status === 'FAILED').length;

    log('\n' + '='.repeat(60), 'cyan');
    log('PAYMENT FLOW TEST REPORT', 'cyan');
    log('='.repeat(60), 'cyan');

    log(`\nOverall Results:`, 'white');
    log(`Total Tests: ${totalTests}`, 'white');
    logSuccess(`Passed: ${passedTests}`);
    logError(`Failed: ${failedTests}`);
    log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`, 'white');

    if (failedTests > 0) {
      log(`\nFailed Tests:`, 'red');
      this.testResults.filter(t => t.status === 'FAILED').forEach(test => {
        log(`  - ${test.name}: ${test.error}`, 'red');
      });
    }

    // Save detailed report
    const reportPath = require('path').join(__dirname, 'payment-flow-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: { totalTests, passedTests, failedTests },
      results: this.testResults,
      recommendations: this.generateRecommendations()
    }, null, 2));

    log(`\nDetailed report saved to: ${reportPath}`, 'cyan');
    
    return failedTests === 0;
  }

  generateRecommendations() {
    const recommendations = [];
    
    const stripeConfigTest = this.testResults.find(t => t.name === 'Stripe Configuration Check');
    if (stripeConfigTest && stripeConfigTest.result && !stripeConfigTest.result.keysMatch) {
      recommendations.push({
        issue: 'Stripe keys mismatch',
        description: 'Frontend and backend are using different Stripe accounts',
        solution: `Update frontend .env VITE_STRIPE_PUBLISHABLE_KEY to: ${stripeConfigTest.result.publicKey}`,
        priority: 'HIGH'
      });
    }

    return recommendations;
  }

  async runAllTests() {
    log('Starting Payment Flow Tests...', 'cyan');
    log(`Testing against: ${BASE_URL}`, 'blue');

    try {
      // Configuration tests
      await this.testStripeConfiguration();
      
      // Authentication and booking creation
      await this.authenticateTestUser();
      await this.createTestBooking();

      // Payment tests
      await this.testCreatePaymentIntent();
      await this.testPaymentStatus();

      return this.generateReport();
    } catch (error) {
      logError(`Test suite failed: ${error.message}`);
      await this.generateReport();
      return false;
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new PaymentFlowTester();
  tester.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      logError(`Test suite failed: ${error.message}`);
      process.exit(1);
    });
}

module.exports = PaymentFlowTester;
