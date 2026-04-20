// api/execute.ts - FULL Query Generation Logic from geminiService
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI } from "@google/genai"

// ============ CONSTANTS (from your geminiService) ============
const DEFAULT_BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:8000'

const SCHEMA_MAP: Record<string, { fields: string[] }> = {
  "dbo.v_AI_Omnibus_Master_Truth": { 
    fields: ["TransactionDate", "TranDate", "FiscalYear", "BranchName", "ProductName", "Revenue", "GrossProfit", "Quantity", "SalesRep", "AccountType"] 
  },
  "dbo.v_AI_Inventory_History_Truth": {
    fields: ["ProductName", "CurrentWarehouseSOH", "LastKnownLedgerSOH", "Stock_Drift_Value", "TranDate", "FiscalYear", "BranchName", "SiteID", "Inventory_Worth_ExclVAT", "Stock_Alert_Status"]
  },
  "dbo.v_AI_Sales_Performance": {
    fields: ["Revenue", "Quantity", "GrossProfit", "BranchName", "ProductName", "TranDate", "FiscalYear"]
  },
  "dbo.v_AI_Forecasting_Feed": {
    fields: ["SiteID", "BranchName", "PLUCode", "ProductName", "PackSize", "TimeKey", "FiscalYear", "MonthlyNetQty", "MonthlyNetRevenue"]
  },
  "dbo.v_AI_Omnibus_Forecast_Master": {
    fields: ["TimeKey", "FiscalYear", "ProductName", "BranchName", "Revenue", "Quantity"]
  },
  "dbo.v_AI_Stock_Catalog": { 
    fields: ["ProductName", "PLUCode", "CurrentStockOnHand", "MinimumStockLevel", "StockAtTimeOfSale"] 
  }
}

// ============ TYPES ============
interface QueryResult {
  sql: string
  explanation: string
  strategicAnalysis: string
  visualizationType: string
  xAxis: string
  yAxis: string
  data: any[]
  engine: string
}

// ============ FULL QUERY LOGIC FROM GEMINISERVICE ============
let schemaCache: Record<string, string[]> = {};

const getApiKey = (): string => {
  return process.env.GEMINI_API_KEY || process.env.API_KEY || '';
};

const getSettings = () => {
  const baseUrl = process.env.BRIDGE_URL || DEFAULT_BRIDGE_URL;
  return { bridgeUrl: baseUrl.replace(/\/$/, "") };
};

