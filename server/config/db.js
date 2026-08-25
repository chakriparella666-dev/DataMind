const { Pool, Client } = require('pg');
require('dotenv').config();

const appPgConnectionString = process.env.POSTGRES_URI || process.env.DATABASE_URL || 'postgresql://postgres:chakri@localhost:5432/datamind_app';

let pool = null;
let isPgConnected = false;

const getAppPool = () => {
  if (!pool) {
    const isCloudPg = appPgConnectionString.includes('supabase') || appPgConnectionString.includes('neon') || appPgConnectionString.includes('sslmode=require') || appPgConnectionString.includes('amazonaws.com') || appPgConnectionString.includes('render.com') || appPgConnectionString.includes('dpg-');
    const poolConfig = {
      connectionString: appPgConnectionString,
      statement_timeout: 10000,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000
    };
    if (isCloudPg) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }
    pool = new Pool(poolConfig);
    pool.on('error', (err) => {
      console.warn('[PostgreSQL Pool Warning]:', err.message);
    });
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

    const isCloud = appPgConnectionString.includes('supabase') || appPgConnectionString.includes('neon') || appPgConnectionString.includes('amazonaws.com') || appPgConnectionString.includes('render.com') || appPgConnectionString.includes('dpg-');
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
        description TEXT,
        question TEXT,
        sql TEXT,
        data_source_id VARCHAR(100),
        layout VARCHAR(50) DEFAULT '2x2 Grid',
        date_range VARCHAR(50) DEFAULT 'Last 30 days',
        auto_refresh VARCHAR(50) DEFAULT 'Off',
        tags TEXT,
        visibility VARCHAR(50) DEFAULT 'Private',
        widgets INT DEFAULT 0,
        user_id VARCHAR(100) DEFAULT 'default_user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS file_uploads (
        id SERIAL PRIMARY KEY,
        original_name VARCHAR(255) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_type VARCHAR(50) NOT NULL,
        file_size BIGINT DEFAULT 0,
        created_tables JSONB DEFAULT '[]'::jsonb,
        data_source_id VARCHAR(100),
        user_id VARCHAR(100) DEFAULT 'default_user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS user_id VARCHAR(100) DEFAULT 'default_user';
      ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS user_id VARCHAR(100) DEFAULT 'default_user';
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS user_id VARCHAR(100) DEFAULT 'default_user';
      ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS user_id VARCHAR(100) DEFAULT 'default_user';
      ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS question TEXT;
      ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS sql TEXT;
      ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS data_source_id VARCHAR(100);
      ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS layout VARCHAR(50) DEFAULT '2x2 Grid';
      ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS date_range VARCHAR(50) DEFAULT 'Last 30 days';
      ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS auto_refresh VARCHAR(50) DEFAULT 'Off';
      ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS tags TEXT;
      ALTER TABLE file_uploads ADD COLUMN IF NOT EXISTS user_id VARCHAR(100) DEFAULT 'default_user';
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

const inMemoryAppDb = {
  users: [],
  dataSources: [],
  trainingChunks: [],
  chatSessions: [],
  chatMessages: [],
  dashboards: []
};

module.exports = {
  getAppPool,
  initAppDb,
  appQuery,
  inMemoryAppDb,
  isPgConnected: () => isPgConnected
};
