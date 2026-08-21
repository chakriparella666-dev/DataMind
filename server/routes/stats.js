const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const DataSource = require('../models/DataSource');
const { appQuery, isPgConnected } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'datamind_jwt_secret_key_2026';

const getUserIdFromReq = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded && (decoded.id || decoded.email)) {
        return decoded.id || decoded.email;
      }
    } catch (e) {}
  }
  if (req.headers['x-guest-id']) {
    return req.headers['x-guest-id'];
  }
  return req.headers['x-user-id'] || req.headers['x-user-email'] || 'anonymous_guest';
};

// GET /api/stats/overview - Return real-time live system stats strictly per user from PostgreSQL
router.get('/overview', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const dataSources = await DataSource.find(userId);
    const totalDataSources = dataSources.length;
    const activeDataSources = dataSources.filter(ds => ds.status !== 'error' && ds.status !== 'inactive').length;

    let errorsCount = 0;
    let recentActivityCount = 0;

    if (isPgConnected()) {
      const errRes = await appQuery(
        `SELECT COUNT(*)::int as count FROM chat_messages WHERE error IS NOT NULL AND error != '' AND user_id = $1;`,
        [String(userId)]
      );
      errorsCount = errRes.rows[0]?.count || 0;

      const actRes = await appQuery(
        `SELECT COUNT(*)::int as count FROM chat_messages WHERE user_id = $1;`,
        [String(userId)]
      );
      recentActivityCount = actRes.rows[0]?.count || 0;
    }

    res.json({
      success: true,
      stats: {
        totalDataSources,
        activeDataSources,
        errorsCount,
        recentActivityCount
      }
    });
  } catch (error) {
    console.error('Error fetching system stats:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch system stats' });
  }
});

module.exports = router;