const getSystemInstruction = (now: string) => {
  const getCols = (viewName: string, fallback: string[]) => {
    const cols = schemaCache[viewName] || fallback;
    if (cols.length > 15) {
      return cols.slice(0, 15).join(", ") + "... (and others)";
    }
    return cols.join(", ");
  };

  const masterCols = getCols("v_AI_Omnibus_Master_Truth", SCHEMA_MAP["dbo.v_AI_Omnibus_Master_Truth"]?.fields || []);
  const inventoryHistoryCols = getCols("v_AI_Inventory_History_Truth", ["ProductName", "CurrentWarehouseSOH", "LastKnownLedgerSOH", "Stock_Drift_Value", "TranDate", "FiscalYear", "BranchName", "SiteID", "Inventory_Worth_ExclVAT", "Stock_Alert_Status"]);
  const salesPerformanceCols = getCols("v_AI_Sales_Performance", ["Revenue", "Quantity", "GrossProfit", "BranchName", "ProductName"]);

  const currentDate = new Date(now);
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  const currentFiscalYear = currentMonth < 3 ? currentYear - 1 : currentYear;

  return `
# O'GRADY PAINTS SEMANTIC ROUTING (VERSION 5.0)

## 1. TRANSACTIONAL ANALYSIS: [v_AI_Omnibus_Master_Truth]
- **PURPOSE**: Use for Revenue, Profit, Sales Rep Performance, and Qty SOLD.
- **RULE**: If the user asks "How much did we SELL," use this view.
- **RULE**: Do NOT use this view for "How much did we HAVE on hand."
- **DATE FILTERING**: Use \`TranDate\` or \`TransactionDate\` for date filtering. NEVER use \`Date\`.

## 2. INVENTORY VALUATION & AUDIT PROTOCOL

### VIEW: [v_AI_Inventory_History_Truth]

### CORE METRICS:
- \`CurrentWarehouseSOH\`: Use for physical warehouse counts.
- \`Inventory_Worth_ExclVAT\`: Use to report the total financial value of stock on hand.
- \`Stock_Drift_Value\`: Use to identify discrepancies between the warehouse and the ledger.

### REORDER LOGIC:
- If \`Stock_Alert_Status\` is 'REORDER', highlight this product as a supply chain risk.

### RULES:
- **FORBIDDEN**: Never use \`SUM()\` for stock counts unless summarizing a whole group.
- Use \`MAX(CurrentWarehouseSOH)\` when grouping by product to avoid double-counting.

## 3. RULES FOR THE AI AGENT:
- **NO CROSS-OVER**: Never try to find stock in the Sales view.
- **NO JOINS**: Everything is pre-calculated. Do not use the \`JOIN\` keyword.
- **IDENTITY**: Always filter BUCO using \`BranchName LIKE '%BUCO%'\`.
- **TYPE-CASTING HARDENING**: Always cast \`SalesRep\` and \`AccountType\` to \`VARCHAR\` during comparisons.

## 4. EXAMPLE FOR FISCAL YEAR STOCK:
Prompt: "How much stock was on hand in FY 2025?"
SQL:
SELECT ProductName, CurrentWarehouseSOH, LastKnownLedgerSOH, TranDate
FROM v_AI_Inventory_History_Truth
WHERE ProductName LIKE '%VALUE COAT%' AND FiscalYear = 2025
ORDER BY TranDate DESC;

## 5. THE BUNDLING RULE (NO DUPLICATION)
- **CRITICAL**: When asked for a list of "Top Products" or "Trends," aggregate so each Product appears on **ONLY ONE ROW**.
- **ACTION**: Do NOT include \`TimeKey\`, \`TranDate\`, or \`FiscalYear\` in \`SELECT\` or \`GROUP BY\` unless the user asks for "Monthly Breakdown", "Graph", or "Forecast".

## 6. FORECASTING PROTOCOL (THE STATS PIPELINE)
- When a prompt contains "Forecast":
  1. Generate SQL from \`v_AI_Forecasting_Feed\` for the requested time period.
  2. **CRITICAL EXCEPTION TO BUNDLING**: You MUST include \`TimeKey\` and \`ProductName\` in \`SELECT\` and \`GROUP BY\` for Forecasts.
  3. NEVER calculate \`AVG\`, \`ROUND\`, or \`SuggestedWeeklyStock\` in SQL. Just fetch raw \`SUM(MonthlyNetQty)\` and \`SUM(MonthlyNetRevenue)\`.
  4. Hand this data to the **Statistical Model** by simply outputting the SQL.

  *Example: Forecast top 30 products by revenue over 2 years.*
  WITH TopProducts AS (
      SELECT TOP 30 ProductName
      FROM v_AI_Forecasting_Feed
      WHERE FiscalYear >= ${currentFiscalYear - 2}
      GROUP BY ProductName
      ORDER BY SUM(MonthlyNetRevenue) DESC
  )
  SELECT
      t.TimeKey,
      t.ProductName,
      SUM(t.MonthlyNetQty) AS Qty,
      SUM(t.MonthlyNetRevenue) AS Revenue
  FROM v_AI_Forecasting_Feed t
  INNER JOIN TopProducts tp ON t.ProductName = tp.ProductName
  WHERE t.FiscalYear >= ${currentFiscalYear - 2}
  GROUP BY t.TimeKey, t.ProductName
  ORDER BY t.ProductName, t.TimeKey ASC;

  5. The model returns the \`SuggestedWeeklyStock\`.
  6. Display: [Product Name] | [Total Revenue] | [Current Stock] | [Suggested Weekly Stock].

## 7. SEMANTIC MAPPING (SYNONYMS)
- Always use \`LIKE '%...%'\` for \`ProductName\` and \`BranchName\`.
- \`BranchName\` and \`CustomerName\` are identical.
- \`MonthlyRevenue\`, \`Revenue\`, and \`NetRevenue\` are identical.
- **Pack Sizes**: Ignore \`PackSize\` unless user specifically asks for "5L" or "20L".

## 8. THE FISCAL MANDATE
- The business runs on a **March 1st - February 28th** Fiscal Year.
- The current Fiscal Year is **${currentFiscalYear}**.
- When the user asks for "trends over the last two years":
  \`WHERE FiscalYear >= ${currentFiscalYear - 2}\`

## 9. INVENTORY TRACKING PROTOCOL
- **KEY COLUMNS**:
  - \`CurrentStockOnHand\`: Current physical stock in the factory.
  - \`StockAtTimeOfSale\`: Historical audits of stock levels on specific dates.
  - \`MinimumStockLevel\`: Safety threshold. If \`CurrentStockOnHand\` is lower, flag as "URGENT REORDER."
  - \`Quantity\`: Amount of stock currently moving (Sales velocity).

## OUTPUT FORMAT (TUNE) — strictly follow, no markdown backticks:
>>>SQL
SELECT ...
>>>EXP
Explanation...
>>>STRAT
Strategic Analysis...
>>>VIZ
bar|line|pie|area
>>>X
ColumnNameForX
>>>Y
ColumnNameForY

# VIEW SCHEMAS
- [v_AI_Sales_Performance]: ${salesPerformanceCols}
- [v_AI_Forecasting_Feed]: ${getCols("v_AI_Forecasting_Feed", SCHEMA_MAP["dbo.v_AI_Forecasting_Feed"]?.fields || [])}
- [v_AI_Omnibus_Forecast_Master]: ${getCols("v_AI_Omnibus_Forecast_Master", SCHEMA_MAP["dbo.v_AI_Omnibus_Forecast_Master"]?.fields || [])}
- [v_AI_Omnibus_Master_Truth]: ${masterCols}
- [v_AI_Stock_Catalog]: ${getCols("v_AI_Stock_Catalog", SCHEMA_MAP["dbo.v_AI_Stock_Catalog"]?.fields || [])}
- [v_AI_Inventory_History_Truth]: ${inventoryHistoryCols}
`;
};

