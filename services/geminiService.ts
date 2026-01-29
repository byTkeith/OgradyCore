
import { GoogleGenAI, Type } from "@google/genai";
import { SCHEMA_MAP, DEFAULT_BRIDGE_URL } from "../constants";
import { QueryResult, AnalystInsight } from "../types";

// Fixed: Correct initialization of GoogleGenAI using direct process.env.API_KEY as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
You are 'OgradyCore AI', a specialized BI Analyst for 'Ultisales' MSSQL databases.
Always use 'dbo.' and UPPERCASE for tables. Join AUDIT.PLUCode to STOCK.Barcode.
`;

const getBridgeUrl = () => localStorage.getItem('og_bridge_url') || DEFAULT_BRIDGE_URL;

export const generateStrategicBrief = async (data: any): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `As an executive analyst, provide a 2-sentence strategic summary based on this real-time data: ${JSON.stringify(data)}. Focus on revenue health and stock risks.`,
  });
  return response.text || "Synchronizing live data metrics...";
};

export const getDrilldownAnalysis = async (item: any): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Provide a quick breakdown and 2 possible business reasons why this item '${item.Description}' has sold ${item.sold} units with ${item.stock} currently in stock.`,
  });
  return response.text || "Deep dive analysis unavailable.";
};

export const analyzeQuery = async (prompt: string): Promise<QueryResult> => {
  // Fixed: Use 'gemini-3-pro-preview' for complex coding tasks like SQL generation.
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Business Request: ${prompt}. Generate SQL and select visualization [bar, line, pie, area, scatter].`,
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
    return { ...geminiResult, data: [], explanation: `Error: ${error.message}` } as QueryResult;
  }
};

export const getAnalystInsight = async (queryResult: QueryResult): Promise<AnalystInsight> => {
  // Fixed: Use 'gemini-3-pro-preview' for complex analytical reasoning.
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Analyze: ${JSON.stringify(queryResult.data.slice(0, 15))}`,
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
