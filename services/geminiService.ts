
import { DEFAULT_BRIDGE_URL, SALES_TRANSACTION_TYPES, SCHEMA_MAP, CORE_TABLES } from "../constants";
import { QueryResult, AnalystInsight } from "../types";

// We use the OpenAI key from the environment
const API_KEY = process.env.OPENAI_API_KEY || process.env.API_KEY;

const getSettings = () => ({
  bridgeUrl: (localStorage.getItem('og_bridge_url') || DEFAULT_BRIDGE_URL).replace(/\/$/, "")
});

// v8.2: Hard-coded schema initialization
export const initSchema = async (urlOverride?: string): Promise<{ success: boolean; data: Record<string, string[]>; error?: string }> => {
  const staticData: Record<string, string[]> = {};
  Object.keys(SCHEMA_MAP).forEach(key => {
    staticData[key] = SCHEMA_MAP[key].fields;
  });
  return Promise.resolve({ success: true, data: staticData });
};

const getSystemInstruction = () => {
  // DYNAMICALLY BUILD SCHEMA CONTEXT FROM CONSTANTS.TSX
  const schemaContext = CORE_TABLES.map(tableName => {
    const tableDef = SCHEMA_MAP[tableName];
    if (!tableDef) return "";
    return `- TABLE **${tableName}** Columns: [${tableDef.fields.join(', ')}]`;
  }).filter(Boolean).join('\n');

  return `
You are 'OgradyCore AI v7.8', the Principal T-SQL Architect for the UltiSales ERP Database.

### 1. STRICT SCHEMA (TIER 1 TABLES)
${schemaContext}

### 2. CRITICAL RULES (AVOID HALLUCINATIONS)
- **Customer Link:** Use **\`DebtorOrCreditorNumber\`** in \`dbo.AUDIT\`. (Never use 'DebtorNumber' or 'ClientCode').
- **Context:** ALWAYS start with:
  \`USE [UltiSales]; SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;\`
- **Data Reality Check:** The database may contain older data.
  - If the user asks for "recent" or "last 30 days", first consider querying for the **MAX(TransactionDate)** to establish the current "Today" of the database.
  - Do NOT assume the database has data for the current calendar year.

### 3. VISUALIZATION FORMATTING
- Return valid JSON.
- Ensure \`xAxis\` and \`yAxis\` in your JSON match the column aliases in your SQL EXACTLY (Case Sensitive).
- Example: \`SELECT TransactionDate as date, ...\` -> JSON \`xAxis: "date"\`.

### 4. OUTPUT FORMAT
Return ONLY valid JSON:
{"sql": "...", "explanation": "Brief logic summary", "visualizationType": "bar|line|area|pie", "xAxis": "ColumnName", "yAxis": "ColumnName"}
`;
};

/**
 * Native Fetch Client for OpenAI
 * Avoids need for 'openai' npm package, keeping bundle size small.
 */
async function callOpenAI(messages: any[], jsonMode: boolean = true) {
  if (!API_KEY) throw new Error("Missing OPENAI_API_KEY in environment variables.");

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o", // High performance model
        messages: messages,
        temperature: 0.1, // Low temperature for deterministic SQL
        response_format: jsonMode ? { type: "json_object" } : undefined
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "OpenAI API Error");
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error: any) {
    console.error("AI Service Error:", error);
    throw new Error(error.message || "Failed to reach AI provider.");
  }
}

function cleanAiResponse(raw: string): string {
  // OpenAI JSON mode is usually clean, but we strip markdown just in case
  let cleaned = raw.replace(/```json/gi, '').replace(/```/gi, '').trim();
  return cleaned;
}

export const analyzeQuery = async (prompt: string): Promise<QueryResult & { engine: string }> => {
  const messages = [
    { role: "system", content: getSystemInstruction() },
    { role: "user", content: prompt }
  ];

  const responseText = await callOpenAI(messages, true);
  if (!responseText) throw new Error("Intelligence link returned empty.");

  const result = JSON.parse(cleanAiResponse(responseText));
  const { bridgeUrl } = getSettings();
  
  let finalSql = result.sql;
  
  // Strict enforcement of Isolation Level and DB Context
  if (!finalSql.toUpperCase().includes('SET TRANSACTION ISOLATION')) {
    finalSql = `SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED; ${finalSql}`;
  }
  
  if (!finalSql.toUpperCase().trim().startsWith('USE ')) {
    finalSql = `USE [UltiSales]; ${finalSql}`;
  }

  const dbResponse = await fetch(`${bridgeUrl}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '69420' },
    body: JSON.stringify({ sql: finalSql }),
    signal: AbortSignal.timeout(60000)
  });

  if (!dbResponse.ok) {
    const errData = await dbResponse.json();
    throw new Error(errData.detail || "Bridge Execution Error.");
  }
  
  return { ...result, data: await dbResponse.json(), engine: 'GPT-4o v8.2' };
};

export const getAnalystInsight = async (queryResult: QueryResult): Promise<AnalystInsight & { engine: string }> => {
  const prompt = `Interpret these results: ${JSON.stringify(queryResult.data.slice(0, 10))}. 
  Return JSON with fields: summary, trends (array), anomalies (array), suggestions (array).`;

  const messages = [
    { role: "system", content: "You are a senior business intelligence analyst. Return JSON only." },
    { role: "user", content: prompt }
  ];

  const responseText = await callOpenAI(messages, true);
  if (!responseText) throw new Error("Insight failed.");

  return { ...JSON.parse(cleanAiResponse(responseText)), engine: 'GPT-4o v8.2' };
};

export const generateStrategicBrief = async (data: any): Promise<{text: string, engine: string} | null> => {
  // Disabled for Lite Version
  return null;
};
