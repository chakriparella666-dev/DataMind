const { generateGeminiText } = require('./geminiClient');
const { retrieveRelevantContext } = require('./ragRetrieval');
const { runQueryOnDb } = require('../utils/databaseExecutor');

/**
 * Classifies user message intent using Gemini AI
 */
const classifyIntent = async (message) => {
  const prompt = `Classify the following user input into ONE of two categories:
1. "sql_question" - If the user is asking a data analytics question, requesting database records, counts, averages, tables, or charts.
2. "general_chat" - If the user is saying hello, asking general programming advice, or general conversation.

User Input: "${message}"

Respond strictly with a JSON object: { "intent": "sql_question" } or { "intent": "general_chat" }`;

  try {
    const raw = await generateGeminiText(prompt, 'You are an intent classifier.', 'gemini-3.5-flash');
    if (raw) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return parsed.intent || 'sql_question';
      }
    }
  } catch (err) {
    console.warn('[Agent Pipeline] Intent classification fallback:', err.message);
  }
  return 'sql_question';
};

/**
 * Generates smart responses for General AI Chatbot mode strictly via Gemini API key
 */
const getSmartGeneralReply = async (message, history = []) => {
  // Keep last 6 turns and truncate past responses to max 300 chars for sub-2-second ultra-fast execution
  const recentHistory = (history || []).slice(-6);
  const historyText = recentHistory
    .map(h => `${h.sender === 'user' ? 'User' : 'Assistant'}: ${(h.text || '').slice(0, 300)}`)
    .join('\n');

  const systemPrompt = `You are DataMind General AI Assistant. Help the user with SQL syntax, database normalization, query optimizations, indexes, CTEs, joins, or general software engineering questions. Keep your answers clear, helpful, concise, and formatted in clean markdown.`;

  const userPrompt = `${historyText ? `Recent Conversation Context:\n${historyText}\n\n` : ''}User Question: "${message}"`;

  try {
    const reply = await generateGeminiText(userPrompt, systemPrompt, 'gemini-3.5-flash-lite');
    if (reply && reply.trim()) {
      return reply.trim();
    }
    return `⚠️ Could not generate a response from Gemini API. Please verify that your GEMINI_API_KEY in server/.env is valid and active.`;
  } catch (err) {
    if (err.message && (err.message.includes('401') || err.message.includes('Unauthorized') || err.message.includes('API_KEY'))) {
      return `⚠️ **Gemini API Key Error**: The current \`GEMINI_API_KEY\` in \`server/.env\` is invalid or unauthorized (starts with \`AQ.Ab...\`). Please provide a valid Google AI Studio API key starting with \`AIzaSy...\` in your \`server/.env\` file.`;
    }
    return `⚠️ **Gemini API Error**: ${err.message}`;
  }
};

/**
 * Dynamic Schema Entity Verification
 * Verifies if any noun/entity specified in the user's prompt exists in the active dataset's
 * dataset name, table names, or column names.
 */