const parseTuneResponse = (rawText: string) => {
  if (!rawText) return null;
  const data: any = {};
  const pattern = />>>(SQL|EXP|STRAT|VIZ|X|Y)\s*([\s\S]*?)(?=(?:>>>)|$)/g;
  let match;

  const keyMap: Record<string, string> = {
    "SQL": "sql",
    "EXP": "explanation",
    "STRAT": "strategicAnalysis",
    "VIZ": "visualizationType",
    "X": "xAxis",
    "Y": "yAxis"
  };

  while ((match = pattern.exec(rawText)) !== null) {
    const tag = match[1];
    let content = match[2].trim();

    if (content.startsWith("```")) {
      content = content.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "");
    }

    if (keyMap[tag]) {
      data[keyMap[tag]] = content;
    }
  }
  return Object.keys(data).length > 0 ? data : null;
};

// MODIFIED: Accept source and needs_forecasting parameters to proxy downwards
const analyzeQuery = async (prompt: string, source?: string, needs_forecasting?: boolean): Promise<QueryResult> => {
  const { bridgeUrl } = getSettings();
  const apiKey = getApiKey();

  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    throw new Error("GEMINI_API_KEY is missing.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const fallbackModels = [
    "gemini-3.1-pro-preview",
    "gemini-3-flash-preview",
  ];

  const generateContentWithFallback = async (requestConfig: any) => {
    let lastError: any;
    for (const model of fallbackModels) {
      try {
        const response = await ai.models.generateContent({
          ...requestConfig,
          model
        });
        return { response, usedModel: model };
      } catch (error: any) {
        console.warn(`Model ${model} failed:`, error.message);
        lastError = error;
      }
    }
    throw lastError || new Error("All fallback models failed.");
  };

  const now = new Date().toISOString().split('T')[0];

  // Generate SQL with Gemini
  const { response, usedModel: sqlModel } = await generateContentWithFallback({
    contents: prompt,
    config: {
      systemInstruction: getSystemInstruction(now),
    }
  });

  const aiRaw = response.text;
  if (!aiRaw) throw new Error("AI failed to generate a valid response.");

  const plan = parseTuneResponse(aiRaw);
  if (!plan || !plan.sql) throw new Error("AI failed to generate a valid query.");

  // Execute SQL via bridge
  const executeEndpoint = `${bridgeUrl}/api/execute`;
  
  // MODIFIED: Pass the source markers securely to main.py
  const payloadToMainPy = { 
    sql: plan.sql,
    source: source || null,
    needs_forecasting: needs_forecasting || false
  };

  const executeRes = await fetch(executeEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    },
    body: JSON.stringify(payloadToMainPy)
  });

  if (!executeRes.ok) {
    throw new Error(`Execution Error: ${executeRes.statusText}`);
  }

  const executeData = await executeRes.json();
  const data = executeData.data || [];

  return {
    sql: plan.sql,
    explanation: plan.explanation || "",
    strategicAnalysis: plan.strategicAnalysis || "",
    visualizationType: plan.visualizationType || "table",
    xAxis: plan.xAxis || "",
    yAxis: plan.yAxis || "",
    data,
    engine: sqlModel
  };
};

// ============ HANDLER ============
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // MODIFIED: Extract source and needs_forecasting from the incoming request body
  const { prompt, source, needs_forecasting } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  try {
    console.log(`Generating SQL for: ${prompt} (Source: ${source || 'API_1'})`);

    // MODIFIED: Pass them into the analysis block
    const result = await analyzeQuery(prompt, source, needs_forecasting);

    console.log('Pipeline complete. Engine:', result.engine);
    
    // Return to forecaster API
    return res.status(200).json(result);

  } catch (e: any) {
    console.error('Execute pipeline error:', e);
    return res.status(500).json({ error: e.message });
  }
}