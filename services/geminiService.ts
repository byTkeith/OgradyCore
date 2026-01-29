
import { GoogleGenAI, Type } from "@google/genai";
import { SCHEMA_MAP, DEFAULT_BRIDGE_URL } from "../constants";
import { QueryResult, AnalystInsight } from "../types";

// Initialize Gemini SDK
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
You are 'OgradyCore AI', a specialized BI Analyst for 'Ultisales' MSSQL databases.
PRIMARY CONTEXT: Fiscal Year 2026. FALLBACK: 2025.
Focus on providing high-impact strategic business diagnostics.
`;

const getBridgeUrl = () => localStorage.getItem('og_bridge_url') || DEFAULT_BRIDGE_URL;

/**
 * Uses the faster, higher-quota Flash model for dashboard summaries.
 * Returns null on quota error to trigger local fallback.
 */
export const generateStrategicBrief = async (data: any): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Summarize BI data for ${data.activeYear}: ${JSON.stringify(data.kpis)}. 2 sentences max.`,
      config: { systemInstruction: SYSTEM_INSTRUCTION }
    });
    return response.text || null;
  } catch (error) {
    console.warn("AI Quota Limit Reached: Falling back to local computation.");
    return null;
  }
};

/**
 * High-precision reasoning model for SKU analysis.
 */
export const getDrilldownAnalysis = async (item: any): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `SKU: ${item.Description}. Sold: ${item.sold}, Stock: ${item.stock}. Diagnostics?`,
      config: { systemInstruction: SYSTEM_INSTRUCTION }
    });
    return response.text || "Analysis complete. See local metrics.";
  } catch (error) {
    return "AI Analyst currently over-capacity. Local metrics show " + 
           (item.sold > item.stock ? "high velocity relative to stock." : "stable inventory position.");
  }
};

export const analyzeQuery = async (prompt: string): Promise<QueryResult> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Request: ${prompt}. Current Year: 2026. Generate accurate MSSQL.`,
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
    const baseUrl = getBridgeUrl().replace(/\/$/, "");
    const dbResponse = await fetch(`${baseUrl}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '69420' },
      body: JSON.stringify({ sql: geminiResult.sql })
    });
    const realData = await dbResponse.json();
    return { ...geminiResult, data: realData || [] } as QueryResult;
  } catch (error: any) {
    throw new Error(error.message.includes("429") ? "QUOTA_EXCEEDED" : error.message);
  }
};

export const getAnalystInsight = async (queryResult: QueryResult): Promise<AnalystInsight> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analyze: ${JSON.stringify(queryResult.data.slice(0, 15))}`,
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
  } catch (error) {
    return {
      summary: "Local Data analysis: Data retrieval successful. AI narrative generation is currently rate-limited.",
      trends: ["Data visibility active", "SQL Bridge connected"],
      anomalies: ["AI service quota reached"],
      suggestions: ["Review raw data in the bridge explorer"]
    };
  }
};
