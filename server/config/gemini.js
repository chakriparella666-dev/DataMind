const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const getGenerativeModel = (modelName = 'gemini-3.5-flash-lite') => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    return null;
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.0,
      maxOutputTokens: 600
    }
  });
};

const getEmbeddingModel = () => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    return null;
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'text-embedding-004' });
};

module.exports = {
  getGenerativeModel,
  getEmbeddingModel
};

