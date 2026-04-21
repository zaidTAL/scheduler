const mongoose = require('mongoose');

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
      mongoUri = process.env.MONGO_URI_LOCAL || 'mongodb://localhost:27017/digital_gk_book';
    }

    if (!mongoUri) {
      throw new Error(`MongoDB URI not configured for ${env} environment`);
    }

    console.log(`Connecting to: ${mongoUri.replace(/\/\/[^@]+@/, '//***:***@')}`);

    const conn = await mongoose.connect(mongoUri);

    console.log(`MongoDB Connected (${env} environment)`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    console.error(`Full error:`, error);
    process.exit(1);
  }
};

module.exports = connectDB;
