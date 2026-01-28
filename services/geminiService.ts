
import { GoogleGenAI, Type } from "@google/genai";
import { SCHEMA_MAP } from "../constants";
import { QueryResult, AnalystInsight } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const SYSTEM_INSTRUCTION = `
You are 'OgradyCore AI', a Senior BI Analyst specializing in the 'Ultisales' MSSQL database.

⚠️ DATABASE ARCHITECTURE RULES:
1. MANDATORY PREFIX: Every table reference MUST start with 'dbo.'.
2. CASE SENSITIVITY: All table names MUST be UPPERCASE. (e.g., dbo.STOCK, dbo.AUDIT).
3. NO 'tbl' PREFIXES: The prefix 'tbl' is strictly forbidden.
4. COMPOSITE KEY AWARENESS: Many tables have composite primary keys. Use this knowledge to ensure accurate joins.

⚠️ CRITICAL JOIN LOGIC:
- dbo.STOCK does NOT contain a 'PLUCode' column.
- To join sales (AUDIT) with inventory (STOCK), use: 
  'INNER JOIN dbo.STOCK ON dbo.AUDIT.PLUCode = dbo.STOCK.Barcode'
- To join sales with customers (DEBTOR), use:
  'INNER JOIN dbo.DEBTOR ON dbo.AUDIT.DebtorOrCreditorNumber = dbo.DEBTOR.ANUMBER'

⚠️ FIELD VALIDATION:
- When asked for "Stock Levels", columns are 'Description' and 'OnHand' in dbo.STOCK.
- When asked for "Sales", columns are 'Qty', 'RetailPriceExcl', and 'TransactionDate' in dbo.AUDIT.
- Use TOP 50 to prevent timeout.

SCHEMA DEFINITION:
${JSON.stringify(SCHEMA_MAP, null, 2)}

Only generate the SQL SELECT statement. If the user asks for a comparison, perform the join using the verified columns (AUDIT.PLUCode = STOCK.Barcode).
`;

const getBridgeUrl = () => {
  return localStorage.getItem('og_bridge_url') || '';
};

export const analyzeQuery = async (prompt: string): Promise<QueryResult> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Transform this business request into a validated T-SQL query for Ultisales: ${prompt}`,
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
  
  // Post-process to ensure strict compliance
  if (geminiResult.sql) {
    // Correct the AI if it mistakenly tries to join STOCK on PLUCode
    geminiResult.sql = geminiResult.sql
      .replace(/dbo\.STOCK\.PLUCode/gi, 'dbo.STOCK.Barcode')
      .replace(/dbo\.STOCK\.PLU_Code/gi, 'dbo.STOCK.Barcode')
      .replace(/tbl/gi, 'dbo.')
      .replace(/tblSTOCK/gi, 'dbo.STOCK')
      .replace(/tblAUDIT/gi, 'dbo.AUDIT');
      
    // Force uppercase for dbo. prefixing just in case
    geminiResult.sql = geminiResult.sql.replace(/dbo\.(\w+)/g, (match: string) => match.toUpperCase());
    // Correct the dot since previous line makes it DBO.STOCK
    geminiResult.sql = geminiResult.sql.replace(/DBO\./g, 'dbo.');
  }

  const bridgeUrl = getBridgeUrl();
  if (!bridgeUrl) {
    return { ...geminiResult, data: [], explanation: "⚠️ SQL generated but Bridge is offline. Configure it in 'Live Data Link'." };
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
      throw new Error(errorData.detail || 'Database Execution Engine Error');
    }

    const realData = await dbResponse.json();
    return { ...geminiResult, data: realData || [] } as QueryResult;
  } catch (error: any) {
    console.error("SQL Error Trace:", error);
    return {
      ...geminiResult,
      data: [],
      explanation: `⚠️ SQL Execution Error: ${error.message}. Please verify table and column names.`
    } as QueryResult;
  }
};

export const getAnalystInsight = async (queryResult: QueryResult): Promise<AnalystInsight> => {
  if (!queryResult.data || queryResult.data.length === 0) {
    return {
      summary: "No data matched the search criteria in Ultisales.",
      trends: ["Data points are empty for this segment."],
      anomalies: ["Null Result"],
      suggestions: ["Check the join between AUDIT.PLUCode and STOCK.Barcode", "Verify current STOCK levels in dbo.STOCK"]
    };
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Interpret these business results for OgradyCore management: ${JSON.stringify(queryResult.data.slice(0, 10))}`,
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
