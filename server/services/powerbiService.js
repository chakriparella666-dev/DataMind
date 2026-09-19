/**
 * Power BI Integration & SQL Query Dashboard Service
 * Transforms raw SQL query results into rich, multi-visual Power BI Report Canvases
 * with auto-aggregated metrics, categorical frequencies, cross-tab matrices, and interactive slicers.
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
 * Execute a generated SQL query and transform into rich Power BI Report Canvas
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
      visuals: {
        primaryChart: { title: 'No Data', data: [], xKey: '', yKeys: [], type: 'bar' },
        secondaryChart: { title: 'No Data', data: [], nameKey: '', valKey: '', type: 'donut' },
        matrix: { rowKey: '', colKey: '', matrixData: [] },
        slicers: {}
      },
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

  // 1. Build Slicer Metadata (Unique values for every categorical column)
  const slicers = {};
  textCols.forEach(col => {
    const uniqueVals = Array.from(new Set(rows.map(r => r[col] !== null && r[col] !== undefined ? String(r[col]).trim() : 'Unknown'))).filter(Boolean);
    if (uniqueVals.length > 0 && uniqueVals.length <= 100) {
      slicers[col] = uniqueVals;
    }
  });

  // 2. Build Power BI Executive KPI Cards
  const kpis = [];
  kpis.push({
    label: 'Total Query Records',
    value: totalRows.toLocaleString(),
    subtitle: `Executed in ${executionTimeMs}ms`,
    type: 'count'
  });

  if (numericCols.length > 0) {
    // Has numbers: compute SUM, AVG, MIN, MAX
    for (const numCol of numericCols.slice(0, 3)) {
      const vals = rows.map(r => Number(r[numCol])).filter(v => !isNaN(v) && v !== null);
      if (vals.length > 0) {
        const sum = vals.reduce((a, b) => a + b, 0);
        const avg = sum / vals.length;
        const min = Math.min(...vals);
        const max = Math.max(...vals);

        const isFloat = vals.some(v => v % 1 !== 0);
        const formatNum = (n) => isFloat ? Number(n.toFixed(2)).toLocaleString() : Math.round(n).toLocaleString();

        kpis.push({
          label: `Total ${numCol.replace(/_/g, ' ').toUpperCase()}`,
          value: formatNum(sum),
          subtitle: `Avg: ${formatNum(avg)} | Max: ${formatNum(max)}`,
          type: 'metric'
        });
      }
    }
  } else {
    // Categorical only (like segment, country): compute distinct counts and dominant mode
    textCols.slice(0, 3).forEach(col => {
      const vals = rows.map(r => String(r[col] || '').trim()).filter(Boolean);
      const uniqueCount = new Set(vals).size;
      
      // Compute most frequent category
      const countMap = {};
      vals.forEach(v => { countMap[v] = (countMap[v] || 0) + 1; });
      let topCat = 'None';
      let maxCnt = 0;
      Object.entries(countMap).forEach(([k, v]) => {
        if (v > maxCnt) { maxCnt = v; topCat = k; }
      });
      const topPct = totalRows > 0 ? Math.round((maxCnt / totalRows) * 100) : 0;

      kpis.push({
        label: `Distinct ${col.replace(/_/g, ' ').toUpperCase()}`,
        value: uniqueCount.toLocaleString(),
        subtitle: `Top: ${topCat} (${topPct}%)`,
        type: 'dimension'
      });
    });
  }

  // 3. Build Multi-Visual Power BI Canvas Data Structures

  let primaryChart = { title: '', data: [], xKey: '', yKeys: [], type: 'bar' };
  let secondaryChart = { title: '', data: [], nameKey: '', valKey: '', type: 'donut' };
  let matrix = { rowKey: '', colKey: '', matrixData: [] };

  if (numericCols.length > 0 && textCols.length > 0) {
    // Case A: Mixed (Numeric + Categorical) -> Group by primary text column and sum numeric metrics
    const primaryDim = textCols[0];
    const secondaryDim = textCols[1] || textCols[0];
    const metric = numericCols[0];

    // Primary Visual: Bar chart of metric by primary dimension
    const groupMap = {};
    rows.forEach(r => {
      const key = String(r[primaryDim] || 'Other').trim();
      if (!groupMap[key]) groupMap[key] = { [primaryDim]: key };
      numericCols.slice(0, 3).forEach(nc => {
        const val = Number(r[nc]) || 0;
        groupMap[key][nc] = (groupMap[key][nc] || 0) + val;
      });
    });
    primaryChart = {
      title: `${numericCols.join(' & ').replace(/_/g, ' ')} by ${primaryDim.replace(/_/g, ' ')}`,
      data: Object.values(groupMap),
      xKey: primaryDim,
      yKeys: numericCols.slice(0, 3),
      type: 'bar'
    };

    // Secondary Visual: Donut chart by secondary dimension (or primary)
    const donutMap = {};
    rows.forEach(r => {
      const key = String(r[secondaryDim] || 'Other').trim();
      donutMap[key] = (donutMap[key] || 0) + (Number(r[metric]) || 1);
    });
    secondaryChart = {
      title: `${metric.replace(/_/g, ' ')} Share by ${secondaryDim.replace(/_/g, ' ')}`,
      data: Object.entries(donutMap).map(([name, val]) => ({ name, value: Math.round(val * 100) / 100 })),
      nameKey: 'name',
      valKey: 'value',
      type: 'donut'
    };

    // Matrix Cross-Tab (if 2+ dimensions exist)
    if (textCols.length >= 2) {
      const rDim = textCols[0];
      const cDim = textCols[1];
      const pivotMap = {};
      rows.forEach(r => {
        const rVal = String(r[rDim] || 'Other').trim();
        const cVal = String(r[cDim] || 'Other').trim();
        if (!pivotMap[rVal]) pivotMap[rVal] = { [rDim]: rVal };
        pivotMap[rVal][cVal] = (pivotMap[rVal][cVal] || 0) + (Number(r[metric]) || 1);
      });
      matrix = {
        rowKey: rDim,
        colKey: cDim,
        matrixData: Object.values(pivotMap)
      };
    }
  } else if (textCols.length > 0) {
    // Case B: Pure Categorical (e.g. segment, country) -> Compute Frequency Distributions
    const primaryDim = textCols[0];
    const secondaryDim = textCols[1] || textCols[0];

    // Primary Visual: Frequency Bar Chart for Dimension 1
    const freq1 = {};
    rows.forEach(r => {
      const key = String(r[primaryDim] || 'Unknown').trim();
      freq1[key] = (freq1[key] || 0) + 1;
    });
    primaryChart = {
      title: `Record Volume by ${primaryDim.replace(/_/g, ' ').toUpperCase()}`,
      data: Object.entries(freq1).map(([k, v]) => ({ [primaryDim]: k, 'Record Count': v })),
      xKey: primaryDim,
      yKeys: ['Record Count'],
      type: 'bar'
    };

    // Secondary Visual: Frequency Donut Chart for Dimension 2
    const freq2 = {};
    rows.forEach(r => {
      const key = String(r[secondaryDim] || 'Unknown').trim();
      freq2[key] = (freq2[key] || 0) + 1;
    });
    secondaryChart = {
      title: `Distribution by ${secondaryDim.replace(/_/g, ' ').toUpperCase()}`,
      data: Object.entries(freq2).map(([name, value]) => ({ name, value })),
      nameKey: 'name',
      valKey: 'value',
      type: 'donut'
    };

    // Matrix Cross-Tab Frequency (if 2+ dimensions)
    if (textCols.length >= 2) {
      const rDim = textCols[0];
      const cDim = textCols[1];
      const pivotMap = {};
      rows.forEach(r => {
        const rVal = String(r[rDim] || 'Unknown').trim();
        const cVal = String(r[cDim] || 'Unknown').trim();
        if (!pivotMap[rVal]) pivotMap[rVal] = { [rDim]: rVal };
        pivotMap[rVal][cVal] = (pivotMap[rVal][cVal] || 0) + 1;
      });
      matrix = {
        rowKey: rDim,
        colKey: cDim,
        matrixData: Object.values(pivotMap)
      };
    }
  } else {
    // Case C: Pure Numeric
    primaryChart = {
      title: 'Metrics Distribution',
      data: rows.map((r, i) => ({ Index: `Row ${i + 1}`, ...r })),
      xKey: 'Index',
      yKeys: numericCols.slice(0, 4),
      type: 'bar'
    };
  }

  return {
    sql,
    question,
    executionTimeMs,
    totalRows,
    columns,
    rows,
    kpis,
    visuals: {
      primaryChart,
      secondaryChart,
      matrix,
      slicers
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
