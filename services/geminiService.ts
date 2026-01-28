
import { GoogleGenAI, Type } from "@google/genai";
import { SCHEMA_MAP } from "../constants";
import { QueryResult, AnalystInsight } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const SYSTEM_INSTRUCTION = `
You are 'OgradyCore Analyst AI', a specialized T-SQL engineer for the Ultisales MSSQL database.

⚠️ ABSOLUTE NAMING PROTOCOL:
- FORBIDDEN: NEVER use 'tbl' as a prefix.
- MANDATORY: ALWAYS use 'dbo.' as the prefix.
- TABLE NAMES: Must be EXACTLY as defined in the SCHEMA MAP (Uppercase).
- TABLES IN SCOPE: dbo.AUDIT, dbo.STOCK, dbo.DEBTOR, dbo.CREDITOR, dbo.TRANSACTIONS.

SYNTAX RULES:
1. Only generate SELECT statements.
2. ALWAYS use 'TOP 50' for performance.
3. Use 'TransactionDate' for all time-series data.
4. If a user asks for "stock levels", the query MUST be: SELECT TOP 50 DESCRIPTION, ONHAND FROM dbo.STOCK ORDER BY ONHAND DESC.

SCHEMA REFERENCE:
${JSON.stringify(SCHEMA_MAP, null, 2)}

FAILURE TO FOLLOW THE 'dbo.' PREFIX OR USING 'tbl' WILL RESULT IN A SYSTEM ERROR.
`;

const getBridgeUrl = () => {
  return localStorage.getItem('og_bridge_url') || '';
};

export const analyzeQuery = async (prompt: string): Promise<QueryResult> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Task: Convert this business question into a 'dbo.' prefixed SQL query for Ultisales.
    Question: ${prompt}`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sql: { type: Type.STRING },
          explanation: { type: Type.STRING },
          visualizationType: { type: Type.STRING },
          xAxis: { type: Type.STRING },
          yAxis: { type: Type.STRING }
        },
        required: ["sql", "explanation", "visualizationType", "xAxis", "yAxis"]
      }
    }
  });

  let geminiResult = JSON.parse(response.text || '{}');
  
  // Safety Interceptor: If the AI slipped up and used 'tbl', fix it locally before execution
  if (geminiResult.sql && geminiResult.sql.toLowerCase().includes('tbl')) {
    console.warn("AI used forbidden 'tbl' prefix. Correcting...");
    geminiResult.sql = geminiResult.sql
      .replace(/tblStock/gi, 'dbo.STOCK')
      .replace(/tblAudit/gi, 'dbo.AUDIT')
      .replace(/tblDebtor/gi, 'dbo.DEBTOR')
      .replace(/tblCreditor/gi, 'dbo.CREDITOR')
      .replace(/tblTransactions/gi, 'dbo.TRANSACTIONS')
      .replace(/tbl/gi, 'dbo.'); // Fallback catch-all
  }

  const bridgeUrl = getBridgeUrl();
  if (!bridgeUrl) {
    return { ...geminiResult, data: [], explanation: "⚠️ Bridge Link required." };
  }

  const baseUrl = bridgeUrl.replace(/\/$/, "");

  try {
    const dbResponse = await fetch(`${baseUrl}/query`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420'
      },
      body: JSON.stringify({ sql: geminiResult.sql })
    });

    if (!dbResponse.ok) {
      const errorData = await dbResponse.json();
      throw new Error(errorData.detail || 'SQL Bridge Error');
    }

    const realData = await dbResponse.json();
    return { ...geminiResult, data: realData || [] } as QueryResult;
  } catch (error: any) {
    return {
      ...geminiResult,
      data: [],
      explanation: `⚠️ SQL Error: ${error.message}. Ensure the Bridge is running and using the Ultisales database.`
    } as QueryResult;
  }
};

export const getAnalystInsight = async (queryResult: QueryResult): Promise<AnalystInsight> => {
  if (!queryResult.data || queryResult.data.length === 0) {
    return {
      summary: "No results found for the current query parameters.",
      trends: ["Dataset empty."],
      anomalies: ["Missing Records"],
      suggestions: ["Check the date range", "Verify the PLUCode exists"]
    };
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze result set: ${JSON.stringify(queryResult.data.slice(0, 10))}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          trends: { type: Type.ARRAY, items: { type: Type.STRING } },
          anomalies: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["summary", "trends", "anomalies", "suggestions"]
      }
    }
  });

  return JSON.parse(response.text || '{}') as AnalystInsight;
};
