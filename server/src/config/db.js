const mongoose = require('mongoose');

const getRetryLimit = () => Number(process.env.MONGO_CONNECT_RETRIES || 10);
const getRetryDelayMs = () => Number(process.env.MONGO_RETRY_DELAY_MS || 3000);

const getMongoOptions = () => ({
  serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000),
  socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS || 45000),
  connectTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS || 10000),
  maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 20),
  minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE || 2),
});

const isRetryableMongoError = error => (
  error?.name === 'MongoServerSelectionError'
  || error?.name === 'MongooseServerSelectionError'
  || /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|connection timed out/i.test(error?.message || '')
);

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const connectDB = async () => {
  const maxRetries = getRetryLimit();
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, getMongoOptions());
      console.log(`MongoDB connected: ${conn.connection.host}`);
      return;
    } catch (error) {
      const retryable = isRetryableMongoError(error);
      const isLastAttempt = attempt >= maxRetries;

      if (!retryable || isLastAttempt) {
        console.error(`MongoDB connection error: ${error.message}`);
        process.exit(1);
      }

      console.error(`MongoDB connect retry ${attempt + 1}/${maxRetries}: ${error.message}`);
      attempt += 1;
      await wait(getRetryDelayMs());
    }
  }
};

module.exports = connectDB;
