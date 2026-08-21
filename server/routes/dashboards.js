const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Dashboard = require('../models/Dashboard');

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

// GET /api/dashboards - Fetch all dashboards for user
router.get('/', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const dashboards = await Dashboard.findAll(userId);
    res.json({ success: true, dashboards });
  } catch (error) {
    console.error('Error fetching dashboards:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch dashboards' });
  }
});

// POST /api/dashboards - Create a dashboard
router.post('/', async (req, res) => {
  try {
    const { name, visibility, widgets } = req.body;
    const userId = getUserIdFromReq(req);

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Dashboard name is required' });
    }

    const dashboard = await Dashboard.create({
      name: name.trim(),
      visibility: visibility || 'Private',
      widgets: Number(widgets) || 0,
      userId
    });

    res.status(201).json({ success: true, dashboard });
  } catch (error) {
    console.error('Error creating dashboard:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create dashboard' });
  }
});

// PUT /api/dashboards/:id - Update dashboard
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Dashboard.update(id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Dashboard not found' });
    }
    res.json({ success: true, dashboard: updated });
  } catch (error) {
    console.error('Error updating dashboard:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to update dashboard' });
  }
});

// DELETE /api/dashboards/:id - Delete dashboard
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Dashboard.delete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Dashboard not found or already deleted' });
    }
    res.json({ success: true, message: 'Dashboard deleted successfully' });
  } catch (error) {
    console.error('Error deleting dashboard:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to delete dashboard' });
  }
});

module.exports = router;
