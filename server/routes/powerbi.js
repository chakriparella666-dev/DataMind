const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const PowerBIReport = require('../models/PowerBIReport');
const {
  parsePostgresConfig,
  generatePbidsFile,
  generatePowerQueryMCode,
  getLiveDatabaseSchema,
  getLiveTableAnalytics
} = require('../services/powerbiService');

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

// GET /api/powerbi/schema - Fetch live real database schema & tables
router.get('/schema', async (req, res) => {
  try {
    const data = await getLiveDatabaseSchema();
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('[PowerBI Route Error] Schema introspection:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch database schema' });
  }
});

// GET /api/powerbi/table-analytics/:tableName - Fetch live table records and BI metrics from PostgreSQL
router.get('/table-analytics/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const { limit } = req.query;
    const analytics = await getLiveTableAnalytics(tableName, limit);
    res.json({ success: true, analytics });
  } catch (error) {
    console.error('[PowerBI Route Error] Table analytics:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch table analytics' });
  }
});

// GET /api/powerbi/export-pbids - 1-Click download Power BI Data Source Connection File (.pbids)
router.get('/export-pbids', (req, res) => {
  try {
    const { filename, content } = generatePbidsFile();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    console.error('[PowerBI Route Error] PBIDS export:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to generate .pbids file' });
  }
});

// GET /api/powerbi/powerquery-code/:tableName - 1-Click Power Query M-Code
router.get('/powerquery-code/:tableName', (req, res) => {
  try {
    const { tableName } = req.params;
    const code = generatePowerQueryMCode(tableName);
    res.json({ success: true, code });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/powerbi/feed - Live REST Data Feed for Power BI Web Connector
router.get('/feed', async (req, res) => {
  try {
    const { table, limit = 500 } = req.query;
    if (!table) {
      const schema = await getLiveDatabaseSchema();
      return res.json({ success: true, database: schema.dbConfig.database, tables: schema.tables.map(t => t.tableName) });
    }
    const analytics = await getLiveTableAnalytics(table, limit);
    res.json(analytics.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/powerbi - Get custom connected Power BI reports
router.get('/', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const reports = await PowerBIReport.findAll(userId);
    res.json({ success: true, reports });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch Power BI reports' });
  }
});

// POST /api/powerbi - Create a custom Power BI report
router.post('/', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const { name, description, category, embedType, embedUrl, datasetName, tags, visibility } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Report name is required' });
    }
    if (!embedUrl || !embedUrl.trim()) {
      return res.status(400).json({ success: false, error: 'Power BI Embed URL is required' });
    }

    const newReport = await PowerBIReport.create({
      name: name.trim(),
      description: description ? description.trim() : null,
      category: category || 'Executive',
      embedType: embedType || 'embed_url',
      embedUrl: embedUrl.trim(),
      datasetName,
      tags,
      visibility: visibility || 'Private',
      userId
    });

    res.status(201).json({ success: true, report: newReport });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to save Power BI report' });
  }
});

// DELETE /api/powerbi/:id - Delete custom Power BI report
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await PowerBIReport.delete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }
    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
