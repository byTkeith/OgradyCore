
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_BRIDGE_URL, SALES_TRANSACTION_TYPES } from "../constants";
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
  // We inject the comprehensive list of sales types derived from the PDF
  const validSalesTypes = SALES_TRANSACTION_TYPES.join("','");

  return `
You are 'OgradyCore AI v7.1', the Principal T-SQL Architect for the UltiSales ERP Database.
Your directive is to generate high-performance T-SQL queries using the documented schema.

### 1. THE GOLDEN RULES
- **Isolation:** ALWAYS start with \`SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;\`
- **Identifying Sales:** When calculating Revenue, Sales, or Volume, filter \`TransactionType\` to include ALL valid sales codes defined in \`dbo.TYPES\`.
  - **USE THIS LIST:** \`IN ('${validSalesTypes}')\`
  - This list includes Legacy types (1, 10), Modern types (66, 70), Quotes (34, 35), and Contracts (100).
- **Revenue Formula:** 
  \`ROUND(A.RetailPriceExcl * (1 - ISNULL(A.LineDiscountPerc, 0) / 100.0) * A.Qty, 2)\`
- **Joins:** 
  - \`LEFT JOIN dbo.DEBTOR B ON A.DebtorOrCreditorNumber = B.Number\` (Note: \`DebtorOrCreditorNumber\` is VARCHAR).
- **Date Range:** Use \`DATEADD(year, -X, GETDATE())\` unless a specific date is requested.

### 2. SCHEMA INTELLIGENCE (FROM DBO.TYPES)
You have access to the \`dbo.TYPES\` definitions via your training.
- **dbo.AUDIT:** Main transaction table.
- **Transaction Types:**
  - 1, 66: Cash Sales
  - 10, 70: Credit Sales
  - 84: BOM/Recipe Sales
  - 100: Contract Sales
  - (See provided list for full coverage)

### 3. ADVANCED QUERY PATTERNS
**Recursive Ranking (for "Top X Breakdown"):**
1. CTE 1: Filter raw data (Time, Keywords, Sales Types).
2. CTE 2: Group by Entity to find Top X (ORDER BY Total DESC).
3. Final SELECT: Join CTE 1 & CTE 2 to show detailed breakdown for ONLY those Top X.

### 4. OUTPUT FORMAT
Return ONLY valid JSON:
{"sql": "...", "explanation": "Brief logic summary", "visualizationType": "bar|line|area", "xAxis": "ColumnName", "yAxis": "ColumnName"}
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
  
  return { ...result, data: await dbResponse.json(), engine: 'GEMINI FLASH v7.1' };
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

  return { ...JSON.parse(cleanAiResponse(responseText)), engine: 'GEMINI FLASH v7.1' };
};

export const generateStrategicBrief = async (data: any): Promise<{text: string, engine: string} | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `KPI Analysis: ${JSON.stringify(data.kpis)}. 2 sentence summary.`,
    });
    return { text: response.text || "Data verified.", engine: 'GEMINI FLASH v7.1' };
  } catch { return null; }
};
