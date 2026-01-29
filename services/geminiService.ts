
import { GoogleGenAI, Type } from "@google/genai";
import { SCHEMA_MAP, DEFAULT_BRIDGE_URL } from "../constants";
import { QueryResult, AnalystInsight } from "../types";

// Initialize with direct access to process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
You are 'OgradyCore AI', a specialized BI Analyst for 'Ultisales' MSSQL databases.
PRIMARY CONTEXT: Fiscal Year 2026.
FALLBACK CONTEXT: If 2026 data is empty, analyze 2025 records and explicitly mention "Fiscal 2025 Retrospective".
Always use 'dbo.' and UPPERCASE for tables. 
Join AUDIT.PLUCode to STOCK.Barcode.
Ensure all SQL queries are optimized for MSSQL and provide 100% accurate data retrieval.
When providing summaries, be sharp, executive-focused, and cite specific data points.
`;

const getBridgeUrl = () => localStorage.getItem('og_bridge_url') || DEFAULT_BRIDGE_URL;

export const generateStrategicBrief = async (data: any): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Analyze this BI dataset for year ${data.activeYear}. If it is 2025, treat it as a retrospective analysis. Provide a 3-sentence high-impact strategic summary. Data: ${JSON.stringify(data)}`,
    config: { systemInstruction: SYSTEM_INSTRUCTION }
  });
  return response.text || "Synchronizing live data metrics...";
};

export const getDrilldownAnalysis = async (item: any): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `SKU Deep Dive: ${item.Description}. Sold: ${item.sold}, OnHand: ${item.stock}, Price: R${item.avgPrice}. Provide a business diagnostic.`,
    config: { systemInstruction: SYSTEM_INSTRUCTION }
  });
  return response.text || "Deep dive analysis unavailable.";
};

export const analyzeQuery = async (prompt: string): Promise<QueryResult> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Natural Language Request: ${prompt}. (Context: User is currently viewing 2026/2025 data). Generate the most accurate SQL for Ultisales.`,
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
    return { ...geminiResult, data: [], explanation: `Bridge Error: ${error.message}` } as QueryResult;
  }
};

export const getAnalystInsight = async (queryResult: QueryResult): Promise<AnalystInsight> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Dataset Analysis: ${JSON.stringify(queryResult.data.slice(0, 20))}. Provide structured insights.`,
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
