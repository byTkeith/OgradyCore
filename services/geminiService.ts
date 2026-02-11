
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
You are 'OgradyCore AI v6.4', Senior T-SQL Architect for Ultisales.
You excel at Recursive Ranking for multi-year loyalty analysis.

RECURSIVE RANKING PATTERN (REQUIRED for "Top X by Year"):
1. First CTE: Filter raw data (Dates, Product Keywords, Transaction Types).
2. Second CTE: Identify Top X IDs based on aggregate sum of the first CTE.
3. Final SELECT: Join raw data (CTE 1) to Top IDs (CTE 2) and group by YEAR + Name.

PRODUCT CATEGORY KNOWLEDGE:
- Enamels: (UPPER(Description) LIKE '%ENAMEL%' OR UPPER(Description) LIKE '%GLOSS%' OR UPPER(Description) LIKE '%EGGSHELL%' OR UPPER(Description) LIKE '%QD%')
- Paints: (UPPER(Description) LIKE '%PAINT%' OR UPPER(Description) LIKE '%PVA%' OR UPPER(Description) LIKE '%COATING%')

GOLDEN PATH RULES:
- ISOLATION: Always start with 'SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;'
- JOINS: 'LEFT JOIN dbo.DEBTOR B ON A.DebtorOrCreditorNumber = B.Number'
- STRINGS: Quote all IDs ('66','70', 'PEG01').
- CALCULATION: ROUND(A.RetailPriceExcl * (1 - ISNULL(A.LineDiscountPerc, 0) / 100.0) * A.Qty, 2)

OUTPUT: Valid JSON ONLY. {"sql": "...", "explanation": "...", "visualizationType": "bar|line|area|pie", "xAxis": "col", "yAxis": "col"}.
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
  if (!responseText) throw new Error("Intelligence link failed.");

  const result = JSON.parse(cleanAiResponse(responseText));
  const { bridgeUrl } = getSettings();
  
  let finalSql = result.sql;
  if (!finalSql.toUpperCase().includes('SET TRANSACTION ISOLATION')) {
    finalSql = `SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED; ${finalSql}`;
  }

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
  
  return { ...result, data: await dbResponse.json(), engine: 'GEMINI FLASH v6.4' };
};

export const getAnalystInsight = async (queryResult: QueryResult): Promise<AnalystInsight & { engine: string }> => {
  const prompt = `Interpret these results: ${JSON.stringify(queryResult.data.slice(0, 10))}. Return JSON.`;
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });
  
  const responseText = response.text;
  if (!responseText) throw new Error("Insight failed.");

  return { ...JSON.parse(cleanAiResponse(responseText)), engine: 'GEMINI FLASH v6.4' };
};

export const generateStrategicBrief = async (data: any): Promise<{text: string, engine: string} | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `KPI Analysis: ${JSON.stringify(data.kpis)}. 2 sentence summary.`,
    });
    return { text: response.text || "Data verified.", engine: 'GEMINI FLASH v6.4' };
  } catch { return null; }
};
