const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const DataSource = require('../models/DataSource');
const TrainingChunk = require('../models/TrainingChunk');
const { introspectPostgres } = require('../db/connectors/postgres');
const { loadFileIntoSqlite, introspectSqlite } = require('../db/connectors/sqlite');
const { introspectMysql } = require('../db/connectors/mysql');
const { getEmbedding } = require('../services/ragRetrieval');

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

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_]/g, '_');
    cb(null, `${Date.now()}_${safeBase}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Helper to chunk and embed schema
const generateSchemaTrainingChunks = async (dataSourceId, schemaMetadata, userId = 'default_user') => {
  try {
    for (const table of schemaMetadata.tables || []) {
      const colText = (table.columns || []).map(c => `${c.name} (${c.type})`).join(', ');
      const content = `TABLE: "${table.name}"\nCOLUMNS: ${colText}`;
      const embedding = await getEmbedding(content);

      await TrainingChunk.create({
        dataSourceId,
        chunkType: 'schema',
        content,
        metadata: { tableName: table.name },
        embedding,
        userId
      });
    }
  } catch (err) {
    console.warn('[DataSources] Schema embedding warning:', err.message);
  }
};

/**
 * POST /api/datasources/connect-postgres
 * Connect PostgreSQL database
 */
router.post('/connect-postgres', async (req, res) => {
  try {
    const { name, connectionString, host, port, database, user, password, schema } = req.body;
    const userId = getUserIdFromReq(req);
    
    // Sanitize host: strip any port suffix if user typed localhost:3000 -> localhost
    const rawHost = (typeof host === 'string' ? host : 'localhost').trim();
    const cleanHost = rawHost.split(':')[0] || 'localhost';
    const dbPort = Number(port) || 5432;

    const config = connectionString || {
      host: cleanHost,
      port: dbPort,
      database: database || 'datamind_app',
      user: user || 'postgres',
      password: password || '',
      schema: schema || 'public'
    };

    const schemaMetadata = await introspectPostgres(config);

    const dataSource = await DataSource.create({
      name: name || database || 'PostgreSQL DB',
      type: 'postgres',
      connectionConfig: typeof config === 'string' ? { connectionString: config } : config,
      schemaMetadata,
      userId
    });

    await generateSchemaTrainingChunks(dataSource._id.toString(), schemaMetadata, userId);

    res.json({
      success: true,
      dataSource
    });
  } catch (error) {
    console.error('[Postgres Connect Error]:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/datasources/upload-file
 * Upload CSV, Excel, or SQLite file
 */
router.post('/upload-file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const { originalname, path: filePath } = req.file;
    const userId = getUserIdFromReq(req);
    const dbKey = 'db_' + Date.now();

    const loadedDb = await loadFileIntoSqlite(dbKey, filePath, originalname);
    const schemaMetadata = introspectSqlite(dbKey);

    const ext = path.extname(originalname).toLowerCase();
    const type = ext === '.csv' ? 'csv' : (ext === '.xlsx' || ext === '.xls' ? 'excel' : 'sqlite');

    const dataSource = await DataSource.create({
      name: originalname,
      type,
      connectionConfig: {
        filePath,
        originalFileName: originalname,
        dbKey
      },
      schemaMetadata,
      userId
    });

    await generateSchemaTrainingChunks(dataSource._id.toString(), schemaMetadata, userId);

    res.json({
      success: true,
      dataSource
    });
  } catch (error) {
    console.error('[File Upload Error]:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/datasources/sample-data
 * Create instant sample dataset with sample customers, orders, and sales tables
 */
router.post('/sample-data', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const dbKey = 'sample_db_' + Date.now();
    const SqlInstance = await require('sql.js')();
    const db = new SqlInstance.Database();

    // Create Customers Table
    db.run(`
      CREATE TABLE customers (
        id INTEGER PRIMARY KEY,
        name TEXT,
        city text,
        country TEXT,
        spent REAL
      );
      INSERT INTO customers VALUES (1, 'Alice Smith', 'New York', 'USA', 1250.00);
      INSERT INTO customers VALUES (2, 'Bob Jones', 'London', 'UK', 3400.50);
      INSERT INTO customers VALUES (3, 'Charlie Brown', 'Tokyo', 'Japan', 2100.00);
      INSERT INTO customers VALUES (4, 'Diana Prince', 'Paris', 'France', 4500.75);
      INSERT INTO customers VALUES (5, 'Evan Wright', 'New York', 'USA', 890.25);
    `);

    // Create Orders Table
    db.run(`
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY,
        customer_id INTEGER,
        product TEXT,
        amount REAL,
        order_date TEXT
      );
      INSERT INTO orders VALUES (101, 1, 'Laptop', 1200.00, '2026-01-15');
      INSERT INTO orders VALUES (102, 2, 'Phone', 800.00, '2026-02-01');
      INSERT INTO orders VALUES (103, 3, 'Monitor', 350.00, '2026-02-10');
      INSERT INTO orders VALUES (104, 4, 'Tablet', 600.00, '2026-03-05');
      INSERT INTO orders VALUES (105, 2, 'Headphones', 150.00, '2026-03-12');
    `);

    const { registerSqliteDb, introspectSqlite } = require('../db/connectors/sqlite');
    registerSqliteDb(dbKey, db);

    const schemaMetadata = introspectSqlite(dbKey);

    const dataSource = await DataSource.create({
      name: 'Sample E-Commerce Database',
      type: 'sqlite',
      connectionConfig: { dbKey },
      schemaMetadata,
      userId
    });

    await generateSchemaTrainingChunks(dataSource._id.toString(), schemaMetadata, userId);

    res.json({
      success: true,
      dataSource
    });
  } catch (error) {
    console.error('[Sample Data Error]:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/datasources
 * Get active data sources filtered by user
 */
router.get('/', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const dataSources = await DataSource.find(userId);
    res.json({ success: true, dataSources });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserIdFromReq(req);
    const { appQuery, isPgConnected } = require('../config/db');
    if (isPgConnected()) {
      const numId = parseInt(id, 10);
      if (!isNaN(numId)) {
        await appQuery(`DELETE FROM data_sources WHERE id = $1 AND (user_id = $2 OR user_id = 'default_user');`, [numId, String(userId)]);
      }
    }
    res.json({ success: true, message: 'Data source deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
