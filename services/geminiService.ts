
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_BRIDGE_URL, SALES_TRANSACTION_TYPES, SCHEMA_MAP, CORE_TABLES } from "../constants";
import { QueryResult, AnalystInsight } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const getSettings = () => ({
  bridgeUrl: (localStorage.getItem('og_bridge_url') || DEFAULT_BRIDGE_URL).replace(/\/$/, "")
});

// v8.2: Hard-coded schema initialization to save network requests
export const initSchema = async (urlOverride?: string): Promise<{ success: boolean; data: Record<string, string[]>; error?: string }> => {
  // We simply return the local constant data masquerading as a fetch result.
  // This saves the backend from running a heavy sys.columns query.
  const staticData: Record<string, string[]> = {};
  Object.keys(SCHEMA_MAP).forEach(key => {
    staticData[key] = SCHEMA_MAP[key].fields;
  });
  return Promise.resolve({ success: true, data: staticData });
};

const getSystemInstruction = () => {
  const validSalesTypes = SALES_TRANSACTION_TYPES.join("','");
  
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

function cleanAiResponse(raw: string): string {
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  cleaned = cleaned.replace(/```json/gi, '').replace(/```/gi, '').trim();
  if (cleaned.includes('{') && cleaned.includes('}')) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

export const analyzeQuery = async (prompt: string): Promise<QueryResult & { engine: string }> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview', 
    contents: prompt,
    config: { 
      systemInstruction: getSystemInstruction(), 
      responseMimeType: "application/json" 
    }
  });
  
  const responseText = response.text;
  if (!responseText) throw new Error("Intelligence link failed.");

  const result = JSON.parse(cleanAiResponse(responseText));
  const { bridgeUrl } = getSettings();
  
  let finalSql = result.sql;
  
  // V7.5: Strict enforcement of Isolation Level and DB Context
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
  
  return { ...result, data: await dbResponse.json(), engine: 'GEMINI FLASH v7.5' };
};

export const getAnalystInsight = async (queryResult: QueryResult): Promise<AnalystInsight & { engine: string }> => {
  const prompt = `Interpret these results: ${JSON.stringify(queryResult.data.slice(0, 10))}. Return JSON.`;
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });
  
  const responseText = response.text;
  if (!responseText) throw new Error("Insight failed.");

  return { ...JSON.parse(cleanAiResponse(responseText)), engine: 'GEMINI FLASH v7.5' };
};

export const generateStrategicBrief = async (data: any): Promise<{text: string, engine: string} | null> => {
  // Disabled for Lite Version
  return null;
};
