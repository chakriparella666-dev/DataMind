const { appQuery, isPgConnected } = require('../config/db');

class DashboardModel {
  static async findAll(userId = null) {
    if (isPgConnected()) {
      let query = `SELECT id, name, visibility, widgets, user_id AS "userId", created_at AS "createdAt", updated_at AS "updatedAt" FROM dashboards`;
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

  static async create({ name, visibility = 'Private', widgets = 0, userId = 'anonymous_guest' }) {
    if (isPgConnected()) {
      const res = await appQuery(
        `INSERT INTO dashboards (name, visibility, widgets, user_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, visibility, widgets, user_id AS "userId", created_at AS "createdAt";`,
        [name, visibility, Number(widgets) || 0, String(userId)]
      );
      const db = res.rows[0];
      db._id = db.id.toString();
      return db;
    }
  }

  static async update(id, { name, visibility, widgets }) {
    if (isPgConnected()) {
      const numId = parseInt(id, 10);
      if (isNaN(numId)) return null;
      const res = await appQuery(
        `UPDATE dashboards SET name = $1, visibility = $2, widgets = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING id, name, visibility, widgets, user_id AS "userId", updated_at AS "updatedAt";`,
        [name, visibility, Number(widgets) || 0, numId]
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
