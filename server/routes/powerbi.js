const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const PowerBIReport = require('../models/PowerBIReport');
const { sanitizeEmbedUrl, generatePowerBIEmbedToken } = require('../services/powerbiService');

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

// GET /api/powerbi - Get all Power BI reports for user
router.get('/', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const reports = await PowerBIReport.findAll(userId);
    res.json({ success: true, reports });
  } catch (error) {
    console.error('[PowerBI Route Error] Fetch reports:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch Power BI reports' });
  }
});

// GET /api/powerbi/:id - Get specific Power BI report
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const report = await PowerBIReport.findById(id);
    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }
    res.json({ success: true, report });
  } catch (error) {
    console.error('[PowerBI Route Error] Get report:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to get Power BI report' });
  }
});

// POST /api/powerbi - Create a new Power BI report configuration
router.post('/', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const {
      name,
      description,
      category,
      embedType,
      embedUrl,
      reportId,
      workspaceId,
      clientId,
      clientSecret,
      tenantId,
      datasetName,
      tags,
      visibility
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Report name is required' });
    }

    const cleanEmbedUrl = sanitizeEmbedUrl(embedUrl);
    if (!cleanEmbedUrl && embedType !== 'service_principal') {
      return res.status(400).json({ success: false, error: 'A valid Power BI Embed URL or iframe src is required' });
    }

    const newReport = await PowerBIReport.create({
      name: name.trim(),
      description: description ? description.trim() : null,
      category: category || 'Executive',
      embedType: embedType || 'embed_url',
      embedUrl: cleanEmbedUrl || '',
      reportId,
      workspaceId,
      clientId,
      clientSecret,
      tenantId,
      datasetName,
      tags,
      visibility: visibility || 'Private',
      userId
    });

    res.status(201).json({ success: true, report: newReport });
  } catch (error) {
    console.error('[PowerBI Route Error] Create report:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to save Power BI report' });
  }
});

// POST /api/powerbi/embed-token - Generate Embed Token via Azure AD Service Principal
router.post('/embed-token', async (req, res) => {
  try {
    const { tenantId, clientId, clientSecret, workspaceId, reportId } = req.body;
    const tokenData = await generatePowerBIEmbedToken({
      tenantId,
      clientId,
      clientSecret,
      workspaceId,
      reportId
    });

    res.json({ success: true, tokenData });
  } catch (error) {
    console.error('[PowerBI Route Error] Generate Embed Token:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to generate Power BI Embed Token' });
  }
});

// PUT /api/powerbi/:id - Update Power BI report
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    if (data.embedUrl) {
      data.embedUrl = sanitizeEmbedUrl(data.embedUrl);
    }
    const updated = await PowerBIReport.update(id, data);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }
    res.json({ success: true, report: updated });
  } catch (error) {
    console.error('[PowerBI Route Error] Update report:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to update report' });
  }
});

// DELETE /api/powerbi/:id - Delete Power BI report
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await PowerBIReport.delete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Report not found or already deleted' });
    }
    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (error) {
    console.error('[PowerBI Route Error] Delete report:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to delete report' });
  }
});

module.exports = router;
