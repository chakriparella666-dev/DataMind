const { Parser } = require('node-sql-parser');

const parser = new Parser();

/**
 * Validates generated SQL for security & read-only constraints
 * @param {string} sql 
 * @param {string} dialect 'postgresql' | 'mysql' | 'sqlite'
 */
const validateSql = (sql, dialect = 'sqlite') => {
  if (!sql || typeof sql !== 'string') {
    return { valid: false, error: 'SQL query must be a non-empty string.' };
  }

  const cleanSql = sql.trim().replace(/;+$/, '');

  // 1. Regex check for dangerous SQL keywords
  const forbiddenRegex = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|GRANT|REVOKE|EXEC|CREATE|SHUTDOWN)\b/i;
  if (forbiddenRegex.test(cleanSql)) {
    return {
      valid: false,
      error: 'Security violation: Query contains non-SELECT data modification commands.'
    };
  }

  // 2. Multi-statement check
  if (cleanSql.includes(';')) {
    return {
      valid: false,
      error: 'Security violation: Multiple SQL statements in a single query are not allowed.'
    };
  }

  // 3. Must start with SELECT or WITH (CTE)
  if (!/^(SELECT|WITH)\s/i.test(cleanSql)) {
    return {
      valid: false,
      error: 'Security violation: Query must be a read-only SELECT statement.'
    };
  }

  // 4. AST Parser Validation
  try {
    const optDialect = dialect === 'postgres' || dialect === 'postgresql' ? 'postgresql' : (dialect === 'mysql' ? 'mysql' : 'bigquery');
    const ast = parser.astify(cleanSql, { database: optDialect });
    
    // Check if AST type is select
    const isSelect = Array.isArray(ast) ? ast.every(item => item.type === 'select') : ast.type === 'select';
    if (!isSelect) {
      return { valid: false, error: 'AST Validation failed: Query is not a valid SELECT statement.' };
    }
  } catch (astErr) {
    // If AST parser fails due to dialect nuances, fall back to safe regex check
    console.warn('[SQL Validator] AST parse warning:', astErr.message);
  }

  // 5. Enforce LIMIT 500 if missing
  let finalSql = cleanSql;
  if (!/\bLIMIT\s+\d+/i.test(finalSql)) {
    finalSql = `${finalSql} LIMIT 500`;
  }

  return {
    valid: true,
    sql: finalSql
  };
};

module.exports = {
  validateSql
};
