#!/usr/bin/env node

/**
 * Check Payments Script
 * 
 * This script connects to MongoDB and checks the payment collection
 * to see if payment records are being created.
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

// MongoDB connection string from environment
const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-airport';

async function checkPayments() {
  let client;
  
  try {
    console.log('🔗 Connecting to MongoDB...');
    console.log(`📍 URI: ${MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
    
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    const paymentsCollection = db.collection('payments');
    const bookingsCollection = db.collection('bookings');
    
    console.log('✅ Connected to MongoDB successfully!');
    console.log('');
    
    // Check payment count
    const paymentCount = await paymentsCollection.countDocuments();
    console.log(`💳 Total payments in database: ${paymentCount}`);
    
    // Check booking count
    const bookingCount = await bookingsCollection.countDocuments();
    console.log(`📋 Total bookings in database: ${bookingCount}`);
    
    // Check confirmed bookings
    const confirmedBookings = await bookingsCollection.countDocuments({ status: 'confirmed' });
    console.log(`✅ Confirmed bookings: ${confirmedBookings}`);
    
    // Check completed payments
    const completedPayments = await paymentsCollection.countDocuments({ status: 'completed' });
    console.log(`💰 Completed payments: ${completedPayments}`);
    
    console.log('');
    
    if (paymentCount === 0) {
      console.log('⚠️  NO PAYMENT RECORDS FOUND!');
      console.log('');
      console.log('🔍 Let\'s check recent bookings...');
      
      // Get recent confirmed bookings
      const recentBookings = await bookingsCollection
        .find({ status: 'confirmed' })
        .sort({ updatedAt: -1 })
        .limit(5)
        .toArray();
      
      if (recentBookings.length > 0) {
        console.log(`📋 Found ${recentBookings.length} recent confirmed bookings:`);
        console.log('');
        
        for (const booking of recentBookings) {
          console.log(`🎫 Booking: ${booking.bookingRef}`);
          console.log(`   ID: ${booking._id}`);
          console.log(`   Status: ${booking.status}`);
          console.log(`   Payment Status: ${booking.paymentStatus}`);
          console.log(`   Payment Intent: ${booking.paymentIntentId || 'N/A'}`);
          console.log(`   Total: $${booking.totalPrice}`);
          console.log(`   Updated: ${booking.updatedAt}`);
          
          // Check if payment record exists for this booking
          const payment = await paymentsCollection.findOne({ bookingId: booking._id.toString() });
          if (payment) {
            console.log(`   💳 Payment Record: EXISTS (${payment._id})`);
          } else {
            console.log(`   ❌ Payment Record: MISSING`);
          }
          console.log('');
        }
      } else {
        console.log('❌ No confirmed bookings found');
      }
    } else {
      console.log('✅ Payment records found! Let\'s check recent ones...');
      console.log('');
      
      // Get recent payments
      const recentPayments = await paymentsCollection
        .find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();
      
      for (const payment of recentPayments) {
        console.log(`💳 Payment: ${payment._id}`);
        console.log(`   Booking ID: ${payment.bookingId}`);
        console.log(`   Transaction ID: ${payment.transactionId}`);
        console.log(`   Amount: $${payment.amount} ${payment.currency}`);
        console.log(`   Status: ${payment.status}`);
        console.log(`   Provider: ${payment.provider}`);
        console.log(`   Created: ${payment.createdAt}`);
        console.log('');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('');
    console.error('💡 Troubleshooting:');
    console.error('   1. Check if MongoDB is running');
    console.error('   2. Verify MONGODB_URI in .env file');
    console.error('   3. Check network connectivity');
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

// Run the check
console.log('🚀 Smart Airport - Payment Database Check');
console.log('==========================================');
checkPayments();
