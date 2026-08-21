const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const getGenerativeModel = (modelName = 'gemini-3.6-flash') => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    return null;
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: modelName });
};

const getEmbeddingModel = () => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    return null;
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
};

module.exports = {
  getGenerativeModel,
  getEmbeddingModel
};
