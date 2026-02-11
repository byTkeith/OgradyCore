
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
  const validSalesTypes = SALES_TRANSACTION_TYPES.join("','");

  return `
You are 'OgradyCore AI v7.3', the Principal T-SQL Architect for the UltiSales ERP Database.
Your directive is to generate syntactically perfect T-SQL queries.

### 1. CRITICAL SCHEMA RULES (DO NOT HALLUCINATE)
- **DATABASE CONTEXT:** ALWAYS start with \`USE [UltiSales];\` followed by \`SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;\`
- **CUSTOMER NAMES:** The \`dbo.DEBTOR\` table uses the column **\`Surname\`**. 
  - ❌ WRONG: \`SELECT Name FROM dbo.DEBTOR\`
  - ✅ CORRECT: \`SELECT Surname FROM dbo.DEBTOR\`
- **REVENUE FORMULA:** \`ROUND(A.RetailPriceExcl * (1 - ISNULL(A.LineDiscountPerc, 0) / 100.0) * A.Qty, 2)\`

### 2. TRANSACTION TYPES & THE 'TYPES' TABLE
The \`dbo.TYPES\` table defines the meaning of codes. 
To decode \`AUDIT.TransactionType\`, you can join:
\`\`\`sql
LEFT JOIN dbo.TYPES T 
  ON T.TABLE_ID = 3             -- 3 = AUDIT Table
  AND T.TYPE_NAME_ID = 4        -- 4 = TRANSACTIONTYPE
  AND T.TYPE_ID = CAST(A.TransactionType AS VARCHAR)
\`\`\`
- **Sales Filter:** When asked for "Sales" or "Revenue", filter \`TransactionType\` IN ('${validSalesTypes}').
  - This covers Legacy (1, 10), Modern (66, 70), BOM (84), and Contracts (100).

### 3. REQUIRED PATTERN: "RECURSIVE RANKING"
For "Top X Customers by Year" requests:
1. **CTE 1 (RawData):** Filter AUDIT by Date, TransactionType, and Keywords. Calculate LineRevenue.
2. **CTE 2 (TopEntities):** Group RawData by DebtorOrCreditorNumber to find top X by *Total* Revenue.
3. **SELECT:** Join RawData -> TopEntities -> DEBTOR. Group by \`D.Surname\`, \`SaleYear\`.

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
  
  // V7.3: Strict enforcement of Isolation Level and DB Context
  if (!finalSql.toUpperCase().includes('SET TRANSACTION ISOLATION')) {
    finalSql = `SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED; ${finalSql}`;
  }
  
  if (!finalSql.toUpperCase().trim().startsWith('USE ')) {
    finalSql = `USE [UltiSales]; ${finalSql}`;
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
  
  return { ...result, data: await dbResponse.json(), engine: 'GEMINI FLASH v7.3' };
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

  return { ...JSON.parse(cleanAiResponse(responseText)), engine: 'GEMINI FLASH v7.3' };
};

export const generateStrategicBrief = async (data: any): Promise<{text: string, engine: string} | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `KPI Analysis: ${JSON.stringify(data.kpis)}. 2 sentence summary.`,
    });
    return { text: response.text || "Data verified.", engine: 'GEMINI FLASH v7.3' };
  } catch { return null; }
};
