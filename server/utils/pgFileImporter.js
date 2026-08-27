const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const Papa = require('papaparse');
const { appQuery } = require('../config/db');

/**
 * Clean column names for PostgreSQL
 */
const sanitizeColName = (name, index) => {
  if (!name || typeof name !== 'string') return `col_${index + 1}`;
  let clean = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
  clean = clean.replace(/^_+|_+$/g, '');
  if (!clean || /^[0-9]/.test(clean)) clean = `col_${clean || index + 1}`;
  return clean;
};

/**
 * Clean table names for PostgreSQL
 */
const sanitizeTableName = (filename) => {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let clean = base.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
  clean = clean.slice(0, 25);
  return `tbl_${clean}_${Date.now().toString().slice(-6)}`;
};

/**
 * Import uploaded CSV/Excel file directly into PostgreSQL datamind_app database
 */
const importFileToPostgres = async (fileBufferOrPath, originalName) => {
  const ext = path.extname(originalName).toLowerCase();
  let sheets = {};
  const isBuffer = Buffer.isBuffer(fileBufferOrPath);

  if (ext === '.csv') {
    const fileContent = isBuffer ? fileBufferOrPath.toString('utf8') : fs.readFileSync(fileBufferOrPath, 'utf8');
    const parsed = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
    sheets[path.basename(originalName, ext)] = parsed.data;
  } else if (ext === '.xlsx' || ext === '.xls') {
    const workbook = isBuffer
      ? XLSX.read(fileBufferOrPath, { type: 'buffer' })
      : XLSX.readFile(fileBufferOrPath);
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (data && data.length > 0) {
        sheets[sheetName] = data;
      }
    }
  }

  const tablesMetadata = [];
  const createdTables = [];

  for (const [rawSheetName, rows] of Object.entries(sheets)) {
    if (!rows || rows.length === 0) continue;

    const tableName = sanitizeTableName(rawSheetName);
    const rawCols = Object.keys(rows[0] || {});
    const columns = [];

    rawCols.forEach((rawCol, idx) => {
      const colName = sanitizeColName(rawCol, idx);
      columns.push({ name: colName, rawName: rawCol, type: 'TEXT' });
    });

    // Create table in PostgreSQL
    const colDefs = columns.map(c => `"${c.name}" TEXT`).join(', ');
    const createTableSql = `CREATE TABLE IF NOT EXISTS "${tableName}" (id SERIAL PRIMARY KEY, ${colDefs});`;
    await appQuery(createTableSql);

    // Batch insert rows in PostgreSQL using transactions for high performance
    const BATCH_SIZE = 500;
    const colNamesSql = columns.map(c => `"${c.name}"`).join(', ');

    if (rows.length > 0 && columns.length > 0) {
      await appQuery('BEGIN;');
      try {
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const chunk = rows.slice(i, i + BATCH_SIZE);
          const valueClauses = [];
          const params = [];
          let paramIdx = 1;

          for (const row of chunk) {
            const rowPlaceholders = [];
            for (const col of columns) {
              rowPlaceholders.push(`$${paramIdx++}`);
              const rawVal = row[col.rawName];
              params.push(rawVal !== undefined && rawVal !== null ? String(rawVal) : null);
            }
            valueClauses.push(`(${rowPlaceholders.join(', ')})`);
          }

          const batchInsertSql = `INSERT INTO "${tableName}" (${colNamesSql}) VALUES ${valueClauses.join(', ')};`;
          await appQuery(batchInsertSql, params);
        }
        await appQuery('COMMIT;');
      } catch (insertErr) {
        await appQuery('ROLLBACK;');
        throw insertErr;
      }
    }

    tablesMetadata.push({
      name: tableName,
      rawSheetName: rawSheetName,
      columns: columns.map(c => ({ name: c.name, rawName: c.rawName, type: 'TEXT' }))
    });
    createdTables.push(tableName);
  }

  // If a temporary string path was provided, safely clean it up
  if (typeof fileBufferOrPath === 'string') {
    try {
      if (fs.existsSync(fileBufferOrPath)) {
        fs.unlinkSync(fileBufferOrPath);
      }
    } catch (e) {}
  }

  return {
    tables: tablesMetadata,
    createdTables
  };
};

module.exports = {
  importFileToPostgres,
  sanitizeTableName,
  sanitizeColName
};
