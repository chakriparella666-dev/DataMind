const { Pool } = require('pg');

const pools = new Map();

/**
 * Get or create a PostgreSQL connection pool
 * @param {string | object} config Connection string or config object
 * @returns {Pool}
 */
const getPostgresPool = (config) => {
  const key = typeof config === 'string' ? config : `${config.host}:${config.port}:${config.database}:${config.user}`;
  if (!pools.has(key)) {
    const poolConfig = typeof config === 'string'
      ? { connectionString: config, statement_timeout: 10000 }
      : { ...config, statement_timeout: 10000 };
    
    const pool = new Pool(poolConfig);
    pools.set(key, pool);
  }
  return pools.get(key);
};

/**
 * Introspect PostgreSQL schema: tables, columns, types, keys, sample rows
 */
const introspectPostgres = async (config) => {
  const pool = getPostgresPool(config);
  const client = await pool.connect();
  try {
    // 1. Get public tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `);
    const tableNames = tablesRes.rows.map(r => r.table_name);

    const tables = [];
    for (const tableName of tableNames) {
      // 2. Get columns & types
      const colsRes = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [tableName]);

      const columns = colsRes.rows.map(col => ({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === 'YES'
      }));

      // 3. Get 5 sample rows safely
      let sampleRows = [];
      try {
        const sampleRes = await client.query(`SELECT * FROM "${tableName}" LIMIT 5;`);
        sampleRows = sampleRes.rows;
      } catch (err) {
        console.warn(`Could not fetch sample rows for ${tableName}:`, err.message);
      }

      tables.push({
        name: tableName,
        columns,
        sampleRows
      });
    }

    return {
      type: 'postgres',
      tables
    };
  } finally {
    client.release();
  }
};

/**
 * Execute read-only SELECT query against PostgreSQL
 */
const executePostgresQuery = async (config, sql) => {
  const pool = getPostgresPool(config);
  const client = await pool.connect();
  const startTime = Date.now();
  try {
    // Set read-only session for safety
    await client.query('SET TRANSACTION READ ONLY;');
    const res = await client.query(sql);
    const executionTimeMs = Date.now() - startTime;
    return {
      rows: res.rows,
      fields: res.fields ? res.fields.map(f => f.name) : [],
      rowCount: res.rowCount,
      executionTimeMs
    };
  } finally {
    client.release();
  }
};

module.exports = {
  getPostgresPool,
  introspectPostgres,
  executePostgresQuery
};
