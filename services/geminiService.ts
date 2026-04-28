import { GoogleGenerativeAI } from "@google/generative-ai";
import { DEFAULT_BRIDGE_URL, SCHEMA_MAP } from "../constants";
import { QueryResult, AnalystInsight } from "../types";

let schemaCache: Record<string, string[]> = {};

// ✅ Environment-aware API key resolution
const getApiKey = (): string => {
  if (typeof window === 'undefined') {
    // Server-side (Node.js/Vercel)
    return process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  }
  // Client-side (Browser)
  return (import.meta as any).env?.VITE_GEMINI_API_KEY
    || (import.meta as any).env?.VITE_API_KEY
    || process.env.GEMINI_API_KEY
    || process.env.API_KEY
    || '';
};

// ✅ Environment-aware settings
const getSettings = () => {
  let storedUrl = null;

  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    storedUrl = localStorage.getItem('og_bridge_url');
  }

  let baseUrl = storedUrl || process.env.BRIDGE_URL || DEFAULT_BRIDGE_URL;
  return { bridgeUrl: baseUrl.replace(/\/$/, "") };
};

const getSystemInstruction = (now: string) => {
  const getCols = (viewName: string, fallback: string[]) => {
    const cols = schemaCache[viewName] || fallback;
    if (cols.length > 25) {
      return cols.slice(0, 25).join(", ") + "... (and others)";
    }
    return cols.join(", ");
  };

  const masterCols = getCols("v_AI_Omnibus_Master_Truth", SCHEMA_MAP["dbo.v_AI_Omnibus_Master_Truth"]?.fields || []);
  const forecastMasterCols = getCols("v_AI_Omnibus_Forecast_Master", SCHEMA_MAP["dbo.v_AI_Omnibus_Forecast_Master"]?.fields || []);
  const inventoryHistoryCols = getCols("v_AI_Inventory_History_Truth", ["ProductName", "CurrentWarehouseSOH", "LastKnownLedgerSOH", "Stock_Drift_Value", "TranDate", "FiscalYear", "BranchName", "SiteID", "Inventory_Worth_ExclVAT", "Stock_Alert_Status"]);
  const salesPerformanceCols = getCols("v_AI_Sales_Performance", ["Revenue", "Quantity", "GrossProfit", "BranchName", "ProductName"]);

  const currentDate = new Date(now);
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  const currentFiscalYear = currentMonth < 3 ? currentYear - 1 : currentYear;

  return `
# IDENTITY
You are the "Senior Financial Systems Architect for O'Grady Paints." Your objective is to generate 100% accurate MSSQL queries and provide high-level business intelligence.

# CONTEXT
- **TODAY'S DATE**: ${now}
- **CURRENT FISCAL YEAR**: ${currentFiscalYear} (Fiscal Year starts MARCH 1st)

# PRIMARY DATA SOURCE (THE SOURCE OF TRUTH)
- **PRIMARY VIEW**: \`v_AI_Omnibus_Forecast_Master\` (Use this for Sales, Profit, Inventory, and Trends).
- **SECONDARY VIEW**: \`v_AI_Omnibus_Master_Truth\` (Use for deep historical audits and tax analysis).
- **ACCURACY**: These views use cent-perfect Delphi rounding and compound discounts. Never attempt to calculate these manually (e.g., do not calculate (Qty * Price)). If you find yourself needing to calculate a financial total, use the pre-calculated columns instead.

# SEMANTIC COLUMN MAPPING (SYNONYMS)
To prevent "Invalid Column" errors, use these verified synonyms:

## 1. IDENTITY & NAMES
- **Store / Branch / Customer**: Use \`BranchName\` or \`CustomerName\`.
- **Sales Rep**: Use \`SalesRepName\`.
- **Product**: Use \`ProductName\`.
- **Pack Size**: Use \`PackSize\`.

## 2. FINANCIALS (CURRENCY - EXCLUSIVE OF VAT)
- **Net Sales / Revenue**: Use \`Revenue\`, \`MonthlyRevenue\`, or \`ActualRevenue\`.
- **Profit**: Use \`GrossProfit\`.
- **Cost**: Use \`NetCost\` or \`Cost\`.
- **Tax (VAT)**: Use \`VAT_Amount\` or \`TaxValue\`.
- **Inclusive Total**: Use \`TotalSalesInclVAT\` for "Total Retail Value" or "Total Sales including Tax".

## 3. VOLUME & STOCK (INTEGERS)
- **Quantity Sold**: Use \`Quantity\`, \`MonthlyQty\`, or \`Qty_SOLD\`.
- **Live Factory Stock**: Use \`Stock_OnHand_Warehouse_Master\` or \`StockOnHand\` (Synonym for \`CurrentStockOnHand\`).
- **Historical Ledger Stock**: Use \`Stock_OnHand_Ledger_Snapshot\` (Synonym for \`StockAtTimeOfSale\`).
- **Reorder Threshold**: Use \`MinimumStockLevel\` or \`DangerLevel\`.

## 4. DATE & TIME
- **Fiscal Year**: Use the \`FiscalYear\` column.
- **Specific Date**: Use \`TranDate\` or \`TransactionDate\`.
- **Monthly Sorting**: Use \`TimeKey\` (YYYYMM integer format).

# ANALYTICAL PROTOCOLS

## A. THE BUNDLING RULE (PREVENT DUPLICATION)
- When asked for a list (e.g., "Top 20 Products"), you must aggregate so each product appears on **ONLY ONE ROW**.
- **FORBIDDEN**: Do not include \`TimeKey\`, \`TranDate\`, or \`FiscalYear\` in the \`SELECT\` or \`GROUP BY\` clause unless the user specifically asks for a "Monthly Breakdown" or "Trend Graph".

## B. DATA INTEGRITY (THE FUTURE BLOCK)
- **CRITICAL**: The database contains future-dated "ghost" transactions (e.g., year 2085).
- **MANDATORY**: Always include \`WHERE TranDate <= CAST(GETDATE() AS DATE)\` (or similar date filter) in every query to ensure accuracy.

## C. FORECASTING & STATSMODELS
- If the prompt involves "Forecasting" or "Predictions":
  - You are a **Data Harvester**. 
  - Generate SQL to pull a 36-month time-series grouping by \`TimeKey\`.
  - Do not calculate the forecast in SQL. Hand the raw data to the background statistical model.
  - Recommended metrics to fetch: \`MonthlyQty\`, \`MonthlyRevenue\`, \`SuggestedWeeklySafetyStock\`.

# SQL DIALECT RULES
- This is **Microsoft SQL Server (MSSQL)**.
- Use \`SELECT TOP X\` instead of \`LIMIT\`.
- Use \`LIKE '%...%'\` for string searches to handle naming variations.
- Exclude internal test branches: \`WHERE BranchName NOT LIKE '%TOP T%'\`.

# OUTPUT FORMAT (STRICT) - No markdown backticks:
>>>SQL
{Your MSSQL Code}
>>>EXP
{Brief technical explanation}
>>>STRAT
{High-level business insight for the CEO. If Gemini generated a query that tries to calculate figures manually, remind the user here that the system uses pre-calculated cent-perfect columns.}
>>>VIZ
{bar|line|pie|area|table}
>>>X
{Column Name for X-Axis}
>>>Y
{Column Name for Y-Axis}
>>>SUM
{Executive Summary: A high-impact, one-sentence strategic overview}
>>>TRD
- {Detailed trend 1 with KPI impact}
- {Detailed trend 2}
>>>RSK
- {Critical risk 1}
>>>STR
- {Immediate strategic move}

# VIEW SCHEMAS
- [v_AI_Omnibus_Forecast_Master]: ${forecastMasterCols}
- [v_AI_Omnibus_Master_Truth]: ${masterCols}
- [v_AI_Sales_Performance]: ${salesPerformanceCols}
- [v_AI_Inventory_History_Truth]: ${inventoryHistoryCols}
- [v_AI_Stock_Catalog]: ${getCols("v_AI_Stock_Catalog", SCHEMA_MAP["dbo.v_AI_Stock_Catalog"]?.fields || [])}
`;
};

