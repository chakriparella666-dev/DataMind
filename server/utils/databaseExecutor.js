const { appQuery, isPgConnected } = require('../config/db');
const { executeSqliteQuery } = require('../db/connectors/sqlite');
const { executePostgresQuery } = require('../db/connectors/postgres');
const { executeMysqlQuery } = require('../db/connectors/mysql');

/**
 * Execute read-only SQL query directly against PostgreSQL App DB or external database
 */
const runQueryOnDb = async (dataSource, sql) => {
  if (!dataSource) {
    throw new Error('No active database connected.');
  }

  const type = dataSource.type || 'postgres';
  const config = dataSource.connectionConfig || {};

  // Primary execution mode: Direct execution inside PostgreSQL app DB
  if (isPgConnected()) {
    try {
      const t0 = Date.now();
      const res = await appQuery(sql);
      const executionTimeMs = Date.now() - t0;
      const fields = (res.fields || []).map(f => ({ name: f.name, dataType: f.dataTypeID }));
      return {
        data: res.rows,
        fields,
        rowCount: res.rowCount,
        executionTimeMs
      };
    } catch (pgErr) {
      if (type === 'postgres' && config.host) {
        const result = await executePostgresQuery(config, sql);
        return {
          data: result.rows,
          fields: result.fields,
          rowCount: result.rowCount,
          executionTimeMs: result.executionTimeMs
        };
      }
      if (type === 'sqlite' || type === 'excel' || type === 'csv') {
        const dbKey = config.dbKey;
        if (dbKey) {
          const result = await executeSqliteQuery(dbKey, sql, config.filePath, config.originalFileName);
          return {
            data: result.rows,
            fields: result.fields,
            rowCount: result.rowCount,
            executionTimeMs: result.executionTimeMs
          };
        }
      }
      throw pgErr;
    }
  }

  if (type === 'postgres') {
    const result = await executePostgresQuery(config, sql);
    return {
      data: result.rows,
      fields: result.fields,
      rowCount: result.rowCount,
      executionTimeMs: result.executionTimeMs
    };
  }

  if (type === 'mysql') {
    const result = await executeMysqlQuery(config, sql);
    return {
      data: result.rows,
      fields: result.fields,
      rowCount: result.rowCount,
      executionTimeMs: result.executionTimeMs
    };
  }

  throw new Error(`Unsupported data source type '${type}'.`);
};

module.exports = {
  runQueryOnDb
};
