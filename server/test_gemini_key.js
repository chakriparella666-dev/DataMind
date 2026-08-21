const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

async function testKey() {
  const modelsToTest = [
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash-8b',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-1.5-pro',
    'gemini-pro-latest',
    'gemini-flash-latest'
  ];

  for (const modelName of modelsToTest) {
    const t0 = Date.now();
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Say hello in 3 words');
      const response = await result.response;
      console.log(`  🎉 SUCCESS with '${modelName}' in ${Date.now() - t0}ms! Response: "${response.text().trim()}"`);
    } catch (err) {
      console.error(`  ❌ Failed with '${modelName}' in ${Date.now() - t0}ms:`, err.message.split('\n')[0]);
    }
  }
}

testKey();
