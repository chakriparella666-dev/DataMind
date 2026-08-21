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
    const raw = await generateGeminiText(prompt, 'You are an intent classifier.', 'gemini-3.5-flash-lite');
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return parsed.intent || 'sql_question';
    }
  } catch (err) {
    console.warn('[Agent Pipeline] Intent classification fallback:', err.message);
  }
  return 'sql_question';
};

/**
 * Generates smart responses for General AI Chatbot mode
 */
const getSmartGeneralReply = async (message, history = []) => {
  const historyText = history
    .map(h => `${h.sender === 'user' ? 'User' : 'Assistant'}: ${h.text}`)
    .join('\n');

  const systemPrompt = `You are DataMind General AI Assistant. Help the user with SQL syntax, database normalization, query optimizations, indexes, CTEs, joins, or general software engineering questions. Keep your answers clear, helpful, and formatted in clean markdown.`;

  const userPrompt = `${historyText ? `Conversation History:\n${historyText}\n\n` : ''}User Question: "${message}"`;

  try {
    const reply = await generateGeminiText(userPrompt, systemPrompt, 'gemini-3.5-flash-lite');
    return reply || 'How can I assist you with your database or SQL queries today?';
  } catch (err) {
    return `Error connecting to AI service: ${err.message}`;
  }
};

/**
 * Main Agent Pipeline powered 100% by Google Gemini AI API
 */
const processUserMessage = async ({ message, dataSource, history = [], mode = 'sql' }) => {
  // 1. General Chat Mode
  if (mode === 'general') {
    const reply = await getSmartGeneralReply(message, history);
    return {
      intent: 'general_chat',
      text: reply
    };
  }

  // 2. Fast Greeting Check (0ms local match for simple conversational queries)
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

  // Step 1: Full Database & Excel Schema Context
  const fullSchemaText = (dataSource.schemaMetadata?.tables || []).map(t => {
    const colsStr = (t.columns || []).map(c => `"${c.name}" (${c.type})`).join(', ');
    return `TABLE "${t.name}" (\n  COLUMNS: ${colsStr}\n)`;
  }).join('\n\n');

  const tableSummaryStr = (dataSource.schemaMetadata?.tables || []).map(t => {
    const cols = (t.columns || []).map(c => c.name).join(', ');
    return `"${t.name}" [${cols}]`;
  }).join('; ');

  // Step 2: Pure Gemini AI SQL Query Generation & Strict Schema Relevance Verification
  const systemPrompt = `You are a strict database query validator and SQL generator.
DATABASE DIALECT: ${dialect}
ACTIVE DATASET: "${dataSource.name || 'Connected Database'}"

FULL CONNECTED DATABASE SCHEMA (ALL TABLES AND ALL COLUMNS IN THIS DATASET):
${fullSchemaText}

STRICT RELEVANCE & NO-SUBSTITUTION RULES:
1. NO CONCEPT SUBSTITUTION OR GUESSWORK (CRITICAL RULE):
   - You MUST NOT guess, assume, fuzzy-map, or substitute non-existent concepts.
   - For example: If the user asks for "customer names", "customers", "orders", "order status", or "sales", but the database contains student data (e.g. columns: placement_status, gpa, department, age):
     DO NOT map "order status" to "placement_status"!
     DO NOT map "customers" to "students"!
     DO NOT map "orders" or "purchases" to any student columns!
   - If the user's question asks for any entity, domain, or column concept that DOES NOT explicitly exist in the CONNECTED DATABASE SCHEMA above:
     - You MUST set "isRelevant": false.
     - Set "sql": "".
     - Set "explanation": "The question is not related to the connected database (${dataSource.name || 'Dataset'}). The database contains table(s) and column(s): ${tableSummaryStr} and does not contain matching customer or order data."

2. SQL GENERATION (ONLY IF ALL REQUESTED CONCEPTS EXPLICITLY MATCH THE SCHEMA):
   - Set "isRelevant": true
   - Generate a single, valid, read-only SELECT statement in ${dialect} dialect based strictly on the user's request.
   - Use exact table names and column names from the schema provided above.
   - FORMATTING RULE: Format the SQL query line-by-line cleanly with major keywords (SELECT, FROM, WHERE, GROUP BY, ORDER BY, LIMIT) starting on separate lines.
   - Provide a concise explanation of what the query retrieves.

3. DYNAMIC EVALUATION ONLY:
   Evaluate everything dynamically using Gemini API.

4. STRICT JSON FORMAT (Return ONLY valid JSON, no extra text):
{
  "isRelevant": true | false,
  "sql": "SELECT ... \\nFROM ... \\nWHERE ... \\nLIMIT 100;",
  "explanation": "<explanation of query OR reason why question is not related to the database>"
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
        if (parsed.isRelevant === false) {
          isRelevant = false;
        }
        generatedSql = parsed.sql || '';
        explanation = parsed.explanation || '';
      }
    } catch (e) {
      console.warn('[Agent Pipeline] JSON parse warning:', e.message);
    }
  }

  // Handle irrelevant questions or missing SQL
  if (!isRelevant || !generatedSql) {
    const notRelatedMsg = explanation || `The question is not related to the connected database (${dataSource.name || 'Dataset'}).`;
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
