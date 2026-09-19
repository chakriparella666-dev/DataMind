const { appQuery, isPgConnected } = require('../config/db');

// Built-in interactive sample reports for instant exploration
const SAMPLE_REPORTS = [
  {
    id: 'sample-pbi-1',
    _id: 'sample-pbi-1',
    name: 'Executive Sales & Revenue Overview',
    description: 'High-level executive metrics covering MRR, ARR, regional sales distribution, and quarterly margin growth.',
    category: 'Sales & Revenue',
    embedType: 'embed_url',
    embedUrl: 'https://app.powerbi.com/view?r=eyJrIjoiOGFiN2ZhNzYtZDYxMy00OTI3LWI4ODctOGZkNDljZDM2MDliIiwidCI6IjNlYjA2MDQxLTMwYzItNGNmYS05MTQ3LTNmZDVhNTViODVlOCIsImMiOjZ9',
    datasetName: 'Global Enterprise Sales Model',
    tags: 'Executive, Revenue, Sales, KPI',
    visibility: 'Public Showcase',
    isSample: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'sample-pbi-2',
    _id: 'sample-pbi-2',
    name: 'Customer Profitability & Product Analytics',
    description: 'Deep-dive interactive report analyzing product categories, customer segmentation, and gross profit breakdown.',
    category: 'Product Analytics',
    embedType: 'embed_url',
    embedUrl: 'https://app.powerbi.com/view?r=eyJrIjoiOTI3ODcwZTItNDM5Ni00NmEyLTk1YzUtNDliNmRhMTRmNjVhIiwidCI6IjNlYjA2MDQxLTMwYzItNGNmYS05MTQ3LTNmZDVhNTViODVlOCIsImMiOjZ9',
    datasetName: 'Product & Customer Margins',
    tags: 'Products, Customers, Profitability',
    visibility: 'Public Showcase',
    isSample: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'sample-pbi-3',
    _id: 'sample-pbi-3',
    name: 'Supply Chain & Inventory Operations',
    description: 'Real-time inventory levels, vendor performance scorecards, and logistics fulfillment speed.',
    category: 'Operations',
    embedType: 'embed_url',
    embedUrl: 'https://app.powerbi.com/view?r=eyJrIjoiYTI1MWZjMzMtM2NlYy00MTU3LWEzMTMtZTQ3ZDU2MWU3NDI3IiwidCI6IjNlYjA2MDQxLTMwYzItNGNmYS05MTQ3LTNmZDVhNTViODVlOCIsImMiOjZ9',
    datasetName: 'Global Logistics & Inventory',
    tags: 'Supply Chain, Logistics, Operations',
    visibility: 'Public Showcase',
    isSample: true,
    createdAt: new Date().toISOString()
  }
];

class PowerBIReportModel {
  static async findAll(userId = null) {
    if (isPgConnected()) {
      let query = `
        SELECT id, name, description, category, embed_type AS "embedType", 
               embed_url AS "embedUrl", report_id AS "reportId", workspace_id AS "workspaceId",
               client_id AS "clientId", tenant_id AS "tenantId", dataset_name AS "datasetName",
               tags, visibility, user_id AS "userId", created_at AS "createdAt", updated_at AS "updatedAt"
        FROM powerbi_reports
      `;
      const params = [];
      if (userId) {
        query += ` WHERE user_id = $1 OR visibility = 'Public' OR visibility = 'Public Showcase'`;
        params.push(String(userId));
      }
      query += ` ORDER BY created_at DESC;`;

      const res = await appQuery(query, params);
      const userReports = res.rows.map(r => ({ ...r, _id: r.id.toString(), isSample: false }));
      
      // Combine user reports with sample reports for a rich out-of-the-box experience
      return [...userReports, ...SAMPLE_REPORTS];
    }
    return SAMPLE_REPORTS;
  }

