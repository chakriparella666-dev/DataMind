const express = require('express');
const router = express.Router();
const TrainingChunk = require('../models/TrainingChunk');
const { getEmbedding } = require('../services/ragRetrieval');

/**
 * POST /api/training/save-qa
 * One-click action to save confirmed question -> verified SQL pair
 */
router.post('/save-qa', async (req, res) => {
  try {
    const { dataSourceId = 'default', question, sql } = req.body;

    if (!question || !sql) {
      return res.status(400).json({ success: false, error: 'Question and SQL are required.' });
    }

    const content = `CONFIRMED EXAMPLE Q&A PAIR:\nQUESTION: "${question}"\nVERIFIED SQL: ${sql}`;
    const embedding = await getEmbedding(content);

    const chunk = await TrainingChunk.create({
      dataSourceId,
      chunkType: 'qa_pair',
      content,
      metadata: { question, sql },
      embedding
    });

    res.json({ success: true, chunk });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/training/glossary
 * Add business definition rule
 */
router.post('/glossary', async (req, res) => {
  try {
    const { dataSourceId = 'default', term, definition } = req.body;

    if (!term || !definition) {
      return res.status(400).json({ success: false, error: 'Term and definition are required.' });
    }

    const content = `BUSINESS DEFINITION / RULE:\n"${term}" means: ${definition}`;
    const embedding = await getEmbedding(content);

    const chunk = await TrainingChunk.create({
      dataSourceId,
      chunkType: 'glossary',
      content,
      metadata: { question: term, definition },
      embedding
    });

    res.json({ success: true, chunk });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/training
 * Fetch training chunks for active database
 */
router.get('/', async (req, res) => {
  try {
    const { dataSourceId } = req.query;
    const filter = dataSourceId ? { dataSourceId } : {};
    const chunks = await TrainingChunk.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, chunks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/training/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    await TrainingChunk.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Training item deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