const verifySchemaRelevance = (message, dataSource) => {
  if (!dataSource || !dataSource.schemaMetadata) return { isRelevant: true };

  const prompt = message.toLowerCase().trim();
  const words = prompt.replace(/[^a-z0-9_\s]/g, '').split(/\s+/);
  const commonStopWords = new Set([
    'give', 'me', 'the', 'show', 'all', 'details', 'detail', 'list', 'get', 'select', 
    'find', 'display', 'fetch', 'records', 'record', 'data', 'info', 'information', 
    'from', 'table', 'database', 'where', 'and', 'or', 'for', 'with', 'in', 'of', 'to', 
    'a', 'an', 'is', 'are', 'what', 'which', 'how', 'many', 'count', 'top', 'by', 'order',
    'asc', 'desc', 'limit', 'name', 'names'
  ]);

  const entityCandidateWords = words.filter(w => w.length >= 3 && !commonStopWords.has(w));
  if (entityCandidateWords.length === 0) {
    return { isRelevant: true };
  }

  const datasetName = (dataSource.name || '').toLowerCase();
  const tables = dataSource.schemaMetadata.tables || [];

  const schemaTokens = new Set();
  datasetName.replace(/[^a-z0-9_]/g, ' ').split(/\s+/).forEach(tok => {
    if (tok.length >= 3) schemaTokens.add(tok);
  });

  for (const t of tables) {
    const tName = (t.name || '').toLowerCase();
    tName.replace(/[^a-z0-9_]/g, ' ').split(/\s+/).forEach(tok => {
      if (tok.length >= 3) schemaTokens.add(tok);
    });

    for (const c of t.columns || []) {
      const cName = (c.name || '').toLowerCase();
      cName.replace(/[^a-z0-9_]/g, ' ').split(/\s+/).forEach(tok => {
        if (tok.length >= 3) schemaTokens.add(tok);
      });
    }
  }

  let matchFound = false;
  let unmatchedWord = '';

  for (const word of entityCandidateWords) {
    const stem = word.replace(/s$/, '');
    let wordMatches = false;
    for (const token of schemaTokens) {
      if (token.includes(word) || token.includes(stem) || word.includes(token) || stem.includes(token)) {
        wordMatches = true;
        break;
      }
    }

    if (wordMatches) {
      matchFound = true;
      break;
    } else {
      unmatchedWord = word;
    }
  }

  if (!matchFound) {
    const tableSummaryStr = tables.map(t => {
      const cols = (t.columns || []).map(c => c.name).join(', ');
      return `"${t.name}" [${cols}]`;
    }).join('; ');

    return {
      isRelevant: false,
      reason: `The question is not related to the connected database (${dataSource.name || 'Dataset'}). The requested entity/concept '${unmatchedWord}' does not exist in this dataset. Available tables and columns: ${tableSummaryStr}`
    };
  }

  return { isRelevant: true };
};

/**
 * Main Agent Pipeline powered 100% by Google Gemini AI API
 */