const parseTuneResponse = (rawText: string) => {
  if (!rawText) return null;
  const data: any = {};
  const pattern = />>>(SQL|EXP|STRAT|VIZ|X|Y|SUM|TRD|RSK|STR)\s*([\s\S]*?)(?=(?:>>>)|$)/g;
  let match;

  const keyMap: Record<string, string> = {
    "SQL": "sql",
    "EXP": "explanation",
    "STRAT": "strategicAnalysis",
    "VIZ": "visualizationType",
    "X": "xAxis",
    "Y": "yAxis",
    "SUM": "summary",
    "TRD": "trends",
    "RSK": "anomalies",
    "STR": "suggestions"
  };

  while ((match = pattern.exec(rawText)) !== null) {
    const tag = match[1];
    let content = match[2].trim();

    if (content.startsWith("\`\`\`")) {
      content = content.replace(/^\`\`\`[a-zA-Z]*\n?/, "").replace(/\n?\`\`\`$/, "");
    }

    if (keyMap[tag]) {
      if (["TRD", "RSK", "STR"].includes(tag)) {
        data[keyMap[tag]] = content.split("\n").map((line: string) => line.replace(/^- /, "").trim()).filter((line: string) => line);
      } else {
        data[keyMap[tag]] = content;
      }
    }
  }
  return Object.keys(data).length > 0 ? data : null;
};

// ✅ Works in both browser and Node.js
export const analyzeQuery = async (prompt: string): Promise<QueryResult & { engine: string, insight: AnalystInsight }> => {
  const { bridgeUrl } = getSettings();
  const apiKey = getApiKey();

  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    throw new Error("GEMINI_API_KEY is missing. Please set it in your environment variables.");
  }

  const ai = new GoogleGenerativeAI( apiKey );

  const fallbackModels = [
    "gemini-3.1-pro-preview",
    //"gemini-3.0-flash-preview",
  ];

  const generateContentWithFallback = async (requestConfig: any) => {
    let lastError: any;
    for (const model of fallbackModels) {
      try {
        const result = await ai.getGenerativeModel({ model }).generateContent(requestConfig);
        return { response: result.response, usedModel: model };
      } catch (error: any) {
        console.warn(`Model ${model} failed:`, error.message);
        lastError = error;
      }
    }
    throw lastError || new Error("All fallback models failed.");
  };

  const now = new Date().toISOString().split('T')[0];

  try {
    // 0. Pre-check for Statistical Forecast
    if (prompt.toLowerCase().includes("forecast") || prompt.toLowerCase().includes("predict")) {
      const { response: extractRes } = await generateContentWithFallback(`Extract the product name from this request. If no specific product is mentioned, return "NONE". Request: "${prompt}"`);
      const productName = extractRes.text().trim() || "NONE";

      if (productName !== "NONE") {
        const forecastEndpoint = `${bridgeUrl}/api/forecast`;
        const forecastRes = await fetch(forecastEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          },
          body: JSON.stringify({ product_name: productName, api_key: apiKey })
        });

        if (forecastRes.ok) {
          const forecastData = await forecastRes.json();
          if (forecastData.status === "success") {
            return {
              sql: "Statistical Model (Holt-Winters) + Gemini Market Adjustment",
              explanation: `Forecasting ${productName} using Triple Exponential Smoothing.`,
              strategicAnalysis: forecastData.reasoning,
              visualizationType: "bar",
              xAxis: "Metric",
              yAxis: "Units",
              data: [
                { Metric: "Statistical Baseline", Units: forecastData.forecast_units },
                { Metric: "Market Adjusted Forecast", Units: forecastData.adjusted_forecast }
              ],
              insight: {
                summary: `Forecast for ${productName}: ${forecastData.adjusted_forecast} units.`,
                trends: [`Statistical baseline: ${forecastData.forecast_units} units`],
                anomalies: [],
                suggestions: [forecastData.reasoning]
              },
              engine: "Holt-Winters + Gemini Economist"
            };
          }
        }
      }
    }

    // 1. Generate SQL with Gemini
    const { response, usedModel: sqlModel } = await generateContentWithFallback({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction: getSystemInstruction(now),
    });

    const aiRaw = response.text();
    if (!aiRaw) throw new Error("AI failed to generate a valid response.");

    const plan = parseTuneResponse(aiRaw);
    if (!plan || !plan.sql) throw new Error("AI failed to generate a valid query.");

    // 2. Execute SQL — server-side calls bridge directly, client-side goes via core proxy
    let executeEndpoint: string;
    if (typeof window === 'undefined') {
      // Server-side: call main.py bridge directly
      executeEndpoint = `${bridgeUrl}/api/execute`;
    } else {
      // Client-side: call core Vercel proxy
      executeEndpoint = bridgeUrl ? `${bridgeUrl}/api/execute` : '/api/execute';
    }

    const executeRes = await fetch(executeEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ sql: plan.sql })
    });

    if (!executeRes.ok) {
      throw new Error(`Execution Error: ${executeRes.statusText}`);
    }

    const executeData = await executeRes.json();
    const statisticalForecasts = executeData.statistical_forecasts;
    const data = statisticalForecasts || executeData.data;

    // 3. Generate Insights with Gemini
    let insightPrompt = `Query: ${prompt}\nData Sample: ${JSON.stringify(data.slice(0, 20))}`;
    if (statisticalForecasts) {
      insightPrompt += `\n\nNote: The data above is the output of the Holt-Winters Statistical Model. Use these exact numbers for your "SuggestedWeeklyStock" recommendations.`;
    }

    const insightSys = `You are a world-class CEO and Strategic Consultant. Provide a high-level executive brief in TUNE format based on the data provided.

## REQUIREMENTS:
- Use ZAR (R) for all currency references.
- Provide deep strategic analysis, not just data summaries.
- Compare trends and identify key KPIs.
- Include market context (e.g., inflation, seasonal shifts in South Africa).
- **SUPPLY CHAIN HEALTH CHECK**:
  - Inventory Coverage: CurrentStockOnHand / WeeklySalesVelocity
  - Stock-out Risk: If CurrentStockOnHand < MinimumStockLevel
  - Replenishment Accuracy: Compare StockAtTimeOfSale against Quantity sold
- Offer actionable, data-driven decisions for the executive board.
- **CRITICAL FORECASTING RULE**: If data contains "Statistical Model Forecasts (Holt-Winters)", use these exact numbers for SuggestedWeeklyStock. Do not calculate yourself.

>>>SUM
Executive Summary: A high-impact, one-sentence strategic overview.
>>>TRD
- Detailed trend 1 with KPI impact.
- Detailed trend 2 with year-over-year comparison.
>>>RSK
- Critical risk 1 (e.g., supply chain, margin compression).
- Critical risk 2 (e.g., seasonal downturn).
>>>STR
- Immediate strategic move 1 (Actionable).
- Long-term growth strategy based on the data.`;

    const { response: insightResponse, usedModel: insightModel } = await generateContentWithFallback({
      contents: [{ role: "user", parts: [{ text: insightPrompt }] }],
      systemInstruction: insightSys,
    });

    const insightRaw = insightResponse.text();
    if (!insightRaw) throw new Error("AI failed to generate insights.");

    const insightData = parseTuneResponse(insightRaw);

    const insight: AnalystInsight = {
      summary: insightData?.summary || "Analysis complete.",
      trends: insightData?.trends || [],
      anomalies: insightData?.anomalies || [],
      suggestions: insightData?.suggestions || []
    };

    return {
      ...plan,
      strategicAnalysis: plan.strategicAnalysis,
      data,
      insight,
      engine: statisticalForecasts
        ? `Holt-Winters + Gemini (${insightModel})`
        : `Gemini (${sqlModel})`
    };

  } catch (error: any) {
    console.error("Pipeline Error:", error);
    throw new Error(error.message || "AI Analysis failed.");
  }
};

export const initSchema = async (urlOverride?: string): Promise<{ success: boolean; data: Record<string, string[]>; error?: string }> => {
  const { bridgeUrl } = getSettings();
  const baseUrl = urlOverride || bridgeUrl;
  const endpoint = baseUrl ? `${baseUrl}/api/get_schema` : '/api/get_schema';

  try {
    const response = await fetch(endpoint, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (response.ok) {
      const { schema } = await response.json();
      schemaCache = schema;
      return { success: true, data: schema };
    }
  } catch (e) {
    console.warn("Could not fetch dynamic schema, using static fallback.");
  }

  const staticData: Record<string, string[]> = {};
  Object.keys(SCHEMA_MAP).forEach(key => {
    const shortKey = key.replace("dbo.", "");
    staticData[shortKey] = SCHEMA_MAP[key].fields;
  });
  schemaCache = staticData;
  return { success: true, data: staticData };
};

export const getAnalystInsight = async (queryResult: QueryResult): Promise<AnalystInsight & { engine: string }> => {
  return {
    summary: "Analysis complete.",
    trends: [],
    anomalies: [],
    suggestions: [],
    engine: "Bridge Pipeline"
  };
};

export const generateStrategicBrief = async (data: any): Promise<{ text: string, engine: string } | null> => {
  return null;
};
