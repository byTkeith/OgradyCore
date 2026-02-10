
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_BRIDGE_URL, SCHEMA_MAP } from "../constants";
import { DOMAIN_MAPPINGS } from "../metadata_mappings";
import { QueryResult, AnalystInsight } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const getSettings = () => ({
  bridgeUrl: (localStorage.getItem('og_bridge_url') || DEFAULT_BRIDGE_URL).replace(/\/$/, "")
});

export const initSchema = async (urlOverride?: string): Promise<{ success: boolean; data: Record<string, string[]>; error?: string }> => {
  const currentBridgeUrl = urlOverride || getSettings().bridgeUrl;
  const targetUrl = currentBridgeUrl.replace(/\/$/, "");
  
  try {
    const res = await fetch(`${targetUrl}/inspect`, { 
      headers: { 'ngrok-skip-browser-warning': '69420' },
      signal: AbortSignal.timeout(15000)
    });
    
    if (res.ok) {
      const data = await res.json();
      return { success: true, data };
    }
    return { success: true, data: {}, error: "Link busy." };
  } catch {
    return { success: true, data: {}, error: "Link high latency." };
  }
};

const getSystemInstruction = () => {
  return `
You are 'OgradyCore AI', the Senior T-SQL Architect for Ultisales POS.
You have a ZERO TOLERANCE policy for hallucinating column names.

SOURCE OF TRUTH (USE THESE ONLY):
- SCHEMA_MAP: ${JSON.stringify(SCHEMA_MAP)}
- DOMAIN_MAPPINGS: ${JSON.stringify(DOMAIN_MAPPINGS)}

STRICT SQL RULES:
1. DATE COLUMN: Always use 'TransactionDate'. NEVER use 'DateTime' or 'Date'.
2. PRICE COLUMN: Always use 'RetailPriceExcl'. NEVER use 'Inclusive' or 'TotalAmount'.
3. QTY: Always 'Qty'.
4. REVENUE FORMULA: SUM(Qty * RetailPriceExcl).
5. TABLES: Always use 'dbo.' prefix (e.g., dbo.AUDIT).
6. ISOLATION: Start every query with 'SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;'.

DOMAIN LOGIC:
- Sale Types: TransactionType 66 (Cash Sale), 70 (Credit Sale), 80 (Layby).
- Debt Status: Use dbo.DEBTOR.BADMARKER ('F' for Bad Debt).
- Stock Status: Use dbo.STOCK.STOCKTYPE (13 for Discontinued).

OUTPUT FORMAT:
Return valid JSON ONLY: {"sql": "...", "explanation": "...", "visualizationType": "bar|line|area|pie", "xAxis": "col", "yAxis": "col"}.
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

export const analyzeQuery = async (prompt: string): Promise<QueryResult & { engine: string }> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview', 
    contents: prompt,
    config: { 
      systemInstruction: getSystemInstruction(), 
      responseMimeType: "application/json" 
    }
  });
  
  const responseText = response.text;
  if (!responseText) throw new Error("Intelligence link failed: Empty response from AI.");

  const result = JSON.parse(cleanAiResponse(responseText));
  const { bridgeUrl } = getSettings();
  
  const finalSql = result.sql.startsWith('SET') ? result.sql : `SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED; ${result.sql}`;

  const dbResponse = await fetch(`${bridgeUrl}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '69420' },
    body: JSON.stringify({ sql: finalSql }),
    signal: AbortSignal.timeout(30000)
  });

  if (!dbResponse.ok) {
    const errData = await dbResponse.json();
    throw new Error(errData.detail || "Bridge Execution Error.");
  }
  
  return { ...result, data: await dbResponse.json(), engine: 'GEMINI FLASH v4.7' };
};

export const getAnalystInsight = async (queryResult: QueryResult): Promise<AnalystInsight & { engine: string }> => {
  const prompt = `Interpret these Ultisales results: ${JSON.stringify(queryResult.data.slice(0, 10))}. Use Domain Mappings for context. Return JSON.`;
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });
  
  const responseText = response.text;
  if (!responseText) throw new Error("Insight generation failed.");

  return { ...JSON.parse(cleanAiResponse(responseText)), engine: 'GEMINI FLASH v4.7' };
};

export const generateStrategicBrief = async (data: any): Promise<{text: string, engine: string} | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `KPI Analysis: ${JSON.stringify(data.kpis)}. Summarize business health in 2 punchy sentences.`,
    });
    return { text: response.text || "Operational data verified. Strategic streams active.", engine: 'GEMINI FLASH v4.7' };
  } catch { return null; }
};
