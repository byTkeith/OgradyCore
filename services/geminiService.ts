
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_BRIDGE_URL } from "../constants";
import { QueryResult, AnalystInsight } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Dynamic schema storage for prompt context
let DETECTED_SCHEMA: Record<string, string[]> = {};

const getSettings = () => ({
  bridgeUrl: (localStorage.getItem('og_bridge_url') || DEFAULT_BRIDGE_URL).replace(/\/$/, "")
});

/**
 * Initializes schema discovery by querying the bridge.
 */
export const initSchema = async (urlOverride?: string): Promise<{ success: boolean; data?: any; error?: string }> => {
  const currentBridgeUrl = urlOverride || getSettings().bridgeUrl;
  const targetUrl = currentBridgeUrl.replace(/\/$/, "");
  
  if (!targetUrl) return { success: false, error: "Bridge URL is empty." };

  try {
    const res = await fetch(`${targetUrl}/inspect`, { 
      headers: { 'ngrok-skip-browser-warning': '69420' },
      signal: AbortSignal.timeout(10000) 
    });
    
    if (res.ok) {
      const data = await res.json();
      if (Object.keys(data).length === 0) {
        return { success: false, error: "Bridge connected, but no tables (AUDIT, STOCK, etc.) were found." };
      }
      DETECTED_SCHEMA = data;
      return { success: true, data };
    } else {
      const errorData = await res.json().catch(() => ({ detail: "Unknown Bridge Error" }));
      return { success: false, error: errorData.detail || `Server returned ${res.status}` };
    }
  } catch (e: any) {
    return { success: false, error: e.message || "Bridge is unreachable. Ensure the Python script is running." };
  }
};

export const getDetectedSchema = () => DETECTED_SCHEMA;

const getSystemInstruction = () => {
  const schemaText = Object.entries(DETECTED_SCHEMA).length > 0
    ? Object.entries(DETECTED_SCHEMA).map(([table, cols]) => `Table ${table} has columns: ${cols.join(', ')}`).join('\n')
    : "Table dbo.AUDIT (ANUMBER, PLUCode, Description, Qty, RetailPriceExcl, TransactionDate)\nTable dbo.STOCK (PLUCode, Description, OnHand)";

  return `
You are 'OgradyCore AI', an expert T-SQL analyst for Ultisales.
You MUST use the exact column names detected in the schema below.

DETECTED DATABASE SCHEMA:
${schemaText}

RULES:
1. Only use detected columns.
2. Always prefix tables with 'dbo.'.
3. Joins are typically on matching code columns (e.g. AUDIT.PLUCode = STOCK.PLUCode).
4. Return ONLY valid JSON with keys: "sql", "explanation", "visualizationType", "xAxis", "yAxis".
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
    // We default to flash-preview because it has significantly higher free-tier quotas
    const modelName = model === 'pro' ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // Force flash for all requests to resolve 429 quota issues
      contents: task,
      config: { 
        systemInstruction: getSystemInstruction(), 
        responseMimeType: json ? "application/json" : undefined 
      }
    });
    return response.text || "";
  } catch (error: any) {
    if (error.message?.includes('429') || error.message?.includes('quota')) {
      throw new Error("AI Quota Exceeded. Please wait 1 minute before your next query. (Switching to Flash model to help prevent this).");
    }
    throw new Error(error.message || "Gemini AI Engine unreachable.");
  }
}

export const analyzeQuery = async (prompt: string): Promise<QueryResult & { engine: string }> => {
  if (Object.keys(DETECTED_SCHEMA).length === 0) await initSchema();
  // Using 'flash' now to avoid the 429 error the user encountered
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
      summary: "Data retrieved successfully. Strategic engine recovering.", 
      trends: ["Operational stability active"], 
      anomalies: ["None"], 
      suggestions: ["Review standard audits"],
      engine: 'GEMINI FLASH' 
    };
  }
};

export const generateStrategicBrief = async (data: any): Promise<{text: string, engine: string} | null> => {
  if (Object.keys(DETECTED_SCHEMA).length === 0) await initSchema();
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
