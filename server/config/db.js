const { Pool, Client } = require('pg');
require('dotenv').config();

const appPgConnectionString = process.env.POSTGRES_URI || process.env.DATABASE_URL || 'postgresql://postgres:chakri@localhost:5432/datamind_app';

let pool = null;
let isPgConnected = false;

const getAppPool = () => {
  if (!pool) {
    const isCloudPg = appPgConnectionString.includes('supabase') || appPgConnectionString.includes('neon') || appPgConnectionString.includes('sslmode=require') || appPgConnectionString.includes('amazonaws.com');
    const poolConfig = {
      connectionString: appPgConnectionString,
      statement_timeout: 10000,
      connectionTimeoutMillis: 5000
    };
    if (isCloudPg) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }
    pool = new Pool(poolConfig);
  }
  return pool;
};

/**
 * Automatically create datamind_app database if missing
 */
const ensureDatabaseExists = async () => {
  try {
    const url = new URL(appPgConnectionString);
    const dbName = url.pathname.replace('/', '') || 'datamind_app';
    const baseUrl = `${url.protocol}//${url.username}:${url.password}@${url.host}:${url.port || 5432}/postgres`;

    const isCloud = appPgConnectionString.includes('supabase') || appPgConnectionString.includes('neon') || appPgConnectionString.includes('amazonaws.com');
    const clientConfig = { connectionString: baseUrl, connectionTimeoutMillis: 3000 };
    if (isCloud) {
      clientConfig.ssl = { rejectUnauthorized: false };
    }

    const client = new Client(clientConfig);
    await client.connect();
    
    const checkRes = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1;`, [dbName]);
    if (checkRes.rows.length === 0) {
      await client.query(`CREATE DATABASE "${dbName}";`);
      console.log(`[PostgreSQL App DB] Created database "${dbName}" automatically.`);
    }
    await client.end();
  } catch (err) {
    // Ignore error if database creation check fails
  }
};

/**
 * Initialize PostgreSQL Application Database Tables with User Isolation
 */
const initAppDb = async () => {
  try {
    await ensureDatabaseExists();

    const p = getAppPool();
    const client = await p.connect();
    
    // Create Tables if not exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255),
        google_id VARCHAR(255),
        avatar TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS data_sources (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        connection_config JSONB NOT NULL,
        schema_metadata JSONB,
        status VARCHAR(50) DEFAULT 'active',
        user_id VARCHAR(100) DEFAULT 'default_user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS training_chunks (
        id SERIAL PRIMARY KEY,
        data_source_id VARCHAR(100) NOT NULL,
        chunk_type VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB,
        embedding JSONB,
        user_id VARCHAR(100) DEFAULT 'default_user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chat_sessions (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(100) UNIQUE NOT NULL,
        title VARCHAR(255) DEFAULT 'New Chat',
        mode VARCHAR(50) DEFAULT 'sql',
        data_source_id VARCHAR(100),
        user_id VARCHAR(100) DEFAULT 'default_user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(100) NOT NULL,
        sender VARCHAR(20) NOT NULL,
        text TEXT,
        intent VARCHAR(50),
        sql TEXT,
        explanation TEXT,
        data JSONB,
        fields JSONB,
        chart_config JSONB,
        self_corrected BOOLEAN DEFAULT FALSE,
        error TEXT,
        user_id VARCHAR(100) DEFAULT 'default_user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS dashboards (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        visibility VARCHAR(50) DEFAULT 'Private',
        widgets INT DEFAULT 0,
        user_id VARCHAR(100) DEFAULT 'default_user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS file_uploads (
        id SERIAL PRIMARY KEY,
        data_source_id INT REFERENCES data_sources(id) ON DELETE CASCADE,
        original_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100),
        file_data BYTEA NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS user_id VARCHAR(100) DEFAULT 'default_user';
      ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS user_id VARCHAR(100) DEFAULT 'default_user';
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS user_id VARCHAR(100) DEFAULT 'default_user';
      ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS user_id VARCHAR(100) DEFAULT 'default_user';
    `);

    client.release();
    isPgConnected = true;
    console.log(`[PostgreSQL App DB] Connected & initialized app tables with strict user isolation (${appPgConnectionString}).`);
    return true;
  } catch (error) {
    console.error(`[PostgreSQL App DB Error] Failed to connect to PostgreSQL (${appPgConnectionString}): ${error.message}`);
    isPgConnected = false;
    return false;
  }
};

/**
 * App Query helper executing directly on PostgreSQL
 */
const appQuery = async (text, params = []) => {
  const p = getAppPool();
  return await p.query(text, params);
};

const saveFileUpload = async (dataSourceId, originalName, mimeType, fileBuffer) => {
  if (!isPgConnected()) return null;
  const numId = parseInt(dataSourceId, 10);
  const res = await appQuery(
    `INSERT INTO file_uploads (data_source_id, original_name, mime_type, file_data)
     VALUES ($1, $2, $3, $4)
     RETURNING id;`,
    [numId, originalName, mimeType || 'application/octet-stream', fileBuffer]
  );
  return res.rows[0]?.id;
};

const getFileUploadByDataSourceId = async (dataSourceId) => {
  if (!isPgConnected()) return null;
  const numId = parseInt(dataSourceId, 10);
  if (isNaN(numId)) return null;
  const res = await appQuery(
    `SELECT original_name AS "originalName", mime_type AS "mimeType", file_data AS "fileBuffer"
     FROM file_uploads
     WHERE data_source_id = $1
     ORDER BY created_at DESC LIMIT 1;`,
    [numId]
  );
  return res.rows[0] || null;
};

module.exports = {
  getAppPool,
  initAppDb,
  appQuery,
  saveFileUpload,
  getFileUploadByDataSourceId,
  isPgConnected: () => isPgConnected
};
