const { appQuery, isPgConnected } = require('../config/db');

class DashboardModel {
  static async findAll(userId = null) {
    if (isPgConnected()) {
      let query = `SELECT id, name, description, question, sql, data_source_id AS "dataSourceId", layout, date_range AS "dateRange", auto_refresh AS "autoRefresh", tags, visibility, widgets, user_id AS "userId", created_at AS "createdAt", updated_at AS "updatedAt" FROM dashboards`;
      const params = [];
      if (userId) {
        query += ` WHERE user_id = $1`;
        params.push(String(userId));
      }
      query += ` ORDER BY created_at DESC;`;
      const res = await appQuery(query, params);
      return res.rows.map(r => ({ ...r, _id: r.id.toString() }));
    }
    return [];
  }

  static async create({ name, description, question, sql, dataSourceId, layout = '2x2 Grid', dateRange = 'Last 30 days', autoRefresh = 'Off', tags, visibility = 'Private', widgets = 0, userId = 'anonymous_guest' }) {
    if (isPgConnected()) {
      const res = await appQuery(
        `INSERT INTO dashboards (name, description, question, sql, data_source_id, layout, date_range, auto_refresh, tags, visibility, widgets, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id, name, description, question, sql, data_source_id AS "dataSourceId", layout, date_range AS "dateRange", auto_refresh AS "autoRefresh", tags, visibility, widgets, user_id AS "userId", created_at AS "createdAt";`,
        [name, description || null, question || null, sql || null, dataSourceId || null, layout, dateRange, autoRefresh, tags || null, visibility, Number(widgets) || 0, String(userId)]
      );
      const db = res.rows[0];
      db._id = db.id.toString();
      return db;
    }
  }

  static async update(id, { name, description, question, sql, dataSourceId, layout, dateRange, autoRefresh, tags, visibility, widgets }) {
    if (isPgConnected()) {
      const numId = parseInt(id, 10);
      if (isNaN(numId)) return null;
      const res = await appQuery(
        `UPDATE dashboards 
         SET name = COALESCE($1, name), 
             description = COALESCE($2, description), 
             question = COALESCE($3, question), 
             sql = COALESCE($4, sql), 
             data_source_id = COALESCE($5, data_source_id), 
             layout = COALESCE($6, layout), 
             date_range = COALESCE($7, date_range), 
             auto_refresh = COALESCE($8, auto_refresh), 
             tags = COALESCE($9, tags), 
             visibility = COALESCE($10, visibility), 
             widgets = COALESCE($11, widgets), 
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $12
         RETURNING id, name, description, question, sql, data_source_id AS "dataSourceId", layout, date_range AS "dateRange", auto_refresh AS "autoRefresh", tags, visibility, widgets, user_id AS "userId", updated_at AS "updatedAt";`,
        [name, description, question, sql, dataSourceId, layout, dateRange, autoRefresh, tags, visibility, widgets !== undefined ? Number(widgets) : null, numId]
      );
      if (res.rows.length === 0) return null;
      const db = res.rows[0];
      db._id = db.id.toString();
      return db;
    }
    return null;
  }

  static async delete(id) {
    if (isPgConnected()) {
      const numId = parseInt(id, 10);
      if (isNaN(numId)) return false;
      await appQuery(`DELETE FROM dashboards WHERE id = $1;`, [numId]);
      return true;
    }
    return false;
  }
}

module.exports = DashboardModel;
