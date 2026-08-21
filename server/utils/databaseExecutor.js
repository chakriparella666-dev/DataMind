const { executeSqliteQuery } = require('../db/connectors/sqlite');
const { executePostgresQuery } = require('../db/connectors/postgres');
const { executeMysqlQuery } = require('../db/connectors/mysql');

/**
 * Execute read-only SQL query against the given DataSource
 */
const runQueryOnDb = async (dataSource, sql) => {
  if (!dataSource) {
    throw new Error('No active database connected.');
  }

  const type = dataSource.type || 'sqlite';
  const config = dataSource.connectionConfig || {};

  if (type === 'sqlite' || type === 'excel' || type === 'csv') {
    const dbKey = config.dbKey;
    if (!dbKey) {
      throw new Error(`Data source '${dataSource.name}' is missing SQLite key.`);
    }
    const result = await executeSqliteQuery(dbKey, sql, dataSource.id || dataSource._id, config.originalFileName);
    return {
      data: result.rows,
      fields: result.fields,
      rowCount: result.rowCount,
      executionTimeMs: result.executionTimeMs
    };
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
