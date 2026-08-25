const { appQuery, isPgConnected } = require('../config/db');

class ChatSessionModel {
  static async findOne({ sessionId, userId = null }) {
    if (isPgConnected()) {
      let query = `SELECT id, session_id AS "sessionId", title, mode, data_source_id AS "dataSourceId", user_id AS "userId", created_at AS "createdAt", updated_at AS "updatedAt"
         FROM chat_sessions
         WHERE session_id = $1`;
      const params = [sessionId];
      if (userId) {
        query += ` AND user_id = $2`;
        params.push(String(userId));
      }
      const res = await appQuery(query, params);
      if (res.rows.length === 0) return null;
      const session = res.rows[0];
      session._id = session.id.toString();

      // Fetch Messages
      const msgRes = await appQuery(
        `SELECT id, session_id AS "sessionId", sender, text, intent, sql, explanation, data, fields, chart_config AS "chartConfig", self_corrected AS "selfCorrected", error, created_at AS "timestamp"
         FROM chat_messages
         WHERE session_id = $1
         ORDER BY id ASC;`,
        [sessionId]
      );
      session.messages = msgRes.rows;
      return session;
    }
    return null;
  }

  static async create({ sessionId, title = 'New Chat', mode = 'sql', dataSourceId, userId = 'anonymous_guest' }) {
    if (isPgConnected()) {
      const res = await appQuery(
        `INSERT INTO chat_sessions (session_id, title, mode, data_source_id, user_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (session_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
         RETURNING id, session_id AS "sessionId", title, mode, data_source_id AS "dataSourceId", user_id AS "userId", created_at AS "createdAt";`,
        [sessionId, title, mode, dataSourceId, String(userId)]
      );
      const session = res.rows[0];
      session._id = session.id.toString();
      session.messages = [];
      return session;
    }
  }

  static async addMessage(sessionId, msg) {
    if (isPgConnected()) {
      await appQuery(
        `INSERT INTO chat_messages (session_id, sender, text, intent, sql, explanation, data, fields, chart_config, self_corrected, error, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`,
        [
          sessionId,
          msg.sender,
          msg.text || null,
          msg.intent || null,
          msg.sql || null,
          msg.explanation || null,
          msg.data ? JSON.stringify(msg.data) : null,
          msg.fields ? JSON.stringify(msg.fields) : null,
          msg.chartConfig ? JSON.stringify(msg.chartConfig) : null,
          msg.selfCorrected || false,
          msg.error || null,
          msg.userId || 'anonymous_guest'
        ]
      );
      await appQuery(`UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE session_id = $1;`, [sessionId]);
    }
  }

  static async find(userId = null) {
    if (isPgConnected()) {
      let query = `SELECT id, session_id AS "sessionId", title, mode, data_source_id AS "dataSourceId", user_id AS "userId", created_at AS "createdAt", updated_at AS "updatedAt"
         FROM chat_sessions`;
      const params = [];
      if (userId) {
        query += ` WHERE user_id = $1`;
        params.push(String(userId));
      }
      query += ` ORDER BY updated_at DESC LIMIT 20;`;
      const res = await appQuery(query, params);
      const sessions = res.rows.map(r => ({ ...r, _id: r.id.toString() }));

      for (const session of sessions) {
        try {
          const msgRes = await appQuery(
            `SELECT id, sender, text, intent, sql, explanation, data, fields, chart_config AS "chartConfig", self_corrected AS "selfCorrected", error, created_at AS "timestamp"
             FROM chat_messages
             WHERE session_id = $1
             ORDER BY id DESC LIMIT 5;`,
            [session.sessionId]
          );
          const msgs = msgRes.rows.reverse();
          const userMsg = msgs.find(m => m.sender === 'user');
          const agentMsg = [...msgs].reverse().find(m => m.sender === 'agent');

          session.question = userMsg ? userMsg.text : (session.title || '');
          if (agentMsg) {
            session.sql = agentMsg.sql;
            session.explanation = agentMsg.explanation;
            session.data = agentMsg.data;
            session.rows = agentMsg.data;
            session.fields = agentMsg.fields;
            session.columns = agentMsg.fields;
            session.rowCount = agentMsg.data ? agentMsg.data.length : 0;
            session.executionTimeMs = 180;
          }
        } catch (e) { }
      }
      return sessions;
    }
    return [];
  }

  static async delete(sessionId, userId = null) {
    if (isPgConnected()) {
      await appQuery(`DELETE FROM chat_messages WHERE session_id = $1 OR session_id IN (SELECT session_id FROM chat_sessions WHERE id::text = $1);`, [sessionId]);
      await appQuery(`DELETE FROM chat_sessions WHERE session_id = $1 OR id::text = $1;`, [sessionId]);
      return true;
    }
    return true;
  }
}

module.exports = ChatSessionModel;
