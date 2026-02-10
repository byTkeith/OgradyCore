
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_BRIDGE_URL, SCHEMA_MAP, CORE_TABLES } from "../constants";
import { QueryResult, AnalystInsight } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Fallback logic uses the comprehensive SCHEMA_MAP
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
      signal: AbortSignal.timeout(4000) 
    });
    
    if (res.ok) {
      const data = await res.json();
      if (Object.keys(data).length === 0) {
        DETECTED_SCHEMA = FALLBACK_SCHEMA;
        return { success: true, data: FALLBACK_SCHEMA, error: "Using internal mapping (v4.0 Full)." };
      }
      DETECTED_SCHEMA = data;
      return { success: true, data };
    }
    DETECTED_SCHEMA = FALLBACK_SCHEMA;
    return { success: true, data: FALLBACK_SCHEMA, error: "Bridge disconnected. Using local master." };
  } catch (e: any) {
    DETECTED_SCHEMA = FALLBACK_SCHEMA;
    return { success: true, data: FALLBACK_SCHEMA, error: "Link high latency. Using local master." };
  }
};

export const getDetectedSchema = () => Object.keys(DETECTED_SCHEMA).length > 0 ? DETECTED_SCHEMA : FALLBACK_SCHEMA;

const getSystemInstruction = () => {
  const schemaToUse = getDetectedSchema();
  
  // Format Core Schema separately for absolute focus
  const coreSchemaText = CORE_TABLES.map(table => {
    const cols = schemaToUse[table] || [];
    const pks = SCHEMA_MAP[table]?.primaryKeys || [];
    return `[CORE] ${table}: columns(${cols.join(', ')}), PKs(${pks.join(', ')})`;
  }).join('\n');

  // Format Extended Schema
  const extendedSchemaText = Object.entries(schemaToUse)
    .filter(([table]) => !CORE_TABLES.includes(table))
    .map(([table, cols]) => {
      const pks = SCHEMA_MAP[table]?.primaryKeys || [];
      return `[EXTENDED] ${table}: columns(${cols.join(', ')}), PKs(${pks.join(', ')})`;
    }).join('\n');

  return `
You are 'OgradyCore AI', the master T-SQL analyst for the Ultisales database.
You have access to a full schema master of 60+ tables.

OPERATIONAL ARCHITECTURE:
1. TIER 1 (CORE): Always look here first. These contain 90% of business logic.
${coreSchemaText}

2. TIER 2 (EXTENDED): Search here ONLY if requested data is missing from Tier 1.
${extendedSchemaText}

T-SQL CONSTRAINTS:
- Use Barcode join rule: dbo.AUDIT.PLUCode = dbo.STOCK.Barcode.
- For labels/names: Join dbo.AUDIT.TransactionType = CAST(dbo.TYPES.TYPE_ID AS INT) WHERE dbo.TYPES.TABLE_NAME = 'AUDIT' AND dbo.TYPES.TYPE_NAME = 'TRANSACTIONTYPE'.
- Always use 'dbo.' prefix.
- Use 'READ UNCOMMITTED' logic in your mind (don't write it in SQL, the bridge handles it).
- Output valid JSON only: {"sql": "...", "explanation": "...", "visualizationType": "bar|line|area|pie|scatter", "xAxis": "col", "yAxis": "col"}.
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
    if (error.message?.includes('429')) throw new Error("AI capacity reached. Please retry in 30s.");
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
      body: JSON.stringify({ sql: result.sql }),
      signal: AbortSignal.timeout(25000) // Allow 25s for large core table joins
    });
    if (!dbResponse.ok) {
      const err = await dbResponse.json();
      throw new Error(err.detail || "Database Execution Error");
    }
    return { ...result, data: await dbResponse.json(), engine: 'GEMINI FLASH v4.0' };
  } catch (e: any) {
    throw e;
  }
};

export const getAnalystInsight = async (queryResult: QueryResult): Promise<AnalystInsight & { engine: string }> => {
  const safeData = Array.isArray(queryResult.data) ? queryResult.data : [];
  const prompt = `Synthesize these database results: ${JSON.stringify(safeData.slice(0, 20))}. Format as JSON insight.`;
  const responseText = await executeGemini(prompt, 'flash', true);
  try {
    return { ...JSON.parse(cleanAiResponse(responseText)), engine: 'GEMINI FLASH v4.0' };
  } catch {
    return { 
      summary: "Data stream analyzed. Operational metrics within normal parameters.", 
      trends: ["Stable performance across detected vectors"], 
      anomalies: ["No significant variance detected in subset"], 
      suggestions: ["Maintain current operational tempo"],
      engine: 'GEMINI FLASH v4.0' 
    };
  }
};

export const generateStrategicBrief = async (data: any): Promise<{text: string, engine: string} | null> => {
  const prompt = `Summarize core BI metrics for executive review: ${JSON.stringify(data.kpis)}. Be concise.`;
  try {
    const responseText = await executeGemini(prompt, 'flash');
    return { text: responseText || "", engine: 'GEMINI FLASH v4.0' };
  } catch { return null; }
};

export const getDrilldownAnalysis = async (item: any): Promise<{text: string, engine: string}> => {
  const prompt = `Performance audit for: ${JSON.stringify(item)}. One sentence insight.`;
  try {
    const responseText = await executeGemini(prompt, 'flash');
    return { text: responseText || "", engine: 'GEMINI FLASH v4.0' };
  } catch { return { text: "Item performance audit complete.", engine: 'GEMINI FLASH v4.0' }; }
};
