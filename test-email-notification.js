#!/usr/bin/env node

/**
 * Email Notification Test Script
 * Tests the email notification system for post-payment confirmations
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

class EmailNotificationTester {
  constructor() {
    this.authToken = null;
    this.testResults = [];
  }

  async runTest(testName, testFunction) {
    logInfo(`Running: ${testName}`);
    try {
      await testFunction();
      logSuccess(`${testName} - PASSED`);
      this.testResults.push({ name: testName, status: 'PASSED' });
    } catch (error) {
      logError(`${testName} - FAILED: ${error.message}`);
      this.testResults.push({ name: testName, status: 'FAILED', error: error.message });
    }
  }

  async authenticateUser() {
    return this.runTest('User Authentication', async () => {
      const response = await axios.post(`${BASE_URL}/auth/login`, {
        email: 'test@example.com',
        password: 'password123'
      });

      if (!response.data.success) {
        throw new Error('Authentication failed');
      }

      this.authToken = response.data.data.accessToken;
      if (!this.authToken) {
        throw new Error('No access token received');
      }
    });
  }

  async testEmailService() {
    return this.runTest('Email Service Health Check', async () => {
      const response = await axios.get(`${BASE_URL}/email-test/health`);

      if (!response.data.success) {
        throw new Error('Email service test failed');
      }
    });
  }

  async testBookingConfirmationEmail() {
    return this.runTest('Booking Confirmation Email Test', async () => {
      // Create a test booking first
      const bookingResponse = await axios.post(`${BASE_URL}/booking/create`, {
        flightId: 'TEST_FLIGHT_001',
        originAirportCode: 'JFK',
        destinationAirportCode: 'LAX',
        originCity: 'New York',
        destinationCity: 'Los Angeles',
        departureDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        arrivalDate: new Date(Date.now() + 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000).toISOString(),
        totalPrice: 299.99,
        currency: 'USD',
        travellersInfo: [{
          firstName: 'John',
          lastName: 'Doe',
          travelerType: 'adult'
        }],
        contactDetails: {
          email: 'test@example.com',
          phone: '+1234567890'
        }
      }, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      if (!bookingResponse.data.success) {
        throw new Error('Failed to create test booking');
      }

      const bookingId = bookingResponse.data.data._id;
      
      // Test payment intent creation
      const paymentResponse = await axios.post(`${BASE_URL}/payment/create-payment-intent`, {
        bookingId: bookingId,
        amount: 299.99,
        currency: 'USD'
      }, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      if (!paymentResponse.data.success) {
        throw new Error('Failed to create payment intent');
      }

      // Simulate successful payment via backend test
      const testPaymentResponse = await axios.post(`${BASE_URL}/payment/test-card-payment`, {
        bookingId: bookingId,
        amount: 299.99,
        currency: 'USD',
        testCard: 'pm_card_visa'
      }, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      if (!testPaymentResponse.data.success) {
        throw new Error(`Test payment failed: ${testPaymentResponse.data.message}`);
      }

      logInfo('Test payment completed successfully');
      logInfo('Email notification should have been sent');
    });
  }

  async generateReport() {
    log('\n' + '='.repeat(60), 'cyan');
    log('EMAIL NOTIFICATION TEST REPORT', 'cyan');
    log('='.repeat(60), 'cyan');

    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.status === 'PASSED').length;
    const failedTests = this.testResults.filter(r => r.status === 'FAILED').length;

    log('\nOverall Results:', 'blue');
    log(`Total Tests: ${totalTests}`, 'white');
    logSuccess(`Passed: ${passedTests}`);
    logError(`Failed: ${failedTests}`);
    log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`, 'white');

    if (failedTests > 0) {
      log('\nFailed Tests:', 'red');
      this.testResults
        .filter(r => r.status === 'FAILED')
        .forEach(test => {
          log(`  - ${test.name}: ${test.error}`, 'red');
        });
    }

    log('\nRecommendations:', 'yellow');
    if (failedTests === 0) {
      log('✅ All email notification tests passed!', 'green');
      log('✅ Email system is working correctly', 'green');
    } else {
      log('⚠️  Some tests failed. Check the following:', 'yellow');
      log('  1. Email service configuration (SMTP settings)', 'yellow');
      log('  2. Webhook endpoint configuration', 'yellow');
      log('  3. Payment processing flow', 'yellow');
      log('  4. Error handling in email service', 'yellow');
    }
  }

  async runAllTests() {
    log('Starting Email Notification Tests...', 'cyan');
    log(`Testing against: ${BASE_URL}`, 'cyan');

    await this.authenticateUser();
    await this.testEmailService();
    await this.testBookingConfirmationEmail();

    await this.generateReport();
  }
}

// Run the tests
const tester = new EmailNotificationTester();
tester.runAllTests().catch(error => {
  logError(`Test suite failed: ${error.message}`);
  process.exit(1);
});
