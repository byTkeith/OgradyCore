
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
  ollamaUrl: localStorage.getItem('og_ollama_url') || 'http://localhost:11434',
  ollamaModel: localStorage.getItem('og_ollama_model') || 'llama3.1:8b',
  bridgeUrl: localStorage.getItem('og_bridge_url') || DEFAULT_BRIDGE_URL
});

/**
 * Clean AI Output: Reasoning models like DeepSeek-R1 wrap thoughts in <think> tags.
 * We must remove these to extract the clean JSON or Text.
 */
function cleanAiResponse(raw: string): string {
  // Remove <think>...</think> blocks
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // If we are looking for JSON, try to find the first '{' and last '}'
  if (cleaned.includes('{') && cleaned.includes('}')) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

/**
 * Ollama Bridge: Local execution to bypass cloud quota
 */
async function callOllama(prompt: string, json: boolean = false) {
  const { ollamaUrl, ollamaModel } = getSettings();
  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      body: JSON.stringify({
        model: ollamaModel,
        prompt: `${SYSTEM_INSTRUCTION}\n\nTask: ${prompt}`,
        stream: false,
        format: json ? 'json' : undefined
      }),
    });
    if (!response.ok) throw new Error("OLLAMA_HTTP_ERROR");
    const data = await response.json();
    return cleanAiResponse(data.response);
  } catch (e) {
    console.error("Ollama offline or unreachable at:", ollamaUrl);
    throw new Error("OLLAMA_OFFLINE");
  }
}

/**
 * Hybrid Execution Core: Automatically routes to Ollama if Gemini fails
 */
async function smartExecute(task: string, model: 'flash' | 'pro', json: boolean = false) {
  const settings = getSettings();
  const modelName = model === 'flash' ? 'gemini-3-flash-preview' : 'gemini-3-pro-preview';

  // 1. Direct Ollama if explicitly set
  if (settings.provider === 'OLLAMA') {
    return { response: await callOllama(task, json), engine: 'OLLAMA' };
  }

  // 2. Try Gemini first (or if AUTO)
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
    
    // 3. Auto-fallback to Ollama on Gemini failure
    if (settings.provider === 'AUTO' || isQuotaError) {
      console.warn("Gemini limit reached or auto-fallback active. Routing to local Ollama...");
      try {
        const localRes = await callOllama(task, json);
        return { response: localRes, engine: 'OLLAMA' };
      } catch (ollamaErr) {
        throw new Error(isQuotaError ? "GEMINI_QUOTA_EXCEEDED_AND_OLLAMA_OFFLINE" : "AI_NETWORK_FAILURE");
      }
    }
    throw error;
  }
}

export const generateStrategicBrief = async (data: any): Promise<{text: string, engine: string} | null> => {
  const prompt = `Summarize BI data for ${data.activeYear}: ${JSON.stringify(data.kpis)}. 2 sentences max. Focus on growth vs 2025.`;
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
    return { text: "Strategic insight paused. Manual stock review suggested.", engine: "LOCAL_SQL" };
  }
};

export const analyzeQuery = async (prompt: string): Promise<QueryResult & { engine: string }> => {
  const settings = getSettings();
  const task = `Request: ${prompt}. Current Year: 2026. Generate JSON for Ultisales.`;

  const { response, engine } = await smartExecute(task, 'pro', true);
  
  try {
    let result = JSON.parse(response || '{}');
    
    // Sanitization for MSSQL Compatibility
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
    console.error("Failed to parse AI response as JSON:", response);
    throw new Error("AI_INVALID_FORMAT");
  }
};

export const getAnalystInsight = async (queryResult: QueryResult): Promise<AnalystInsight & { engine: string }> => {
  const task = `Analyze this dataset: ${JSON.stringify(queryResult.data.slice(0, 15))}. Provide JSON insights.`;
  const { response, engine } = await smartExecute(task, 'pro', true);
  try {
    return { ...JSON.parse(response || '{}'), engine };
  } catch (e) {
    return {
      summary: "Data retrieved, but AI narration format was invalid.",
      trends: [], anomalies: [], suggestions: [], engine
    };
  }
};
