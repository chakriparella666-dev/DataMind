const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'datamind_jwt_secret_key_2026';

const getUserIdFromReq = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded && (decoded.id || decoded.email)) {
        return decoded.id || decoded.email;
      }
    } catch (e) {}
  }
  if (req.headers['x-guest-id']) {
    return req.headers['x-guest-id'];
  }
  return req.headers['x-user-id'] || req.headers['x-user-email'] || 'anonymous_guest';
};

// 1. Generate Standard Power BI Data Source (.pbids) File Structure
// Note: PBIDS specification requires NO 'query' property inside details.
router.post('/pbids', async (req, res) => {
  try {
    const { question, sql, type = 'postgresql', dbName = 'datamind_analytics', host = 'localhost', port = '5432' } = req.body;

    let pbidsContent;

    if (type === 'web') {
      const protocolUrl = `http://${host}:${process.env.PORT || 5000}/api/powerbi/export-csv`;
      pbidsContent = {
        version: "0.1",
        connections: [
          {
            details: {
              protocol: "web",
              address: {
                url: protocolUrl
              }
            },
            options: {
              name: question ? `DataMind AI Web Feed: ${question.substring(0, 40)}` : "DataMind AI Web Connection"
            },
            mode: null
          }
        ]
      };
    } else {
      // Standard PostgreSQL PBIDS specification (compliant with Power BI Desktop parser)
      pbidsContent = {
        version: "0.1",
        connections: [
          {
            details: {
              protocol: "postgresql",
              address: {
                server: `${host}:${port}`,
                database: dbName
              }
            },
            options: {
              name: question ? `DataMind AI: ${question.substring(0, 40)}` : "DataMind AI Connection"
            },
            mode: "DirectQuery"
          }
        ]
      };
    }

    res.json({
      success: true,
      filename: `datamind_powerbi_${type}_${Date.now()}.pbids`,
      pbids: pbidsContent
    });
  } catch (error) {
    console.error('Error generating PBIDS file:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to generate PBIDS' });
  }
});

// 2. Generate Power Query M Script for Power BI Desktop Advanced Editor
router.post('/m-query', async (req, res) => {
  try {
    const { question, sql, data = [], fields = [], host = 'localhost', port = '5432', database = 'datamind_analytics' } = req.body;

    const cleanSql = sql ? sql.trim().replace(/"/g, '""').replace(/\n/g, ' ') : 'SELECT * FROM analytics_table';
    
    // Generate Power Query (M Language) script for direct PostgreSQL query
    const mScriptDirect = `let
    // Power Query M Script generated automatically by DataMind AI Platform
    // Query: "${question || 'SQL Query Result'}"
    Source = PostgreSQL.Database("${host}:${port}", "${database}", [Query="${cleanSql}"])
in
    Source`;

    const sampleRow = (data && data.length > 0) ? data[0] : {};
    const columns = (fields && fields.length > 0 ? fields : Object.keys(sampleRow)).map(f => typeof f === 'string' ? f : (f?.name || String(f)));
    const safeCols = columns.length > 0 ? columns : ['id', 'name', 'value'];

    const columnTypeTransformations = safeCols.map(c => `{"${c}", type text}`).join(', ');

    const webFeedUrl = `http://${host}:${process.env.PORT || 5000}/api/powerbi/export-csv`;

    const mScriptWeb = `let
    // Power Query M Script for DataMind Web Export API Feed
    Source = Csv.Document(Web.Contents("${webFeedUrl}"), [Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.Csv]),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers", {${columnTypeTransformations}})
in
    #"Changed Type"`;

    res.json({
      success: true,
      mScriptDirect,
      mScriptWeb
    });
  } catch (error) {
    console.error('Error generating M Query:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to generate M Query' });
  }
});

// 3. Generate Power BI REST API Push Dataset Payload & Sync Spec
router.post('/push-dataset', async (req, res) => {
  try {
    const { datasetName = 'DataMind_AI_Answers', question, data = [], fields = [] } = req.body;

    const sampleRow = (data && data.length > 0) ? data[0] : {};
    const rawKeys = (fields && fields.length > 0) ? fields.map(f => typeof f === 'string' ? f : (f?.name || String(f))) : Object.keys(sampleRow);
    const colKeys = rawKeys.length > 0 ? rawKeys : ['id', 'metric', 'value', 'created_at'];

    // Map JS data types to Power BI Push Dataset column data types
    const columnsSchema = colKeys.map(key => {
      const val = sampleRow[key];
      let pbiType = 'String';
      if (typeof val === 'number') {
        pbiType = Number.isInteger(val) ? 'Int64' : 'Double';
      } else if (typeof val === 'boolean') {
        pbiType = 'Boolean';
      } else if (val instanceof Date || (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val))) {
        pbiType = 'DateTime';
      }
      return { name: key, dataType: pbiType };
    });

    const pushDatasetPayload = {
      name: datasetName,
      defaultMode: "Push",
      tables: [
        {
          name: question ? question.substring(0, 40).replace(/[^a-zA-Z0-9_ ]/g, '') : "QueryResult",
          columns: columnsSchema
        }
      ]
    };

    res.json({
      success: true,
      powerBiApiEndpoint: "https://api.powerbi.com/v1.0/myorg/groups/{groupId}/datasets",
      headersRequired: {
        "Authorization": "Bearer YOUR_POWER_BI_AZURE_AD_TOKEN",
        "Content-Type": "application/json"
      },
      pushDatasetPayload,
      rowsToPush: data || [],
      totalRows: (data || []).length
    });
  } catch (error) {
    console.error('Error creating Power BI push dataset schema:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create Push Dataset payload' });
  }
});

// 4. GET /api/powerbi/export-csv - Web Feed for Power BI Web PBIDS & M Code
router.get('/export-csv', (req, res) => {
  const sampleCsv = `id,category,metric_value,date\n1,Sales,15400.50,2026-01-15\n2,Marketing,8200.00,2026-02-10\n3,Operations,12300.75,2026-03-05`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="datamind_powerbi_feed.csv"');
  res.send(sampleCsv);
});

module.exports = router;
