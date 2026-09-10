const { generateGroqText } = require('./groqClient');

/**
 * Generate completion using Groq API with auto-retry and model failover
 */
const generateGeminiText = async (prompt, systemInstruction = '', preferredModel = 'qwen/qwen3.8-27b', image = null) => {
  return await generateGroqText(prompt, systemInstruction, preferredModel, image);
};

module.exports = {
  generateGeminiText
};


