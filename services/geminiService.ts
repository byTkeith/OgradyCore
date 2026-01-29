
import { GoogleGenAI, Type } from "@google/genai";
import { DEFAULT_BRIDGE_URL } from "../constants";
import { QueryResult, AnalystInsight, AIProvider } from "../types";

// Gemini SDK Setup
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
You are 'OgradyCore AI', a specialized BI Analyst for 'Ultisales' MSSQL databases.
THE CURRENT FISCAL YEAR IS 2026. Fallback comparison year is 2025.
Always use 'dbo.' and UPPERCASE for tables. 
Join AUDIT.PLUCode to STOCK.Barcode.
Ensure all SQL queries are optimized for MSSQL and provide 100% accurate data retrieval.
Return ONLY JSON when requested. 
For SQL generation: Use keys 'sql', 'explanation', 'visualizationType' (bar, line, pie, area), 'xAxis', 'yAxis'.
`;

const getSettings = () => ({
  provider: (localStorage.getItem('og_ai_provider') as AIProvider) || 'AUTO',
  ollamaModel: localStorage.getItem('og_ollama_model') || 'llama3.1:8b',
  bridgeUrl: localStorage.getItem('og_bridge_url') || DEFAULT_BRIDGE_URL
});

function cleanAiResponse(raw: string): string {
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (cleaned.includes('{') && cleaned.includes('}')) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

/**
 * Optimized callOllama: Now routes through the Bridge Proxy
 * to ensure worldwide availability via the server's resources.
 */
async function callOllama(prompt: string, json: boolean = false) {
  const { bridgeUrl, ollamaModel } = getSettings();
  const baseUrl = bridgeUrl.replace(/\/$/, "");
  
  try {
    const response = await fetch(`${baseUrl}/ollama-proxy`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420'
      },
      body: JSON.stringify({
        model: ollamaModel,
        prompt: `${SYSTEM_INSTRUCTION}\n\nTask: ${prompt}`,
        stream: false,
        format: json ? 'json' : undefined
      }),
    });
    
    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "BRIDGE_OLLAMA_ERROR");
    }
    
    const data = await response.json();
    return cleanAiResponse(data.response);
  } catch (e: any) {
    console.error("Bridge AI unreachable:", e.message);
    throw new Error("OLLAMA_PROXY_OFFLINE");
  }
}

async function smartExecute(task: string, model: 'flash' | 'pro', json: boolean = false) {
  const settings = getSettings();
  const modelName = model === 'flash' ? 'gemini-3-flash-preview' : 'gemini-3-pro-preview';

  if (settings.provider === 'OLLAMA') {
    return { response: await callOllama(task, json), engine: 'OLLAMA' };
  }

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: task,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: json ? "application/json" : undefined
      }
    });
    return { response: response.text, engine: 'GEMINI' };
  } catch (error: any) {
    const isQuotaError = error?.message?.includes("429") || error?.status === 429;
    
    if (settings.provider === 'AUTO' || isQuotaError) {
      console.warn("Gemini limit reached or auto-fallback active. Routing through Server Bridge to Ollama...");
      try {
        const localRes = await callOllama(task, json);
        return { response: localRes, engine: 'OLLAMA' };
      } catch (ollamaErr: any) {
        throw new Error(isQuotaError ? "GEMINI_QUOTA_EXCEEDED_AND_OLLAMA_OFFLINE" : "AI_NETWORK_FAILURE");
      }
    }
    throw error;
  }
}

export const generateStrategicBrief = async (data: any): Promise<{text: string, engine: string} | null> => {
  const prompt = `Summarize BI data for ${data.activeYear}: ${JSON.stringify(data.kpis)}. 2 sentences max.`;
  try {
    const { response, engine } = await smartExecute(prompt, 'flash');
    return { text: response || "", engine };
  } catch (error) {
    return null;
  }
};

export const getDrilldownAnalysis = async (item: any): Promise<{text: string, engine: string}> => {
  const prompt = `SKU: ${item.Description}. Sold: ${item.sold}, Stock: ${item.stock}. Performance diagnostic?`;
  try {
    const { response, engine } = await smartExecute(prompt, 'pro');
    return { text: response || "", engine };
  } catch (error) {
    return { text: "Manual stock review suggested.", engine: "LOCAL_SQL" };
  }
};

export const analyzeQuery = async (prompt: string): Promise<QueryResult & { engine: string }> => {
  const settings = getSettings();
  const task = `Request: ${prompt}. Current Year: 2026. Generate JSON for Ultisales.`;
  const { response, engine } = await smartExecute(task, 'pro', true);
  
  try {
    let result = JSON.parse(response || '{}');
    if (result.sql) {
      result.sql = result.sql
        .replace(/dbo\.STOCK\.PLUCode/gi, 'dbo.STOCK.Barcode')
        .replace(/tbl/gi, 'dbo.')
        .replace(/dbo\.(\w+)/g, (match: string) => match.toUpperCase())
        .replace(/DBO\./g, 'dbo.');
    }

    const baseUrl = settings.bridgeUrl.replace(/\/$/, "");
    const dbResponse = await fetch(`${baseUrl}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '69420' },
      body: JSON.stringify({ sql: result.sql })
    });
    const realData = await dbResponse.json();
    
    return { ...result, data: realData || [], engine };
  } catch (e) {
    throw e;
  }
};

export const getAnalystInsight = async (queryResult: QueryResult): Promise<AnalystInsight & { engine: string }> => {
  const task = `Analyze this dataset: ${JSON.stringify(queryResult.data.slice(0, 15))}. Provide JSON insights.`;
  const { response, engine } = await smartExecute(task, 'pro', true);
  try {
    return { ...JSON.parse(response || '{}'), engine };
  } catch (e) {
    return {
      summary: "Data retrieved, but AI narration failed.",
      trends: [], anomalies: [], suggestions: [], engine
    };
  }
};
