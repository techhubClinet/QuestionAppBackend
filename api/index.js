/**
 * Vercel serverless entry — connects to MongoDB then forwards to Express.
 * Set Vercel project "Root Directory" to `backend` (or deploy this folder).
 */
require('dotenv').config();
const connectDB = require('../config/db');
const app = require('../app');

module.exports = async (req, res) => {
  try {
    await connectDB();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Database connection failed' });
  }
  return app(req, res);
};
