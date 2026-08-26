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
const { importFileToPostgres } = require('../utils/pgFileImporter');

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

const storage = multer.memoryStorage();

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
    const { name, type = 'postgres', connectionString, host, port, database, user, password, schema } = req.body;
    const userId = getUserIdFromReq(req);
    
    // Sanitize host: strip any port suffix if user typed localhost:3000 -> localhost
    const rawHost = (typeof host === 'string' ? host : 'localhost').trim();
    const cleanHost = rawHost.split(':')[0] || 'localhost';
    
    const defaultPort = type === 'mysql' ? 3306 : (type === 'sqlserver' ? 1433 : 5432);
    const defaultDb = type === 'mysql' ? 'mysql' : (type === 'sqlserver' ? 'master' : 'datamind_app');
    const defaultUser = type === 'mysql' ? 'root' : (type === 'sqlserver' ? 'sa' : 'postgres');

    const dbPort = Number(port) || defaultPort;

    const config = connectionString || {
      host: cleanHost,
      port: dbPort,
      database: database || defaultDb,
      user: user || defaultUser,
      password: password || '',
      schema: schema || 'public'
    };

    let schemaMetadata = null;

    if (type === 'mysql') {
      schemaMetadata = await introspectMysql(config);
    } else {
      schemaMetadata = await introspectPostgres(config);
    }

    const dataSource = await DataSource.create({
      name: name || database || `${type.toUpperCase()} DB`,
      type: type || 'postgres',
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
    console.error(`[${req.body.type || 'Database'} Connect Error]:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/datasources/upload-file
 * Upload CSV, Excel, or data file directly into PostgreSQL datamind_app database
 */
router.post('/upload-file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const { originalname, buffer: fileBuffer } = req.file;
    const userId = getUserIdFromReq(req);
    const ext = path.extname(originalname).toLowerCase();
    const type = ext === '.csv' ? 'csv' : (ext === '.xlsx' || ext === '.xls' ? 'excel' : 'postgres');

    const imported = await importFileToPostgres(fileBuffer || req.file.path, originalname);
    const schemaMetadata = { tables: imported.tables };

    const dataSource = await DataSource.create({
      name: originalname,
      type,
      connectionConfig: {
        originalFileName: originalname,
        createdTables: imported.createdTables,
        isPgTable: true
      },
      schemaMetadata,
      userId
    });

    // Run schema chunk generation asynchronously so the upload response returns instantly
    generateSchemaTrainingChunks(dataSource._id.toString(), schemaMetadata, userId).catch(err => {
      console.warn('[DataSources] Async schema training chunks warning:', err.message);
    });

    const { appQuery, isPgConnected } = require('../config/db');
    if (isPgConnected()) {
      try {
        await appQuery(
          `INSERT INTO file_uploads (original_name, file_name, file_type, file_size, created_tables, data_source_id, user_id, file_data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
          [
            originalname,
            req.file.originalname,
            type,
            req.file.size || 0,
            JSON.stringify(imported.createdTables || []),
            String(dataSource._id || dataSource.id),
            String(userId),
            fileBuffer || null
          ]
        );
      } catch (dbErr) {
        console.warn('[file_uploads table insert warning]:', dbErr.message);
      }
    }

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
