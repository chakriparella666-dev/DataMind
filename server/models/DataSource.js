const { appQuery, isPgConnected } = require('../config/db');

class DataSourceModel {
  static async create({ name, type, connectionConfig, schemaMetadata, userId = 'anonymous_guest' }) {
    if (isPgConnected()) {
      const res = await appQuery(
        `INSERT INTO data_sources (name, type, connection_config, schema_metadata, user_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, type, connection_config AS "connectionConfig", schema_metadata AS "schemaMetadata", status, user_id AS "userId", created_at AS "createdAt";`,
        [name, type, JSON.stringify(connectionConfig), JSON.stringify(schemaMetadata), String(userId)]
      );
      const ds = res.rows[0];
      ds._id = ds.id.toString();
      return ds;
    }
  }

  static async find(userId = null) {
    if (isPgConnected()) {
      let query = `SELECT id, name, type, connection_config AS "connectionConfig", schema_metadata AS "schemaMetadata", status, user_id AS "userId", created_at AS "createdAt"
         FROM data_sources`;
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

  static async findById(id, userId = null) {
    if (isPgConnected()) {
      const numId = parseInt(id, 10);
      if (isNaN(numId)) return null;
      let query = `SELECT id, name, type, connection_config AS "connectionConfig", schema_metadata AS "schemaMetadata", status, user_id AS "userId", created_at AS "createdAt"
         FROM data_sources
         WHERE id = $1`;
      const params = [numId];
      if (userId) {
        query += ` AND user_id = $2`;
        params.push(String(userId));
      }
      const res = await appQuery(query, params);
      if (res.rows.length === 0) return null;
      const ds = res.rows[0];
      ds._id = ds.id.toString();
      return ds;
    }
    return null;
  }

  static async findOne(userId = null) {
    const all = await this.find(userId);
    return all.length > 0 ? all[0] : null;
  }
}

module.exports = DataSourceModel;
