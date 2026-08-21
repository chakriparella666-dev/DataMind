const { validateSql } = require('./services/sqlValidator');
const { selectChartConfig } = require('./services/chartSelector');
const { loadFileIntoSqlite, introspectSqlite, executeSqliteQuery } = require('./db/connectors/sqlite');
const fs = require('fs');
const path = require('path');

console.log('===================================================');
console.log('🧪 RUNNING AUTOMATED PIPELINE & SECURITY VERIFICATION');
console.log('===================================================');

let testPassed = true;

// 1. Security & AST Validation Test
console.log('\n[Test 1] SQL AST Security & Read-Only Guardrails:');
const validQuery = validateSql('SELECT city, COUNT(customer_id) AS total_customers FROM customers GROUP BY city ORDER BY total_customers DESC');
if (validQuery.valid && validQuery.sql.includes('LIMIT 500')) {
  console.log('  ✅ SELECT query validation & auto LIMIT 500 succeeded.');
} else {
  console.error('  ❌ SELECT query validation failed:', validQuery);
  testPassed = false;
}

const dangerousQuery = validateSql('DROP TABLE users; SELECT * FROM customers;');
if (!dangerousQuery.valid) {
  console.log(`  ✅ Dangerous DROP TABLE query blocked correctly: "${dangerousQuery.error}"`);
} else {
  console.error('  ❌ Dangerous query was NOT blocked!');
  testPassed = false;
}

const deleteQuery = validateSql('DELETE FROM orders WHERE 1=1');
if (!deleteQuery.valid) {
  console.log(`  ✅ Dangerous DELETE query blocked correctly: "${deleteQuery.error}"`);
} else {
  console.error('  ❌ Dangerous DELETE query was NOT blocked!');
  testPassed = false;
}

// 2. CSV parsing and In-Memory SQLite Introspection Test
console.log('\n[Test 2] CSV Parsing & In-Memory SQLite Execution:');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const sampleCsvPath = path.join(uploadsDir, 'test_sales.csv');
const sampleCsvData = `city,sales,orders
New York,5400,45
London,4200,38
Tokyo,6100,52
Paris,3900,29
Sydney,3100,22`;

fs.writeFileSync(sampleCsvPath, sampleCsvData, 'utf8');

const runTests = async () => {
  try {
    const dbKey = 'test_db_' + Date.now();
    await loadFileIntoSqlite(dbKey, sampleCsvPath, 'test_sales.csv');
    const schema = introspectSqlite(dbKey);

    if (schema.tables && schema.tables.length > 0) {
      console.log(`  ✅ Successfully introspected CSV table "${schema.tables[0].name}" with ${schema.tables[0].columns.length} columns.`);
    } else {
      console.error('  ❌ CSV introspection failed.');
      testPassed = false;
    }

    const queryRes = executeSqliteQuery(dbKey, 'SELECT city, sales FROM test_sales ORDER BY sales DESC');
    if (queryRes.rows && queryRes.rows.length === 5) {
      console.log(`  ✅ Query execution returned ${queryRes.rowCount} rows cleanly.`);
    } else {
      console.error('  ❌ Query execution failed:', queryRes);
      testPassed = false;
    }

    // 3. Auto Chart Selector Test
    console.log('\n[Test 3] Auto-Chart Selector Engine:');
    const chartConfig = selectChartConfig(queryRes.rows, queryRes.fields);
    if ((chartConfig.chartType === 'bar' || chartConfig.chartType === 'pie') && (chartConfig.xAxisKey === 'city' || chartConfig.nameKey === 'city')) {
      console.log(`  ✅ Auto-Chart Selector correctly mapped data shape to ${chartConfig.chartType.toUpperCase()} CHART.`);
    } else {
      console.error('  ❌ Chart selector test failed:', chartConfig);
      testPassed = false;
    }

  } catch (err) {
    console.error('  ❌ File & SQLite Test Error:', err.message);
    testPassed = false;
  } finally {
    if (fs.existsSync(sampleCsvPath)) {
      fs.unlinkSync(sampleCsvPath);
    }
  }

  console.log('\n===================================================');
  if (testPassed) {
    console.log('🎉 ALL AUTOMATED PIPELINE & SECURITY TESTS PASSED!');
  } else {
    console.error('💥 SOME TESTS FAILED. PLEASE REVIEW LOGS.');
  }
  console.log('===================================================\n');
};

runTests();
