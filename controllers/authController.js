const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const googleClient = new OAuth2Client();

/** Escape special regex characters so email can be used safely in RegExp */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Find user by email (case-insensitive), works without MongoDB collation */
function findUserByEmail(email) {
  const normalized = (email || '').trim().toLowerCase();
  const regex = new RegExp(`^${escapeRegex(normalized)}$`, 'i');
  return User.findOne({ email: { $regex: regex } });
}

exports.register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const rawEmail = (req.body.email || '').trim().toLowerCase();
    const password = (req.body.password || '').trim();

    const existingUser = await findUserByEmail(rawEmail);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    const user = await User.create({ email: rawEmail, password });

    const token = generateToken(user._id);

    res.status(201).json({
      _id: user._id,
      email: user.email,
      isAdmin: user.isAdmin,
      token
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const rawEmail = (req.body.email || '').trim().toLowerCase();
    const password = (req.body.password || '').trim();

    const user = await findUserByEmail(rawEmail);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const adminEmail = (process.env.ADMIN_EMAIL || 'admin1234@gmail.com').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin1234';
    if (rawEmail === adminEmail && password === adminPassword) {
      user.isAdmin = true;
      await user.save();
    }

    const token = generateToken(user._id);

    res.json({
      _id: user._id,
      email: user.email,
      isAdmin: user.isAdmin,
      token
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.googleLogin = async (req, res) => {
  try {
    const idToken = (req.body.idToken || '').trim();
    if (!idToken) {
      return res.status(400).json({ message: 'Google ID token is required' });
    }

    const rawAudience = (process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (!rawAudience.length) {
      return res.status(500).json({ message: 'Google auth is not configured on server' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: rawAudience
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.sub) {
      return res.status(401).json({ message: 'Invalid Google token payload' });
    }

    if (!payload.email_verified) {
      return res.status(401).json({ message: 'Google email is not verified' });
    }

    const normalizedEmail = payload.email.trim().toLowerCase();
    let user = await findUserByEmail(normalizedEmail);

    if (!user) {
      user = await User.create({
        email: normalizedEmail,
        googleId: payload.sub
      });
    } else if (!user.googleId) {
      user.googleId = payload.sub;
      await user.save();
    }

    const token = generateToken(user._id);
    res.json({
      _id: user._id,
      email: user.email,
      isAdmin: user.isAdmin,
      token
    });
  } catch (error) {
    res.status(401).json({ message: 'Google authentication failed', error: error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
