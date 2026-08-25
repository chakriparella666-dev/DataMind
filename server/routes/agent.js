const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const DataSource = require('../models/DataSource');
const ChatSession = require('../models/ChatSession');
const { processUserMessage } = require('../services/agentPipeline');

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

/**
 * POST /api/agent/chat
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId, dataSourceId, mode = 'sql' } = req.body;
    const userId = getUserIdFromReq(req);
    const effectiveSessionId = (sessionId && sessionId !== 'default_session') ? sessionId : `${mode}_${userId}`;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required.' });
    }

    let dataSource = null;
    if (dataSourceId) {
      dataSource = await DataSource.findById(dataSourceId, userId);
    } else {
      // Pick most recently created data source for this user
      dataSource = await DataSource.findOne(userId);
    }

    // Process via Agent Pipeline
    const agentResult = await processUserMessage({
      message,
      dataSource,
      history: req.body.history || [],
      mode
    });

    // Save message to session history scoped to user
    try {
      let session = await ChatSession.findOne({ sessionId: effectiveSessionId, userId });
      if (!session) {
        session = await ChatSession.create({
          sessionId: effectiveSessionId,
          title: message.slice(0, 30),
          mode,
          dataSourceId: dataSource ? (dataSource._id || dataSource.id) : null,
          userId
        });
      }

      await ChatSession.addMessage(effectiveSessionId, {
        id: 'msg_user_' + Date.now(),
        sender: 'user',
        text: message,
        userId
      });

      await ChatSession.addMessage(effectiveSessionId, {
        id: 'msg_agent_' + Date.now(),
        sender: 'agent',
        text: agentResult.text || agentResult.explanation,
        intent: agentResult.intent,
        sql: agentResult.sql,
        explanation: agentResult.explanation,
        data: agentResult.data,
        fields: agentResult.fields,
        chartConfig: agentResult.chartConfig,
        selfCorrected: agentResult.selfCorrected,
        error: agentResult.error,
        userId
      });
    } catch (dbErr) {
      console.warn('[Session Save Warning]:', dbErr.message);
    }

    const responseText = agentResult.text || agentResult.explanation || agentResult.reply || agentResult.message;

    res.json({
      success: true,
      text: responseText,
      reply: responseText,
      message: responseText,
      result: agentResult
    });
  } catch (error) {
    console.error('[Agent Chat Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/agent/sessions
 */
router.get('/sessions', async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const sessions = await ChatSession.find(userId);
    res.json({ success: true, sessions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/agent/sessions/:id
 */
router.delete('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = getUserIdFromReq(req);
    await ChatSession.delete(id, userId);
    res.json({ success: true, message: 'Session deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
