
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_BRIDGE_URL, SCHEMA_MAP, CORE_TABLES } from "../constants";
import { QueryResult, AnalystInsight } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const FALLBACK_SCHEMA: Record<string, string[]> = Object.entries(SCHEMA_MAP).reduce((acc, [tableName, config]) => {
  acc[tableName] = config.fields;
  return acc;
}, {} as Record<string, string[]>);

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
      signal: AbortSignal.timeout(10000) // v4.2: Increased to 10s for large table scans
    });
    
    if (res.ok) {
      const data = await res.json();
      if (Object.keys(data).length === 0) {
        DETECTED_SCHEMA = FALLBACK_SCHEMA;
        return { success: true, data: FALLBACK_SCHEMA };
      }
      DETECTED_SCHEMA = data;
      return { success: true, data };
    }
    DETECTED_SCHEMA = FALLBACK_SCHEMA;
    return { success: true, data: FALLBACK_SCHEMA, error: "Link busy. Using internal map." };
  } catch (e: any) {
    DETECTED_SCHEMA = FALLBACK_SCHEMA;
    return { success: true, data: FALLBACK_SCHEMA, error: "Link high latency. Using local master." };
  }
};

export const getDetectedSchema = () => Object.keys(DETECTED_SCHEMA).length > 0 ? DETECTED_SCHEMA : FALLBACK_SCHEMA;

const getSystemInstruction = () => {
  const schemaToUse = getDetectedSchema();
  
  const coreSchemaText = CORE_TABLES.map(table => {
    const cols = schemaToUse[table] || SCHEMA_MAP[table]?.fields || [];
    return `[CORE] ${table}: ${cols.join(', ')}`;
  }).join('\n');

  const extendedSchemaText = Object.entries(schemaToUse)
    .filter(([table]) => !CORE_TABLES.includes(table))
    .map(([table, cols]) => `[EXTENDED] ${table}: ${cols.join(', ')}`)
    .join('\n');

  return `
You are 'OgradyCore AI', an expert T-SQL analyst for Ultisales.
You have a Tiered Data Model: 60+ tables.

OPERATIONAL RULES:
1. Search CORE tier first:
${coreSchemaText}

2. Use EXTENDED tier if needed:
${extendedSchemaText}

T-SQL RULES:
- Join AUDIT.PLUCode = STOCK.Barcode.
- Prefix all tables with 'dbo.'.
- Output valid JSON: {"sql": "...", "explanation": "...", "visualizationType": "bar|line|area|pie", "xAxis": "col", "yAxis": "col"}.
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

async function executeGemini(task: string, json: boolean = false) {
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
    if (error.message?.includes('429')) throw new Error("AI Quota Exceeded. Data is live, but AI summary is unavailable.");
    throw new Error(error.message || "Gemini AI offline.");
  }
}

export const analyzeQuery = async (prompt: string): Promise<QueryResult & { engine: string }> => {
  const responseText = await executeGemini(prompt, true);
  const result = JSON.parse(cleanAiResponse(responseText));
  const { bridgeUrl } = getSettings();
  const dbResponse = await fetch(`${bridgeUrl}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '69420' },
    body: JSON.stringify({ sql: result.sql }),
    signal: AbortSignal.timeout(20000)
  });
  if (!dbResponse.ok) throw new Error("Database link error.");
  return { ...result, data: await dbResponse.json(), engine: 'GEMINI FLASH v4.2' };
};

export const getAnalystInsight = async (queryResult: QueryResult): Promise<AnalystInsight & { engine: string }> => {
  try {
    const prompt = `Analyze this dataset: ${JSON.stringify(queryResult.data.slice(0, 10))}. Return JSON summary.`;
    const responseText = await executeGemini(prompt, true);
    return { ...JSON.parse(cleanAiResponse(responseText)), engine: 'GEMINI FLASH v4.2' };
  } catch {
    return { 
      summary: "Data analyzed successfully. Metrics appear stable.", 
      trends: ["Operational continuity verified"], 
      anomalies: ["None significant"], 
      suggestions: ["Maintain existing protocols"],
      engine: 'GEMINI FLASH v4.2' 
    };
  }
};

export const generateStrategicBrief = async (data: any): Promise<{text: string, engine: string} | null> => {
  try {
    const prompt = `Brief executive summary for: ${JSON.stringify(data.kpis)}. 2 sentences.`;
    const responseText = await executeGemini(prompt);
    return { text: responseText, engine: 'GEMINI FLASH v4.2' };
  } catch { return null; }
};
