const https = require('https');
require('dotenv').config();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getGroqApiKey = () => {
  return process.env.GROQ_API_KEY || process.env.GROK_API_KEY || process.env.GEMINI_API_KEY || '';
};

/**
 * Sends a raw HTTPS request to Groq OpenAI-compatible Chat API
 */
const sendGroqChatRequest = (payload, apiKey) => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    }, (res) => {
      let responseBody = '';
      res.on('data', chunk => { responseBody += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseBody);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const content = parsed.choices?.[0]?.message?.content;
            resolve(content || '');
          } else {
            const errMsg = parsed.error?.message || `HTTP ${res.statusCode}: ${responseBody}`;
            reject(new Error(errMsg));
          }
        } catch (err) {
          reject(new Error(`Failed to parse Groq response: ${err.message}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Groq request timed out'));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
};

/**
 * Generates text completions via Groq Cloud ultra-fast inference
 */
const generateGroqText = async (prompt, systemInstruction = '', preferredModel = 'qwen/qwen3.8-27b', image = null, jsonMode = false) => {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    console.error('[Groq Client] No GROQ_API_KEY found in environment variables.');
    return null;
  }

  const modelsToTry = [
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-120b',
    'groq/compound-mini',
    'openai/gpt-oss-20b'
  ];

  if (preferredModel && modelsToTry.includes(preferredModel)) {
    const idx = modelsToTry.indexOf(preferredModel);
    if (idx > 0) {
      modelsToTry.splice(idx, 1);
      modelsToTry.unshift(preferredModel);
    }
  }

  const messages = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }

  if (image && image.data && image.mimeType) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.data}` } }
      ]
    });
  } else {
    messages.push({ role: 'user', content: prompt });
  }

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const payload = {
          model,
          messages,
          temperature: 0.1,
          max_tokens: 1500
        };
        if (jsonMode) {
          payload.response_format = { type: 'json_object' };
        }

        const text = await sendGroqChatRequest(payload, apiKey);
        if (text && text.trim()) {
          return text.trim();
        }
      } catch (err) {
        console.warn(`[Groq API Warning] Model '${model}' attempt ${attempt} failed: ${err.message}`);
        if (attempt < 2) {
          await sleep(250);
        }
      }
    }
  }

  return null;
};

module.exports = {
  generateGroqText,
  getGroqApiKey
};
