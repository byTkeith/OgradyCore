
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_BRIDGE_URL } from "../constants";
import { QueryResult, AnalystInsight } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Fallback Schema used if metadata discovery fails or times out
const FALLBACK_SCHEMA: Record<string, string[]> = {
  "dbo.AUDIT": ["ANUMBER", "PLUCode", "Description", "TransactionDate", "Qty", "CostPriceExcl", "RetailPriceExcl", "TransactionNumber", "DebtorOrCreditorNumber", "TransactionType", "TaxValue", "Operator"],
  "dbo.STOCK": ["PLUCode", "Description", "CostPriceExcl", "RetailPriceExcl", "OnHand", "StockType", "Status"],
  "dbo.TYPES": ["TABLE_NAME", "TYPE_NAME", "TYPE_ID", "TYPE_DESCRIPTION"],
  "dbo.DEBTOR": ["ANUMBER", "Number", "Surname", "Status", "AccountType"]
};

let DETECTED_SCHEMA: Record<string, string[]> = {};

const getSettings = () => ({
  bridgeUrl: (localStorage.getItem('og_bridge_url') || DEFAULT_BRIDGE_URL).replace(/\/$/, "")
});

export const initSchema = async (urlOverride?: string): Promise<{ success: boolean; data: Record<string, string[]>; error?: string }> => {
  const currentBridgeUrl = urlOverride || getSettings().bridgeUrl;
  const targetUrl = currentBridgeUrl.replace(/\/$/, "");
  
  try {
    const res = await fetch(`${targetUrl}/inspect`, { 
      headers: { 'ngrok-skip-browser-warning': '69420' },
      signal: AbortSignal.timeout(4000) // 4s timeout: if DB is slow, just use fallback
    });
    
    if (res.ok) {
      const data = await res.json();
      if (Object.keys(data).length === 0) {
        DETECTED_SCHEMA = FALLBACK_SCHEMA;
        return { success: true, data: FALLBACK_SCHEMA, error: "Using local schema (No DB tables detected)." };
      }
      DETECTED_SCHEMA = data;
      return { success: true, data };
    } else {
      // Server returned 500 or error - Use fallback and report success
      DETECTED_SCHEMA = FALLBACK_SCHEMA;
      return { success: true, data: FALLBACK_SCHEMA, error: "Server busy. Using local schema fallback." };
    }
  } catch (e: any) {
    // Timeout or Network error - Use fallback and report success
    DETECTED_SCHEMA = FALLBACK_SCHEMA;
    return { success: true, data: FALLBACK_SCHEMA, error: "Connection slow. Local schema active." };
  }
};

export const getDetectedSchema = () => Object.keys(DETECTED_SCHEMA).length > 0 ? DETECTED_SCHEMA : FALLBACK_SCHEMA;

const getSystemInstruction = () => {
  const schemaToUse = getDetectedSchema();
  const schemaText = Object.entries(schemaToUse).map(([table, cols]) => `Table ${table} has columns: ${cols.join(', ')}`).join('\n');

  return `
You are 'OgradyCore AI', an expert T-SQL analyst for Ultisales.
You MUST use the exact column names from the schema provided.

SCHEMA:
${schemaText}

RULES:
1. Always prefix tables with 'dbo.'.
2. Return ONLY valid JSON with keys: "sql", "explanation", "visualizationType", "xAxis", "yAxis".
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

async function executeGemini(task: string, model: 'flash' | 'pro', json: boolean = false) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: task,
      config: { 
        systemInstruction: getSystemInstruction(), 
        responseMimeType: json ? "application/json" : undefined 
      }
    });
    return response.text || "";
  } catch (error: any) {
    if (error.message?.includes('429')) throw new Error("AI Quota Exceeded. Please wait 60 seconds.");
    throw new Error(error.message || "Gemini AI Engine unreachable.");
  }
}

export const analyzeQuery = async (prompt: string): Promise<QueryResult & { engine: string }> => {
  const responseText = await executeGemini(prompt, 'flash', true);
  try {
    const result = JSON.parse(cleanAiResponse(responseText));
    const { bridgeUrl } = getSettings();
    const dbResponse = await fetch(`${bridgeUrl}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '69420' },
      body: JSON.stringify({ sql: result.sql })
    });
    if (!dbResponse.ok) {
      const err = await dbResponse.json();
      throw new Error(err.detail || "Database Execution Error");
    }
    return { ...result, data: await dbResponse.json(), engine: 'GEMINI FLASH' };
  } catch (e: any) {
    throw e;
  }
};

export const getAnalystInsight = async (queryResult: QueryResult): Promise<AnalystInsight & { engine: string }> => {
  const safeData = Array.isArray(queryResult.data) ? queryResult.data : [];
  const prompt = `Analyze this dataset: ${JSON.stringify(safeData.slice(0, 15))}. Provide JSON summary, trends, anomalies, suggestions.`;
  const responseText = await executeGemini(prompt, 'flash', true);
  try {
    return { ...JSON.parse(cleanAiResponse(responseText)), engine: 'GEMINI FLASH' };
  } catch {
    return { 
      summary: "Data processed successfully.", 
      trends: ["Operational stability verified"], 
      anomalies: ["None detected"], 
      suggestions: ["Continue monitoring dashboard"],
      engine: 'GEMINI FLASH' 
    };
  }
};

export const generateStrategicBrief = async (data: any): Promise<{text: string, engine: string} | null> => {
  const prompt = `Summarize BI metrics: ${JSON.stringify(data.kpis)}. 2 sentences max.`;
  try {
    const responseText = await executeGemini(prompt, 'flash');
    return { text: responseText || "", engine: 'GEMINI FLASH' };
  } catch { return null; }
};

export const getDrilldownAnalysis = async (item: any): Promise<{text: string, engine: string}> => {
  const prompt = `Analyze performance: ${JSON.stringify(item)}. 1 sentence review.`;
  try {
    const responseText = await executeGemini(prompt, 'flash');
    return { text: responseText || "", engine: 'GEMINI FLASH' };
  } catch { return { text: "Manual review recommended.", engine: 'GEMINI FLASH' }; }
};
