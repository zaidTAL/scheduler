const mongoose = require('mongoose');

// Fix for Windows DNS timeout with MongoDB Atlas SRV records
// Force Node.js to use IPv4 and set DNS timeout
if (process.platform === 'win32') {
  require('dns').setDefaultResultOrder('ipv4first');
}

/**
 * Connect to MongoDB database
 * Uses localhost for development, MongoDB Atlas for production
 * @returns {Promise<void>}
 */
const connectDB = async () => {
  try {
    const env = process.env.ENV || 'development';

    let mongoUri;

    if (env === 'production') {
      mongoUri = process.env.MONGO_URI_PROD;
    } else {
      mongoUri = process.env.MONGO_URI_LOCAL || 'mongodb://localhost:27017/scheduler';
    }

    if (!mongoUri) {
      throw new Error(`MongoDB URI not configured for ${env} environment`);
    }

    const sanitizedUri = mongoUri.replace(/\/\/[^@]+@/, '//***:***@');
    console.log(`Connecting to: ${sanitizedUri}`);

    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      retryWrites: false,
    });

    console.log(`MongoDB Connected (${env} environment)`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    console.error(`Full error:`, error);
    process.exit(1);
  }
};

module.exports = connectDB;
