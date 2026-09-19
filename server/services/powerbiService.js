/**
 * Power BI Integration & Live Database Service
 * Provides automated 1-click Power BI Data Source (.pbids) generation,
 * Power Query M-code generation, and live database telemetry for BI visuals.
 */

const { appQuery, isPgConnected } = require('../config/db');

/**
 * Extract database host, port, db name, and user from connection string
 */
function parsePostgresConfig() {
  const connStr = process.env.POSTGRES_URI || process.env.DATABASE_URL || 'postgresql://postgres:chakri@localhost:5432/datamind_app';
  try {
    const url = new URL(connStr);
    return {
      host: url.hostname,
      port: url.port ? parseInt(url.port, 10) : 5432,
      database: url.pathname.replace('/', '') || 'datamind_app',
      user: url.username || 'postgres',
      password: url.password || '',
      ssl: connStr.includes('sslmode=require') || connStr.includes('render.com') || connStr.includes('amazonaws.com') || connStr.includes('neon') || connStr.includes('supabase')
    };
  } catch (err) {
    return {
      host: 'localhost',
      port: 5432,
      database: 'datamind_app',
      user: 'postgres',
      password: '',
      ssl: false
    };
  }
}

/**
 * Generate standard Power BI Data Source (.pbids) connection file content
 * Enables 1-click opening in Power BI Desktop without syntax errors
 */
function generatePbidsFile() {
  const config = parsePostgresConfig();

  const pbidsObject = {
    version: '0.1',
    connections: [
      {
        details: {
          protocol: 'postgresql',
          address: {
            server: config.host + (config.port && config.port !== 5432 ? `:${config.port}` : ''),
            database: config.database
          },
          authentication: null
        },
        options: {},
        mode: 'DirectQuery'
      }
    ]
  };

  return {
    filename: `DataMind_${config.database}_Live.pbids`,
    content: JSON.stringify(pbidsObject, null, 2),
    config
  };
}

/**
 * Generate Power Query M-Code for 1-click copy-paste into Power BI Desktop Power Query Advanced Editor
 */
function generatePowerQueryMCode(tableName) {
  const config = parsePostgresConfig();
  const serverStr = `"${config.host}${config.port && config.port !== 5432 ? ':' + config.port : ''}"`;
  const dbStr = `"${config.database}"`;

  if (tableName) {
    return `// Power Query M Script for Table: ${tableName}
let
    Source = PostgreSQL.Database(${serverStr}, ${dbStr}),
    public_Schema = Source{[Schema="public"]}[Data],
    TargetTable = public_Schema{[Item="${tableName}"]}[Data]
in
    TargetTable`;
  }

  return `// Power Query M Script for DataMind PostgreSQL Database
let
    Source = PostgreSQL.Database(${serverStr}, ${dbStr}),
    public_Schema = Source{[Schema="public"]}[Data]
in
    public_Schema`;
}

/**
 * Fetch real live tables, row counts, and columns directly from PostgreSQL
 */
async function getLiveDatabaseSchema() {
  if (!isPgConnected()) {
    throw new Error('Database is not connected');
  }

  // Fetch real tables
  const tablesRes = await appQuery(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC;
  `);

  const tableNames = tablesRes.rows.map(r => r.table_name);
  const tablesInfo = [];

  for (const tName of tableNames) {
    try {
      // Get row count
      const countRes = await appQuery(`SELECT COUNT(*) AS total FROM "${tName}";`);
      const rowCount = parseInt(countRes.rows[0]?.total || 0, 10);

      // Get columns
      const colsRes = await appQuery(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position ASC;
      `, [tName]);

      tablesInfo.push({
        tableName: tName,
        rowCount,
        columns: colsRes.rows.map(c => ({
          name: c.column_name,
          type: c.data_type,
          nullable: c.is_nullable === 'YES'
        }))
      });
    } catch (err) {
      console.warn(`[PowerBI Service] Could not introspect table "${tName}":`, err.message);
    }
  }

  return {
    dbConfig: parsePostgresConfig(),
    totalTables: tablesInfo.length,
    totalRows: tablesInfo.reduce((acc, t) => acc + t.rowCount, 0),
    tables: tablesInfo
  };
}

/**
 * Fetch live data and dynamic visual aggregations from any table in the database
 */
async function getLiveTableAnalytics(tableName, limit = 100) {
  if (!isPgConnected()) {
    throw new Error('Database is not connected');
  }

  // Verify table exists to avoid SQL injection
  const verifyRes = await appQuery(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = $1;
  `, [tableName]);

  if (verifyRes.rows.length === 0) {
    throw new Error(`Table "${tableName}" does not exist in the database`);
  }

  // Get total rows
  const countRes = await appQuery(`SELECT COUNT(*) AS total FROM "${tableName}";`);
  const totalRows = parseInt(countRes.rows[0]?.total || 0, 10);

  // Get columns
  const colsRes = await appQuery(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position ASC;
  `, [tableName]);
  const columns = colsRes.rows;

  // Fetch sample rows
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
  const rowsRes = await appQuery(`SELECT * FROM "${tableName}" LIMIT $1;`, [safeLimit]);
  const rows = rowsRes.rows;

  // Identify numeric, text, and date columns for automated BI charts
  const numericCols = columns.filter(c => ['integer', 'bigint', 'numeric', 'double precision', 'real', 'smallint', 'decimal'].includes(c.data_type.toLowerCase())).map(c => c.column_name);
  const textCols = columns.filter(c => ['character varying', 'varchar', 'text', 'character', 'char'].includes(c.data_type.toLowerCase())).map(c => c.column_name);

  // Compute aggregations dynamically from real data
  const aggregations = {};

  if (numericCols.length > 0) {
    const aggClauses = numericCols.slice(0, 4).map(c => `AVG("${c}") AS "avg_${c}", SUM("${c}") AS "sum_${c}", MIN("${c}") AS "min_${c}", MAX("${c}") AS "max_${c}"`).join(', ');
    try {
      const numAggRes = await appQuery(`SELECT ${aggClauses} FROM "${tableName}";`);
      aggregations.numeric = numAggRes.rows[0];
    } catch (e) {
      // Ignore if column contains non-coercible types
    }
  }

  // Compute top category distribution if text columns exist
  let categoryDistribution = [];
  if (textCols.length > 0) {
    const groupCol = textCols[0];
    try {
      const distRes = await appQuery(`
        SELECT "${groupCol}" AS label, COUNT(*) AS count 
        FROM "${tableName}" 
        WHERE "${groupCol}" IS NOT NULL 
        GROUP BY "${groupCol}" 
        ORDER BY count DESC 
        LIMIT 8;
      `);
      categoryDistribution = distRes.rows;
    } catch (e) {}
  }

  return {
    tableName,
    totalRows,
    columns: columns.map(c => ({ name: c.column_name, type: c.data_type })),
    rows,
    aggregations,
    categoryDistribution,
    powerQueryCode: generatePowerQueryMCode(tableName)
  };
}

module.exports = {
  parsePostgresConfig,
  generatePbidsFile,
  generatePowerQueryMCode,
  getLiveDatabaseSchema,
  getLiveTableAnalytics
};
