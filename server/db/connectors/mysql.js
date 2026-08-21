const mysql = require('mysql2/promise');

const mysqlPools = new Map();

const getMysqlPool = (config) => {
  const key = typeof config === 'string' ? config : `${config.host}:${config.port}:${config.database}:${config.user}`;
  if (!mysqlPools.has(key)) {
    const poolConfig = typeof config === 'string' ? config : { ...config, waitForConnections: true, connectionLimit: 10 };
    const pool = mysql.createPool(poolConfig);
    mysqlPools.set(key, pool);
  }
  return mysqlPools.get(key);
};

const introspectMysql = async (config) => {
  const pool = getMysqlPool(config);
  const [tablesRes] = await pool.query(`SHOW TABLES;`);
  
  const tables = [];
  for (const row of tablesRes) {
    const tableName = Object.values(row)[0];
    const [colsRes] = await pool.query(`DESCRIBE \`${tableName}\`;`);

    const columns = colsRes.map(col => ({
      name: col.Field,
      type: col.Type,
      nullable: col.Null === 'YES',
      primaryKey: col.Key === 'PRI'
    }));

    let sampleRows = [];
    try {
      const [sampleRes] = await pool.query(`SELECT * FROM \`${tableName}\` LIMIT 5;`);
      sampleRows = sampleRes;
    } catch (e) {
      console.warn(`Sample row fetch failed for MySQL table ${tableName}:`, e.message);
    }

    tables.push({
      name: tableName,
      columns,
      sampleRows
    });
  }

  return {
    type: 'mysql',
    tables
  };
};

const executeMysqlQuery = async (config, sql) => {
  const pool = getMysqlPool(config);
  const startTime = Date.now();
  const [rows, fields] = await pool.query(sql);
  const executionTimeMs = Date.now() - startTime;

  return {
    rows,
    fields: fields ? fields.map(f => f.name) : [],
    rowCount: Array.isArray(rows) ? rows.length : 0,
    executionTimeMs
  };
};

module.exports = {
  getMysqlPool,
  introspectMysql,
  executeMysqlQuery
};
