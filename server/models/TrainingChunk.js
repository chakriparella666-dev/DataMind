const { appQuery, inMemoryAppDb, isPgConnected } = require('../config/db');

class TrainingChunkModel {
  static async create({ dataSourceId, chunkType, content, metadata = {}, embedding = [] }) {
    if (isPgConnected()) {
      const res = await appQuery(
        `INSERT INTO training_chunks (data_source_id, chunk_type, content, metadata, embedding)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, data_source_id AS "dataSourceId", chunk_type AS "chunkType", content, metadata, embedding, created_at AS "createdAt";`,
        [dataSourceId, chunkType, content, JSON.stringify(metadata), JSON.stringify(embedding)]
      );
      const chunk = res.rows[0];
      chunk._id = chunk.id.toString();
      return chunk;
    } else {
      const chunk = {
        _id: 'tc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        dataSourceId,
        chunkType,
        content,
        metadata,
        embedding,
        createdAt: new Date()
      };
      inMemoryAppDb.trainingChunks.unshift(chunk);
      return chunk;
    }
  }

  static async find(filter = {}) {
    if (isPgConnected()) {
      let query = `SELECT id, data_source_id AS "dataSourceId", chunk_type AS "chunkType", content, metadata, embedding, created_at AS "createdAt" FROM training_chunks`;
      const params = [];
      if (filter.dataSourceId) {
        query += ` WHERE data_source_id = $1`;
        params.push(filter.dataSourceId);
      }
      query += ` ORDER BY created_at DESC;`;

      const res = await appQuery(query, params);
      return res.rows.map(r => ({ ...r, _id: r.id.toString() }));
    } else {
      let list = inMemoryAppDb.trainingChunks;
      if (filter.dataSourceId) {
        list = list.filter(c => c.dataSourceId === filter.dataSourceId);
      }
      return list;
    }
  }

  static async findByIdAndDelete(id) {
    if (isPgConnected()) {
      const numId = parseInt(id, 10);
      if (!isNaN(numId)) {
        await appQuery(`DELETE FROM training_chunks WHERE id = $1;`, [numId]);
      }
    } else {
      inMemoryAppDb.trainingChunks = inMemoryAppDb.trainingChunks.filter(c => c._id !== id && String(c.id) !== String(id));
    }
    return true;
  }
}

module.exports = TrainingChunkModel;
