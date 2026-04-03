const mongoose = require('mongoose');

/** Reuse connection across Vercel serverless invocations */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined');
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };
    cached.promise = mongoose
      .connect(process.env.MONGODB_URI, opts)
      .then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
    if (process.env.NODE_ENV !== 'production' || process.env.VERCEL) {
      console.log(`MongoDB Connected: ${cached.conn.connection.host}`);
    }
  } catch (error) {
    cached.promise = null;
    console.error(`MongoDB connection error: ${error.message}`);
    throw error;
  }

  return cached.conn;
}

module.exports = connectDB;
