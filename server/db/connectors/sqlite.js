const initSqlJs = require('sql.js');
const Papa = require('papaparse');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const sqliteDatabases = new Map();
let SQL = null;

const getSQL = async () => {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  return SQL;
};

/**
 * Load CSV or Excel file into an in-memory SQLite database via sql.js (pure WASM)
 */
const loadFileIntoSqlite = async (dbKey, fileInput, originalName) => {
  const SqlInstance = await getSQL();
  const db = new SqlInstance.Database();
  const fileName = originalName || (typeof fileInput === 'string' ? fileInput : 'dataset.csv');
  const ext = path.extname(fileName).toLowerCase();

  let tableName = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
  if (!tableName || !/^[a-zA-Z_]/.test(tableName)) {
    tableName = 'dataset_' + tableName;
  }

  let buffer;
  if (Buffer.isBuffer(fileInput)) {
    buffer = fileInput;
  } else if (typeof fileInput === 'string') {
    if (fs.existsSync(fileInput)) {
      buffer = fs.readFileSync(fileInput);
    } else {
      buffer = Buffer.from(fileInput, 'utf8');
    }
  } else {
    throw new Error('Invalid file input provided for SQLite WASM loader.');
  }

  if (ext === '.csv' || ext === '.txt') {
    const fileContent = buffer.toString('utf8');
    const parsed = Papa.parse(fileContent, { header: true, skipEmptyLines: true });

    if (!parsed.data || parsed.data.length === 0) {
      throw new Error('CSV file is empty or invalid.');
    }

    const rawColumns = Object.keys(parsed.data[0]);
    const cleanColumns = rawColumns.map(col => col.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() || 'col');

    const colDefs = cleanColumns.map(col => `"${col}" TEXT`).join(', ');
    db.run(`CREATE TABLE "${tableName}" (${colDefs});`);

    const placeholders = cleanColumns.map(() => '?').join(', ');
    const insertStmt = db.prepare(`INSERT INTO "${tableName}" VALUES (${placeholders});`);

    for (const row of parsed.data) {
      const values = rawColumns.map(col => row[col] !== undefined ? String(row[col]) : null);
      insertStmt.run(values);
    }
    insertStmt.free();
  } else if (ext === '.xlsx' || ext === '.xls') {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Automatically expand merged cells (Pivot tables & grouped headers)
    if (sheet && sheet['!merges']) {
      sheet['!merges'].forEach(merge => {
        const startCell = XLSX.utils.encode_cell(merge.s);
        const cellObj = sheet[startCell];
        if (cellObj && cellObj.v !== undefined && cellObj.v !== null && cellObj.v !== '') {
          for (let R = merge.s.r; R <= merge.e.r; ++R) {
            for (let C = merge.s.c; C <= merge.e.c; ++C) {
              const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
              if (!sheet[cellAddress]) {
                sheet[cellAddress] = { ...cellObj };
              } else if (sheet[cellAddress].v === undefined || sheet[cellAddress].v === null || sheet[cellAddress].v === '') {
                sheet[cellAddress].v = cellObj.v;
              }
            }
          }
        }
      });
    }

    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!jsonData || jsonData.length === 0) {
      throw new Error('Excel sheet is empty or invalid.');
    }

    const rawColumns = Object.keys(jsonData[0]);
    const cleanColumns = rawColumns.map(col => col.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() || 'col');

    const colDefs = cleanColumns.map(col => `"${col}" TEXT`).join(', ');
    db.run(`CREATE TABLE "${tableName}" (${colDefs});`);

    const placeholders = cleanColumns.map(() => '?').join(', ');
    const insertStmt = db.prepare(`INSERT INTO "${tableName}" VALUES (${placeholders});`);

    for (const row of jsonData) {
      const values = rawColumns.map(col => row[col] !== undefined ? String(row[col]) : null);
      insertStmt.run(values);
    }
    insertStmt.free();
  } else if (ext === '.db' || ext === '.sqlite') {
    const loadedDb = new SqlInstance.Database(buffer);
    sqliteDatabases.set(dbKey, loadedDb);
    return loadedDb;
  }

  sqliteDatabases.set(dbKey, db);
  return db;
};

/**
 * Introspect SQLite database
 */
const introspectSqlite = (dbKey) => {
  const db = sqliteDatabases.get(dbKey);
  if (!db) throw new Error(`SQLite database '${dbKey}' not found.`);

  const tablesMeta = db.exec(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%';
  `);

  const tables = [];
  if (tablesMeta.length > 0 && tablesMeta[0].values) {
    for (const row of tablesMeta[0].values) {
      const tableName = row[0];
      const pragmaRes = db.exec(`PRAGMA table_info("${tableName}");`);
      
      const columns = [];
      if (pragmaRes.length > 0 && pragmaRes[0].values) {
        for (const p of pragmaRes[0].values) {
          columns.push({
            name: p[1],
            type: p[2] || 'TEXT',
            nullable: p[3] === 0,
            primaryKey: p[5] === 1
          });
        }
      }

      let sampleRows = [];
      try {
        const sampleRes = db.exec(`SELECT * FROM "${tableName}" LIMIT 5;`);
        if (sampleRes.length > 0) {
          const cols = sampleRes[0].columns;
          sampleRows = sampleRes[0].values.map(vals => {
            const obj = {};
            cols.forEach((c, idx) => { obj[c] = vals[idx]; });
            return obj;
          });
        }
      } catch (e) {
        console.warn(`Could not get sample rows for SQLite table ${tableName}:`, e.message);
      }

      tables.push({
        name: tableName,
        columns,
        sampleRows
      });
    }
  }

  return {
    type: 'sqlite',
    tables
  };
};

/**
 * Execute query against SQLite database with automatic reload on server restart
 */
const executeSqliteQuery = async (dbKey, sql, dataSourceId, originalFileName) => {
  let db = sqliteDatabases.get(dbKey);
  if (!db && dataSourceId) {
    try {
      const { getFileUploadByDataSourceId } = require('../../config/db');
      const fileRecord = await getFileUploadByDataSourceId(dataSourceId);
      if (fileRecord && fileRecord.fileBuffer) {
        db = await loadFileIntoSqlite(dbKey, fileRecord.fileBuffer, fileRecord.originalName || originalFileName);
      }
    } catch (e) {
      console.warn('[SQLite Re-hydration Warning]:', e.message);
    }
  }
  if (!db) throw new Error(`SQLite database '${dbKey}' not found. Please re-upload the file or select a data source.`);

  const startTime = Date.now();
  const res = db.exec(sql);
  const executionTimeMs = Date.now() - startTime;

  if (!res || res.length === 0) {
    return {
      rows: [],
      fields: [],
      rowCount: 0,
      executionTimeMs
    };
  }

  const fields = res[0].columns;
  const rows = res[0].values.map(vals => {
    const obj = {};
    fields.forEach((col, idx) => {
      obj[col] = vals[idx];
    });
    return obj;
  });

  return {
    rows,
    fields,
    rowCount: rows.length,
    executionTimeMs
  };
};

const registerSqliteDb = (dbKey, db) => {
  sqliteDatabases.set(dbKey, db);
  return db;
};

module.exports = {
  loadFileIntoSqlite,
  registerSqliteDb,
  introspectSqlite,
  executeSqliteQuery
};