  static async findById(id) {
    const sample = SAMPLE_REPORTS.find(s => String(s.id) === String(id));
    if (sample) return sample;

    if (isPgConnected()) {
      const numId = parseInt(id, 10);
      if (isNaN(numId)) return null;
      const res = await appQuery(
        `SELECT id, name, description, category, embed_type AS "embedType", 
                embed_url AS "embedUrl", report_id AS "reportId", workspace_id AS "workspaceId",
                client_id AS "clientId", client_secret AS "clientSecret", tenant_id AS "tenantId", 
                dataset_name AS "datasetName", tags, visibility, user_id AS "userId", 
                created_at AS "createdAt", updated_at AS "updatedAt"
         FROM powerbi_reports WHERE id = $1;`,
        [numId]
      );
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return { ...r, _id: r.id.toString(), isSample: false };
    }
    return null;
  }

  static async create({
    name,
    description,
    category = 'Executive',
    embedType = 'embed_url',
    embedUrl,
    reportId,
    workspaceId,
    clientId,
    clientSecret,
    tenantId,
    datasetName,
    tags,
    visibility = 'Private',
    userId = 'default_user'
  }) {
    if (isPgConnected()) {
      const res = await appQuery(
        `INSERT INTO powerbi_reports 
         (name, description, category, embed_type, embed_url, report_id, workspace_id, client_id, client_secret, tenant_id, dataset_name, tags, visibility, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id, name, description, category, embed_type AS "embedType", 
                   embed_url AS "embedUrl", report_id AS "reportId", workspace_id AS "workspaceId",
                   client_id AS "clientId", tenant_id AS "tenantId", dataset_name AS "datasetName",
                   tags, visibility, user_id AS "userId", created_at AS "createdAt";`,
        [
          name,
          description || null,
          category || 'Executive',
          embedType || 'embed_url',
          embedUrl,
          reportId || null,
          workspaceId || null,
          clientId || null,
          clientSecret || null,
          tenantId || null,
          datasetName || null,
          tags || null,
          visibility || 'Private',
          String(userId)
        ]
      );
      const row = res.rows[0];
      return { ...row, _id: row.id.toString(), isSample: false };
    }
    throw new Error('Database is not connected');
  }

  static async update(id, data) {
    if (isPgConnected()) {
      const numId = parseInt(id, 10);
      if (isNaN(numId)) return null;

      const {
        name,
        description,
        category,
        embedType,
        embedUrl,
        reportId,
        workspaceId,
        clientId,
        clientSecret,
        tenantId,
        datasetName,
        tags,
        visibility
      } = data;

      const res = await appQuery(
        `UPDATE powerbi_reports
         SET name = COALESCE($1, name),
             description = COALESCE($2, description),
             category = COALESCE($3, category),
             embed_type = COALESCE($4, embed_type),
             embed_url = COALESCE($5, embed_url),
             report_id = COALESCE($6, report_id),
             workspace_id = COALESCE($7, workspace_id),
             client_id = COALESCE($8, client_id),
             client_secret = COALESCE($9, client_secret),
             tenant_id = COALESCE($10, tenant_id),
             dataset_name = COALESCE($11, dataset_name),
             tags = COALESCE($12, tags),
             visibility = COALESCE($13, visibility),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $14
         RETURNING id, name, description, category, embed_type AS "embedType", 
                   embed_url AS "embedUrl", report_id AS "reportId", workspace_id AS "workspaceId",
                   client_id AS "clientId", tenant_id AS "tenantId", dataset_name AS "datasetName",
                   tags, visibility, user_id AS "userId", updated_at AS "updatedAt";`,
        [
          name,
          description,
          category,
          embedType,
          embedUrl,
          reportId,
          workspaceId,
          clientId,
          clientSecret,
          tenantId,
          datasetName,
          tags,
          visibility,
          numId
        ]
      );
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return { ...row, _id: row.id.toString(), isSample: false };
    }
    return null;
  }

  static async delete(id) {
    // If it's a sample report, return true (cannot delete sample permanently)
    if (SAMPLE_REPORTS.some(s => String(s.id) === String(id))) {
      return true;
    }

    if (isPgConnected()) {
      const numId = parseInt(id, 10);
      if (isNaN(numId)) return false;
      await appQuery(`DELETE FROM powerbi_reports WHERE id = $1;`, [numId]);
      return true;
    }
    return false;
  }
}

module.exports = PowerBIReportModel;
