
import { GoogleGenAI, Type } from "@google/genai";
import { SCHEMA_MAP, DEFAULT_BRIDGE_URL } from "../constants";
import { QueryResult, AnalystInsight } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const SYSTEM_INSTRUCTION = `
You are 'OgradyCore AI', a specialized BI Analyst for 'Ultisales' MSSQL databases.

⚠️ KNOWLEDGE BASE (From Developer Docs):
- TABLE PREFIX: Always use 'dbo.' and UPPERCASE (e.g., dbo.AUDIT).
- METADATA: Use dbo.TYPES for human-friendly names. 
  * 'Cash Sales' join: AUDIT.TransactionType = TYPES.TYPE_ID WHERE TYPES.TABLE_NAME='AUDIT' AND TYPES.TYPE_NAME='TRANSACTIONTYPE' AND TYPES.TYPE_ID='66'
  * 'Credit Sales' = TYPE_ID '70'
  * 'Discontinued Stock' = STOCK.StockType '13'
  * Join logic: ALWAYS use INNER JOIN dbo.TYPES to get TYPE_DESCRIPTION for status/type queries.

⚠️ VISUALIZATION LOGIC:
- 'bar': Compare performance (e.g., "Top 10 selling items").
- 'line': Trends over time (e.g., "Daily revenue for last 30 days").
- 'pie': Composition (e.g., "Breakdown of Cash vs Credit sales").
- 'area': Growth volume (e.g., "Cumulative stock value history").
- 'scatter': Correlation (e.g., "Quantity Sold vs Retail Price").

⚠️ OUTPUT REQUIREMENTS:
- SQL MUST be valid T-SQL.
- Join AUDIT.PLUCode to STOCK.Barcode.
- Join AUDIT.DebtorOrCreditorNumber to DEBTOR.ANUMBER.
- Default to TOP 50.

SCHEMA CONTEXT:
${JSON.stringify(SCHEMA_MAP, null, 2)}
`;

const getBridgeUrl = () => {
  return localStorage.getItem('og_bridge_url') || DEFAULT_BRIDGE_URL;
};

export const analyzeQuery = async (prompt: string): Promise<QueryResult> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Business Request: ${prompt}. Generate the optimal SQL and select the best VISUALIZATION type from [bar, line, pie, area, scatter].`,
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
  
  if (geminiResult.sql) {
    geminiResult.sql = geminiResult.sql
      .replace(/dbo\.STOCK\.PLUCode/gi, 'dbo.STOCK.Barcode')
      .replace(/tbl/gi, 'dbo.')
      .replace(/dbo\.(\w+)/g, (match: string) => match.toUpperCase())
      .replace(/DBO\./g, 'dbo.');
  }

  const baseUrl = getBridgeUrl().replace(/\/$/, "");
  try {
    const dbResponse = await fetch(`${baseUrl}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '69420' },
      body: JSON.stringify({ sql: geminiResult.sql })
    });
    const realData = await dbResponse.json();
    return { ...geminiResult, data: realData || [] } as QueryResult;
  } catch (error: any) {
    return { ...geminiResult, data: [], explanation: `Execution Error: ${error.message}` } as QueryResult;
  }
};

export const getAnalystInsight = async (queryResult: QueryResult): Promise<AnalystInsight> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Context: Ultisales Data Results. Question: What are the key takeaways from this data? Data: ${JSON.stringify(queryResult.data.slice(0, 15))}`,
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
