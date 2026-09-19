/**
 * Power BI Integration & SQL Query Dashboard Service
 * Executes generated SQL queries on PostgreSQL and transforms results into
 * rich Power BI-style BI visual analytics, KPIs, and Power Query M-scripts.
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
 * Generate Power Query M-Code for a specific SQL query
 */
function generateQueryPowerQueryMCode(sql) {
  const config = parsePostgresConfig();
  const serverStr = `"${config.host}${config.port && config.port !== 5432 ? ':' + config.port : ''}"`;
  const dbStr = `"${config.database}"`;
  const cleanSql = sql ? sql.replace(/"/g, '""').trim() : 'SELECT 1;';

  return `// Power Query M Script for Generated SQL Query
let
    Source = PostgreSQL.Database(${serverStr}, ${dbStr}, [Query="${cleanSql}"])
in
    Source`;
}

/**
 * Execute a generated SQL query and transform into Power BI Dashboard analytics
 */
async function executeSqlQueryForPowerBI(sql, question = 'Custom SQL Query') {
  if (!isPgConnected()) {
    throw new Error('Database is not connected');
  }

  if (!sql || !sql.trim()) {
    throw new Error('No SQL query provided to execute');
  }

  const startTime = Date.now();
  const res = await appQuery(sql);
  const executionTimeMs = Date.now() - startTime;

  const rows = res.rows || [];
  const totalRows = rows.length;

  if (rows.length === 0) {
    const fields = res.fields ? res.fields.map(f => f.name) : [];
    return {
      sql,
      question,
      executionTimeMs,
      totalRows: 0,
      columns: fields.map(f => ({ name: f, type: 'text' })),
      rows: [],
      kpis: [],
      chartConfig: { chartType: 'bar', xAxisKey: fields[0] || '', yAxisKeys: [] },
      powerQueryCode: generateQueryPowerQueryMCode(sql)
    };
  }

  const sampleRow = rows[0];
  const colNames = Object.keys(sampleRow);

  // Classify column types (numeric vs text/date)
  const columns = colNames.map(name => {
    const isNum = rows.some(r => r[name] !== null && r[name] !== undefined && !isNaN(Number(r[name])) && String(r[name]).trim() !== '' && typeof r[name] !== 'boolean');
    return {
      name,
      type: isNum ? 'numeric' : 'text'
    };
  });

  const numericCols = columns.filter(c => c.type === 'numeric').map(c => c.name);
  const textCols = columns.filter(c => c.type !== 'numeric').map(c => c.name);

  // Compute KPI metric cards (SUM, AVG, MIN, MAX) for each numeric column
  const kpis = [];
  kpis.push({
    label: 'Total Query Rows',
    value: totalRows.toLocaleString(),
    subtitle: 'Returned in ' + executionTimeMs + 'ms',
    type: 'count'
  });

  for (const numCol of numericCols.slice(0, 4)) {
    const vals = rows.map(r => Number(r[numCol])).filter(v => !isNaN(v) && v !== null);
    if (vals.length > 0) {
      const sum = vals.reduce((a, b) => a + b, 0);
      const avg = sum / vals.length;
      const min = Math.min(...vals);
      const max = Math.max(...vals);

      const isFloat = vals.some(v => v % 1 !== 0);
      const formatNum = (n) => isFloat ? Number(n.toFixed(2)).toLocaleString() : Math.round(n).toLocaleString();

      kpis.push({
        label: `Total ${numCol.replace(/_/g, ' ')}`,
        value: formatNum(sum),
        subtitle: `Avg: ${formatNum(avg)} | Min: ${formatNum(min)} | Max: ${formatNum(max)}`,
        type: 'metric'
      });
    }
  }

  // Determine smart chart axes
  const xAxisKey = textCols[0] || colNames[0];
  const yAxisKeys = numericCols.length > 0 ? numericCols : [];

  let chartType = 'bar';
  if (xAxisKey && (xAxisKey.toLowerCase().includes('date') || xAxisKey.toLowerCase().includes('year') || xAxisKey.toLowerCase().includes('month') || xAxisKey.toLowerCase().includes('day') || xAxisKey.toLowerCase().includes('time'))) {
    chartType = 'line';
  } else if (rows.length <= 6 && yAxisKeys.length === 1) {
    chartType = 'donut';
  }

  return {
    sql,
    question,
    executionTimeMs,
    totalRows,
    columns,
    rows,
    kpis,
    chartConfig: {
      chartType,
      xAxisKey,
      yAxisKeys,
      title: `${question || 'SQL Query Results'}`
    },
    powerQueryCode: generateQueryPowerQueryMCode(sql)
  };
}

/**
 * Fetch all saved SQL queries / dashboards for the user
 */
async function getSavedSqlQueries(userId = null) {
  if (!isPgConnected()) return [];

  let query = `
    SELECT d.id, d.name, d.question, d.sql, d.data_source_id AS "dataSourceId",
           ds.name AS "dataSourceName", d.widgets, d.created_at AS "createdAt"
    FROM dashboards d
    LEFT JOIN data_sources ds ON (d.data_source_id::text = ds.id::text)
    WHERE d.sql IS NOT NULL AND TRIM(d.sql) != ''
  `;
  const params = [];
  if (userId) {
    query += ` AND (d.user_id = $1 OR d.user_id = 'default_user' OR d.visibility = 'Public')`;
    params.push(String(userId));
  }
  query += ` ORDER BY d.created_at DESC;`;

  const res = await appQuery(query, params);
  return res.rows.map(r => ({
    ...r,
    _id: r.id.toString(),
    title: r.question || r.name || 'SQL Query'
  }));
}

module.exports = {
  parsePostgresConfig,
  generatePbidsFile,
  generateQueryPowerQueryMCode,
  executeSqlQueryForPowerBI,
  getSavedSqlQueries
};
