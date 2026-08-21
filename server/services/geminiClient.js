const { getGenerativeModel } = require('../config/gemini');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate completion using Gemini API with auto-retry and model failover
 */
const generateGeminiText = async (prompt, systemInstruction = '', preferredModel = 'gemini-3.5-flash-lite') => {
  const modelsToTry = [
    'gemini-3.5-flash-lite',
    'gemini-flash-latest',
    'gemini-3.5-flash',
    'gemini-3.6-flash'
  ];

  if (preferredModel && modelsToTry.includes(preferredModel)) {
    const idx = modelsToTry.indexOf(preferredModel);
    if (idx > 0) {
      modelsToTry.splice(idx, 1);
      modelsToTry.unshift(preferredModel);
    }
  }

  for (const modelName of modelsToTry) {
    let retries = 2;
    while (retries > 0) {
      try {
        const model = getGenerativeModel(modelName);
        if (!model) break;

        const fullPrompt = systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt;
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();
        if (text && text.trim()) {
          return text.trim();
        }
      } catch (err) {
        if (err.message && err.message.includes('429')) {
          console.warn(`[Gemini API 429] Model '${modelName}' rate limited. Trying next model pool...`);
          await sleep(200);
          break; // Switch immediately to next model pool
        } else {
          console.warn(`[Gemini API Warning] Model '${modelName}' call failed: ${err.message}. Trying next model...`);
          break;
        }
      }
    }
  }

  return null;
};

module.exports = {
  generateGeminiText
};