const processUserMessage = async ({ message, dataSource, history = [], mode = 'sql' }) => {
  // 1. General Chat Mode - Dynamically processed via Gemini API
  if (mode === 'general') {
    const reply = await getSmartGeneralReply(message, history);
    return {
      intent: 'general_chat',
      text: reply
    };
  }

  // 2. Greeting Check (dynamically answered via Gemini API)
  const isGreetingPattern = /^(hi|hii|hiii|hello|hey|heyy|how are you|who are you|good morning|good evening|thanks|thank you)\b/i;
  if (isGreetingPattern.test(message.trim())) {
    const reply = await getSmartGeneralReply(message, history);
    return {
      intent: 'general_chat',
      text: reply
    };
  }

  if (!dataSource || !dataSource.schemaMetadata) {
    return {
      intent: 'general_chat',
      text: 'Please connect a PostgreSQL database or upload a SQLite/CSV file to execute data queries.'
    };
  }

  const dialect = dataSource.type === 'postgres' ? 'postgres' : (dataSource.type === 'mysql' ? 'mysql' : 'sqlite');

  // Dynamic Schema Entity Verification
  const schemaVerification = verifySchemaRelevance(message, dataSource);
  if (!schemaVerification.isRelevant) {
    return {
      intent: 'sql_question',
      isRelevant: false,
      error: schemaVerification.reason,
      explanation: schemaVerification.reason,
      text: schemaVerification.reason,
      sql: null,
      data: [],
      fields: []
    };
  }

  // Step 1: Full Database & Excel Schema Context
  const fullSchemaText = (dataSource.schemaMetadata?.tables || []).map(t => {
    const colsStr = (t.columns || []).map(c => `"${c.name}" (${c.type})`).join(', ');
    return `TABLE "${t.name}" (\n  COLUMNS: ${colsStr}\n)`;
  }).join('\n\n');

  const tableSummaryStr = (dataSource.schemaMetadata?.tables || []).map(t => {
    const cols = (t.columns || []).map(c => c.name).join(', ');
    return `"${t.name}" [${cols}]`;
  }).join('; ');

  // Step 2: Pure Gemini AI SQL Query Generation & Schema Relevance Verification
  const systemPrompt = `You are an expert AI SQL Generator and database query assistant.
DATABASE DIALECT: ${dialect}
ACTIVE DATASET NAME: "${dataSource.name || 'Connected Database'}"

FULL CONNECTED DATABASE SCHEMA (TABLES AND COLUMNS IN THIS DATASET):
${fullSchemaText}

CRITICAL RELEVANCE RULES:
1. ENTITY VERIFICATION:
   - Identify the main entity or concept requested in the user's question (e.g. "student", "user", "employee", "patient", "flight", "invoice", "product", "sales", etc.).
   - Check if that entity or concept ACTUALLY exists in the table names, dataset name, or column names in the FULL CONNECTED DATABASE SCHEMA above.
   - If the requested entity DOES NOT exist in the connected database schema above:
     - Set "entityExistsInSchema": false
     - Set "isRelevant": false
     - Set "sql": ""
     - Set "explanation": "The question is not related to the connected database (${dataSource.name || 'Dataset'}). The requested entity does not exist in this dataset. Available tables and columns: ${tableSummaryStr}"
   - NEVER query an unrelated table. NEVER write "as a proxy for...". DO NOT combine names like "user (student)" or "student/user".

2. IF THE QUESTION ASKS FOR TABLES OR COLUMNS IN THE DATABASE:
   - E.g., "show tables", "what columns exist", "give me table names and column names"
   - Set "entityExistsInSchema": true
   - Set "isRelevant": true
   - If PostgreSQL dialect, generate: SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;
   - If SQLite dialect, generate: SELECT name FROM sqlite_master WHERE type='table';
   - Set "explanation": "Retrieves the list of all tables and columns from the database schema."

3. IF THE QUESTION MATCHES TABLES/COLUMNS IN THE SCHEMA:
   - Set "entityExistsInSchema": true
   - Set "isRelevant": true
   - Generate a valid read-only SELECT query in ${dialect} matching the user's question using ONLY existing table names and column names.
   - SELECT all relevant columns (or all columns if general details requested).
   - Format major SQL keywords (SELECT, FROM, WHERE, GROUP BY, ORDER BY, LIMIT) on new lines cleanly.
   - Write a simple explanation describing ONLY what table and columns are being retrieved.

STRICT JSON OUTPUT FORMAT (Respond ONLY with valid JSON):
{
  "entityRequested": "<core entity asked by user, e.g. student>",
  "entityExistsInSchema": true or false,
  "isRelevant": true or false,
  "sql": "SELECT col1, col2\\nFROM table_name\\nLIMIT 100;",
  "explanation": "Retrieves details from the database."
}`;

  let sqlGenRes = await generateGeminiText(`User Question: "${message}"`, systemPrompt, 'gemini-3.5-flash-lite');

  let isRelevant = true;
  let generatedSql = '';
  let explanation = '';

  if (sqlGenRes) {
    try {
      const jsonMatch = sqlGenRes.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.entityExistsInSchema === false || parsed.isRelevant === false) {
          isRelevant = false;
        }
        generatedSql = isRelevant ? (parsed.sql || '') : '';
        explanation = parsed.explanation || '';
      }
    } catch (e) {
      console.warn('[Agent Pipeline] JSON parse warning:', e.message);
    }
  }

  // Handle irrelevant questions or missing SQL
  if (!isRelevant || !generatedSql) {
    const notRelatedMsg = explanation || `The question is not related to the connected database (${dataSource.name || 'Dataset'}). Available tables: ${tableSummaryStr}`;
    return {
      intent: 'sql_question',
      isRelevant: false,
      error: notRelatedMsg,
      explanation: notRelatedMsg,
      text: notRelatedMsg,
      sql: null,
      data: [],
      fields: []
    };
  }

  // Ensure SQL is formatted line-by-line
  if (!generatedSql.includes('\n')) {
    generatedSql = generatedSql
      .replace(/\s+FROM\s+/i, '\nFROM ')
      .replace(/\s+WHERE\s+/i, '\nWHERE ')
      .replace(/\s+GROUP BY\s+/i, '\nGROUP BY ')
      .replace(/\s+ORDER BY\s+/i, '\nORDER BY ')
      .replace(/\s+LIMIT\s+/i, '\nLIMIT ');
  }

  // Step 3: Execute SQL on target Database / File
  const startTime = Date.now();
  let queryResult = null;

  try {
    queryResult = await runQueryOnDb(dataSource, generatedSql);
  } catch (err) {
    return {
      intent: 'sql_question',
      sql: generatedSql,
      error: `SQL Execution Error: ${err.message}`,
      explanation
    };
  }

  const executionTimeMs = Date.now() - startTime;

  return {
    intent: 'sql_question',
    isRelevant: true,
    sql: generatedSql,
    explanation,
    fields: queryResult.fields || [],
    data: queryResult.data || [],
    rowCount: queryResult.rowCount || (queryResult.data ? queryResult.data.length : 0),
    executionTimeMs
  };
};

module.exports = {
  processUserMessage,
  classifyIntent
};
