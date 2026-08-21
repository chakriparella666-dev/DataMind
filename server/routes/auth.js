const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'datamind_jwt_secret_key_2026';

/**
 * Middleware to verify JWT token
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
  }
};

/**
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'An account with this email already exists.' });
    }

    const user = await User.create({ name, email, password });
    const token = User.generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user.id || user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('[Auth Register Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid email or password.' });
    }

    if (!user.password) {
      return res.status(400).json({ success: false, error: 'Account created via Google. Please log in with Google.' });
    }

    const isMatch = await User.comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Invalid email or password.' });
    }

    const token = User.generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user.id || user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('[Auth Login Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/auth/google
 */
router.post('/google', async (req, res) => {
  try {
    const { email, name, googleId, avatar, credential } = req.body;

    let userEmail = email;
    let userName = name;
    let userGoogleId = googleId;
    let userAvatar = avatar;

    // Decode Google JWT Credential if provided from Google One Tap / GSI
    if (credential) {
      try {
        const decoded = jwt.decode(credential);
        if (decoded) {
          userEmail = decoded.email;
          userName = decoded.name || decoded.given_name;
          userGoogleId = decoded.sub;
          userAvatar = decoded.picture;
        }
      } catch (e) {
        console.warn('[Google JWT Decode Warning]:', e.message);
      }
    }

    if (!userEmail) {
      return res.status(400).json({ success: false, error: 'Google authentication failed: Email missing.' });
    }

    let user = await User.findByEmail(userEmail);
    if (!user) {
      user = await User.create({
        name: userName || userEmail.split('@')[0],
        email: userEmail,
        password: null,
        googleId: userGoogleId,
        avatar: userAvatar
      });
    }

    const token = User.generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user.id || user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.name)}`
      }
    });
  } catch (error) {
    console.error('[Auth Google Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/auth/me (Persistent Login Check)
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      // Fallback to JWT payload user info if record is not found
      return res.json({
        success: true,
        user: {
          id: req.user.id,
          name: req.user.name || (req.user.email ? req.user.email.split('@')[0] : 'Authenticated User'),
          email: req.user.email || ''
        }
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id || user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      }
    });
  } catch (error) {
    if (req.user && (req.user.name || req.user.email)) {
      return res.json({
        success: true,
        user: {
          id: req.user.id,
          name: req.user.name || (req.user.email ? req.user.email.split('@')[0] : 'Authenticated User'),
          email: req.user.email || ''
        }
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
