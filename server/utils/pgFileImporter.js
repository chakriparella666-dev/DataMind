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
const importFileToPostgres = async (filePath, originalName) => {
  const ext = path.extname(originalName).toLowerCase();
  let sheets = {};

  if (ext === '.csv') {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const parsed = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
    sheets[path.basename(originalName, ext)] = parsed.data;
  } else if (ext === '.xlsx' || ext === '.xls') {
    const workbook = XLSX.readFile(filePath);
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

    // Insert rows
    for (const row of rows) {
      const valCols = [];
      const placeholders = [];
      const params = [];
      let pIdx = 1;

      columns.forEach(col => {
        valCols.push(`"${col.name}"`);
        placeholders.push(`$${pIdx++}`);
        const rawVal = row[col.rawName];
        params.push(rawVal !== undefined && rawVal !== null ? String(rawVal) : null);
      });

      if (valCols.length > 0) {
        const insertSql = `INSERT INTO "${tableName}" (${valCols.join(', ')}) VALUES (${placeholders.join(', ')});`;
        await appQuery(insertSql, params);
      }
    }

    tablesMetadata.push({
      name: tableName,
      columns: columns.map(c => ({ name: c.name, type: 'TEXT' }))
    });
    createdTables.push(tableName);
  }

  // Delete temp file after successful import into PostgreSQL
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (e) {}

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
