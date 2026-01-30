
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_BRIDGE_URL, SCHEMA_MAP } from "../constants";
import { QueryResult, AnalystInsight, AIProvider } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SCHEMA_CONTEXT = Object.entries(SCHEMA_MAP).map(([table, details]) => {
  return `Table: ${table}\nColumns: ${(details as any).fields.join(', ')}`;
}).join('\n\n');

const SYSTEM_INSTRUCTION = `
You are 'OgradyCore AI', a T-SQL expert for Ultisales.
ONLY use these tables: dbo.AUDIT, dbo.STOCK, dbo.TYPES, dbo.DEBTOR.

CRITICAL MAPPING RULES (DO NOT IGNORE):
- Use 'PLUCode' NOT 'Barcode'.
- Use 'Description' NOT 'ItemDescription'.
- Use 'TransactionDate' NOT 'LastAuditDate'.
- Sales Total = SUM(Qty * RetailPriceExcl).
- Joins: dbo.AUDIT.PLUCode = dbo.STOCK.PLUCode.

Return JSON: {"sql": "...", "explanation": "...", "visualizationType": "...", "xAxis": "...", "yAxis": "..."}
`;

const getSettings = () => ({
  provider: (localStorage.getItem('og_ai_provider') as AIProvider) || 'AUTO',
  ollamaModel: localStorage.getItem('og_ollama_model') || 'deepseek-r1:8b',
  bridgeUrl: localStorage.getItem('og_bridge_url') || DEFAULT_BRIDGE_URL
});

/**
 * AGGRESSIVE SQL REPAIR ENGINE v2.9
 * Specifically handles DeepSeek reasoning outputs and forces column mapping.
 */
function repairSql(sql: string): string {
  if (!sql) return "";
  
  let repaired = sql;
  
  // 1. Force Barcode -> PLUCode
  repaired = repaired.replace(/([a-zA-Z0-9_]+\.)?Barcode/gi, (match) => {
    return match.includes('.') ? match.split('.')[0] + '.PLUCode' : 'PLUCode';
  });

  // 2. Force ItemDescription -> Description
  repaired = repaired.replace(/ItemDescription/gi, 'Description');

  // 3. Force LastAuditDate -> TransactionDate
  repaired = repaired.replace(/LastAuditDate/gi, 'TransactionDate');

  // 4. Case correction for dbo prefix
  repaired = repaired.replace(/dbo\.(\w+)/gi, (m) => m.toLowerCase());
  repaired = repaired.replace(/dbo\./g, 'dbo.');
  
  // 5. Ensure final SQL has proper casing for system commands
  const commands = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'JOIN', 'LEFT JOIN', 'SUM', 'AVG', 'COUNT', 'TOP'];
  commands.forEach(cmd => {
    const reg = new RegExp(`\\b${cmd}\\b`, 'gi');
    repaired = repaired.replace(reg, cmd);
  });

  return repaired;
}

function cleanAiResponse(raw: string): string {
  // DeepSeek-R1 specifically uses <think> tags for chain-of-thought
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  
  // Also remove markdown blocks if present
  cleaned = cleaned.replace(/```json/gi, '').replace(/```/gi, '').trim();

  if (cleaned.includes('{') && cleaned.includes('}')) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

async function callOllama(prompt: string, json: boolean = false) {
  const { bridgeUrl, ollamaModel } = getSettings();
  const baseUrl = bridgeUrl.replace(/\/$/, "");
  try {
    const response = await fetch(`${baseUrl}/ollama-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '69420' },
      body: JSON.stringify({
        model: ollamaModel,
        prompt: `${SYSTEM_INSTRUCTION}\n\nTask: ${prompt}\n\nJSON Output:`,
        stream: false,
        format: json ? 'json' : undefined
      }),
    });
    
    const data = await response.json();
    
    if (response.status === 503 || response.status === 500) {
      const errorDetail = data.detail || "Ollama error";
      throw new Error(`OLLAMA_ERROR: ${errorDetail}`);
    }
    
    return cleanAiResponse(data.response || "");
  } catch (e: any) {
    if (e.message.includes('OLLAMA_ERROR')) throw e;
    throw new Error("BRIDGE_OFFLINE: Ensure main.py is running.");
  }
}

async function smartExecute(task: string, model: 'flash' | 'pro', json: boolean = false) {
  const settings = getSettings();
  if (settings.provider === 'OLLAMA') return { response: await callOllama(task, json), engine: 'OLLAMA' };

  try {
    const response = await ai.models.generateContent({
      model: model === 'flash' ? 'gemini-3-flash-preview' : 'gemini-3-pro-preview',
      contents: task,
      config: { systemInstruction: SYSTEM_INSTRUCTION, responseMimeType: json ? "application/json" : undefined }
    });
    return { response: response.text, engine: 'GEMINI' };
  } catch (error: any) {
    if (settings.provider === 'AUTO' || error?.status === 429) {
      const localRes = await callOllama(task, json);
      return { response: localRes, engine: 'OLLAMA' };
    }
    throw error;
  }
}

export const analyzeQuery = async (prompt: string): Promise<QueryResult & { engine: string }> => {
  const { response, engine } = await smartExecute(prompt, 'pro', true);
  try {
    let result = JSON.parse(response || '{}');
    if (result.sql) {
      result.sql = repairSql(result.sql);
    }

    const settings = getSettings();
    const dbResponse = await fetch(`${settings.bridgeUrl.replace(/\/$/, "")}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '69420' },
      body: JSON.stringify({ sql: result.sql })
    });

    if (!dbResponse.ok) {
      const err = await dbResponse.json();
      throw new Error(err.detail || "Database Error");
    }

    return { ...result, data: await dbResponse.json(), engine };
  } catch (e: any) { throw e; }
};

export const generateStrategicBrief = async (data: any): Promise<{text: string, engine: string} | null> => {
  const prompt = `Summarize BI metrics for ${data.activeYear}: ${JSON.stringify(data.kpis)}. 2 sentences max.`;
  try {
    const { response, engine } = await smartExecute(prompt, 'flash');
    return { text: response || "", engine };
  } catch { return null; }
};

export const getDrilldownAnalysis = async (item: any): Promise<{text: string, engine: string}> => {
  const prompt = `Analyze product: ${item.Description}. Sold: ${item.sold}, Stock: ${item.stock}. Performance?`;
  try {
    const { response, engine } = await smartExecute(prompt, 'pro');
    return { text: response || "", engine };
  } catch { return { text: "Manual review suggested.", engine: "LOCAL" }; }
};

export const getAnalystInsight = async (queryResult: QueryResult): Promise<AnalystInsight & { engine: string }> => {
  const safeData = Array.isArray(queryResult.data) ? queryResult.data : [];
  const prompt = `Analyze this dataset: ${JSON.stringify(safeData.slice(0, 15))}. Provide JSON insights.`;
  const { response, engine } = await smartExecute(prompt, 'pro', true);
  try {
    return { ...JSON.parse(response || '{}'), engine };
  } catch {
    return { summary: "Data retrieved. AI narrative engine busy.", trends: [], anomalies: [], suggestions: [], engine };
  }
};
