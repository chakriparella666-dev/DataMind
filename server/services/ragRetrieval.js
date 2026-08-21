const { getEmbeddingModel } = require('../config/gemini');
const TrainingChunk = require('../models/TrainingChunk');

/**
 * Compute cosine similarity between two vectors
 */
const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Get embedding vector from Gemini
 */
const getEmbedding = async (text) => {
  try {
    const model = getEmbeddingModel();
    if (!model) return [];
    const res = await model.embedContent(text);
    return res.embedding.values || [];
  } catch (err) {
    console.warn('[RAG] Gemini embedding failed:', err.message);
    return [];
  }
};

/**
 * Retrieve top-k relevant training/schema chunks for a question
 */
const retrieveRelevantContext = async (dataSourceId, question, topK = 5) => {
  try {
    const chunks = await TrainingChunk.find({ dataSourceId });
    if (!chunks || chunks.length === 0) return [];

    const questionVector = await getEmbedding(question);

    if (questionVector.length > 0) {
      // Vector Cosine Similarity Search
      const scored = chunks.map(chunk => {
        const score = chunk.embedding && chunk.embedding.length > 0 
          ? cosineSimilarity(questionVector, chunk.embedding) 
          : 0;
        return { chunk, score };
      });
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, topK).map(item => item.chunk);
    } else {
      // Keyword fallback search
      const keywords = question.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const scored = chunks.map(chunk => {
        const text = chunk.content.toLowerCase();
        let score = 0;
        for (const kw of keywords) {
          if (text.includes(kw)) score += 1;
        }
        return { chunk, score };
      });
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, topK).map(item => item.chunk);
    }
  } catch (err) {
    console.warn('[RAG] Context retrieval error:', err.message);
    return [];
  }
};

module.exports = {
  cosineSimilarity,
  getEmbedding,
  retrieveRelevantContext
};
