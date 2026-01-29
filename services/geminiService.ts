
import { GoogleGenAI, Type } from "@google/genai";
import { SCHEMA_MAP, DEFAULT_BRIDGE_URL } from "../constants";
import { QueryResult, AnalystInsight } from "../types";

// Initialize with direct access to process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
You are 'OgradyCore AI', a specialized BI Analyst for 'Ultisales' MSSQL databases.
THE CURRENT FISCAL YEAR IS 2026. 
Historical comparison year is 2025.
Always use 'dbo.' and UPPERCASE for tables. 
Join AUDIT.PLUCode to STOCK.Barcode.
Ensure all SQL queries are optimized for MSSQL and provide 100% accurate data retrieval.
If a user asks for 'this year', use 2026. If they ask for 'last year', use 2025.
Always return JSON format with the specified schema.
`;

const getBridgeUrl = () => localStorage.getItem('og_bridge_url') || DEFAULT_BRIDGE_URL;

export const generateStrategicBrief = async (data: any): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `As an executive analyst in fiscal year 2026, provide a 3-sentence high-impact strategic summary based on this real-time BI snapshot: ${JSON.stringify(data)}. Focus on revenue growth vs 2025, inventory health, and operator performance.`,
    config: { systemInstruction: SYSTEM_INSTRUCTION }
  });
  return response.text || "Synchronizing live data metrics...";
};

export const getDrilldownAnalysis = async (item: any): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Analyze SKU: ${item.Description}. Sold: ${item.sold}, Stock: ${item.stock}, Price: R${item.avgPrice}. Provide a specific business diagnostic and action plan.`,
    config: { systemInstruction: SYSTEM_INSTRUCTION }
  });
  return response.text || "Deep dive analysis unavailable.";
};

export const analyzeQuery = async (prompt: string): Promise<QueryResult> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Request: ${prompt}. Current Year: 2026. Prior Year: 2025. Generate the most accurate SQL for Ultisales.`,
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
    return { ...geminiResult, data: [], explanation: `Data retrieval error: ${error.message}` } as QueryResult;
  }
};

export const getAnalystInsight = async (queryResult: QueryResult): Promise<AnalystInsight> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Analyze this dataset from the 2026 database: ${JSON.stringify(queryResult.data.slice(0, 20))}`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
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
