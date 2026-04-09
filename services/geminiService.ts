import { GoogleGenAI } from "@google/genai";
import { DEFAULT_BRIDGE_URL, SCHEMA_MAP } from "../constants";
import { QueryResult, AnalystInsight } from "../types";

let schemaCache: Record<string, string[]> = {};

const getSettings = () => {
  const storedUrl = localStorage.getItem('og_bridge_url');
  let baseUrl = storedUrl || DEFAULT_BRIDGE_URL;
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
  const inventoryHistoryCols = getCols("v_AI_Inventory_History_Truth", ["ProductName", "CurrentWarehouseSOH", "LastKnownLedgerSOH", "Stock_Drift_Value", "TranDate", "FiscalYear", "BranchName", "SiteID"]);
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

## 2. INVENTORY INTEGRITY PROTOCOL (VERSION 6.0)

### SOURCE: [v_AI_Inventory_History_Truth]
- Use this view to show ALL products for "Stock on hand," "Inventory levels," or "Warehouse counts."
- If a product has no matching history, \`LastKnownLedgerSOH\` will be 0, but the row will still show the \`CurrentWarehouseSOH\`.

### THE NAME-ANCHOR RULE:
- This database has "Identity Drift" in numeric codes.
- **MANDATORY**: Always filter and group by \`ProductName\`. 
- **FORBIDDEN**: Do not use \`StockCode\` or \`PLUCode\` for joining or identifying items in inventory reports.

### METRICS FOR THE CEO:
- \`CurrentWarehouseSOH\`: The physical count in the factory master.
- \`LastKnownLedgerSOH\`: The count according to the transaction ledger.
- If these numbers differ, report the \`Stock_Drift_Value\` as a data integrity warning.

### DRILL-DOWN:
- Every row in this view is already the "Latest State." 
- To see the stock on hand at the end of a period, filter by \`FiscalYear\` and look at the row for that product.
- **CRITICAL**: Do NOT attempt to join this view to any other table. It is a pre-calculated, self-healing snapshot.
- **THE "NO-ZERO" FILTERING RULE**:
    - **FORBIDDEN**: Never use \`WHERE TranDate = (SELECT MAX(TranDate)...)\`. This causes 0 results due to date mismatches.
    - **MANDATORY**: To get the most recent stock for a product, simply query the view directly. Every row in this view already represents the **Latest Known State** of that product.

## 3. RULES FOR THE AI AGENT:
- **NO CROSS-OVER**: Never try to find stock in the Sales view. 
- **NO JOINS**: Everything is pre-calculated. Do not use the \`JOIN\` keyword.
- **IDENTITY**: Always filter BUCO using \`BranchName LIKE '%BUCO%'\`.
- **TYPE-CASTING HARDENING**: Always cast \`SalesRep\` and \`AccountType\` to \`VARCHAR\` during comparisons to prevent data type conversion errors (e.g., \`CAST(SalesRep AS VARCHAR) = '...' \`).

## 4. EXAMPLE FOR FISCAL YEAR STOCK:
Prompt: "How much stock was on hand in FY 2025?"
SQL: 
SELECT TOP 1 ProductName, CurrentWarehouseSOH, LastKnownLedgerSOH, TranDate
FROM v_AI_Inventory_History_Truth
WHERE ProductName LIKE '%VALUE COAT%' AND FiscalYear = 2025
ORDER BY TranDate DESC;

## 5. THE BUNDLING RULE (NO DUPLICATION)
- **CRITICAL**: When asked for a list of "Top Products" or "Trends," you must aggregate the data so each Product appears on **ONLY ONE ROW**.
- **ACTION**: Do NOT include \`TimeKey\`, \`TranDate\`, or \`FiscalYear\` in the \`SELECT\` or \`GROUP BY\` clauses unless the user specifically asked for a "Monthly Breakdown", a "Graph", or a "Forecast".
- **RESULT**: If the user asks for "Top 30 products over 2 years," your SQL must group ONLY by \`ProductName\`.

## 5. FORECASTING PROTOCOL (THE STATS PIPELINE)
- When a prompt contains "Forecast":
  1. Generate SQL from \`v_AI_Forecasting_Feed\` for the requested time period.
  2. **CRITICAL EXCEPTION TO BUNDLING**: You MUST include \`TimeKey\` and \`ProductName\` in the \`SELECT\` and \`GROUP BY\` for Forecasts. The Python Statistical Model requires chronological data to calculate the \`SuggestedWeeklyStock\`. (The Python backend will bundle the final output for you).
  3. NEVER calculate \`AVG\`, \`ROUND\`, or \`SuggestedWeeklyStock\` in SQL. Do not do math in SQL. Just fetch the raw \`SUM(MonthlyNetQty)\` and \`SUM(MonthlyNetRevenue)\`.
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
  6. Display the result: [Product Name] | [Total Revenue] | [Current Stock] | [Suggested Weekly Stock].

## 6. SEMANTIC MAPPING (SYNONYMS)
- Always use \`LIKE '%...%'\` for \`ProductName\` and \`BranchName\`.
- \`BranchName\` and \`CustomerName\` are identical.
- \`MonthlyRevenue\`, \`Revenue\`, and \`NetRevenue\` are identical.
- **Pack Sizes**: Ignore the \`PackSize\` (Description2) unless the user specifically asks for "5L" or "20L". Do not group by it by default.

## 7. THE FISCAL MANDATE
- The business runs on a **March 1st - February 28th** Fiscal Year.
- The current Fiscal Year is **${currentFiscalYear}**.
- When the user asks for "trends over the last two years," you must query:
  \`WHERE FiscalYear >= ${currentFiscalYear - 2}\`

## 8. EXCLUSIONS

## 9. INVENTORY TRACKING PROTOCOL
- **KEY COLUMNS**:
  - \`CurrentStockOnHand\`: Use this for the current physical stock in the factory.
  - \`StockAtTimeOfSale\`: Use this for historical audits of stock levels on specific dates.
  - \`MinimumStockLevel\`: The safety threshold. If \`CurrentStockOnHand\` is lower, flag as "URGENT REORDER."
  - \`Quantity\`: The amount of stock currently moving (Sales velocity).
- **ANALYSIS PATTERN**:
  When asked "Is our stock matching our sales?":
  1. Query \`SUM(Quantity)\` to see the movement velocity.
  2. Query \`MAX(CurrentStockOnHand)\` to see the current availability.
  3. Compare the two to determine "Weeks of Cover."

## OUTPUT FORMAT (TUNE)
Strictly follow this format (no markdown backticks):
>>>SQL
SELECT ...
>>>EXP
Explanation...
>>>STRAT
Strategic Analysis (Explain the trend and why the recommendation differs from a simple average)...
>>>VIZ
bar|line|pie|area
>>>X
ColumnNameForX
>>>Y
ColumnNameForY
>>>SUM
Brief Summary...
>>>TRD
- Trend 1
- Trend 2
>>>RSK
- Risk 1
>>>STR
- Suggestion 1

# VIEW SCHEMAS
- [v_AI_Inventory_History_Truth]: ${inventoryHistoryCols}
- [v_AI_Sales_Performance]: ${salesPerformanceCols}
- [v_AI_Forecasting_Feed]: ${getCols("v_AI_Forecasting_Feed", ["SiteID", "BranchName", "PLUCode", "ProductName", "PackSize", "TimeKey", "FiscalYear", "MonthlyNetQty", "MonthlyNetRevenue"])}
- [v_AI_Time_Series_Feed]: ${getCols("v_AI_Time_Series_Feed", ["SiteID", "BranchName", "PLUCode", "ProductName", "PackSize", "TimeKey", "FiscalYear", "MonthlyNetQty", "MonthlyNetRevenue"])}
- [v_AI_Omnibus_Forecast_Master]: ${getCols("v_AI_Omnibus_Forecast_Master", SCHEMA_MAP["dbo.v_AI_Omnibus_Forecast_Master"]?.fields || [])}
- [v_AI_Omnibus_Master_Truth]: ${masterCols}
- [v_AI_Stock_Catalog]: ${getCols("v_AI_Stock_Catalog", SCHEMA_MAP["dbo.v_AI_Stock_Catalog"]?.fields || [])}
- [v_AI_Inventory_Truth]: ${getCols("v_AI_Inventory_Truth", ["Warehouse_Stock_Count", "Ledger_Stock_Count", "Stock_Drift_Discrepancy", "BranchName", "ProductName", "LastStockUpdateDate"])}
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
    
    if (content.startsWith("```")) {
      content = content.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "");
    }

    if (keyMap[tag]) {
      if (["TRD", "RSK", "STR"].includes(tag)) {
        data[keyMap[tag]] = content.split("\n").map(line => line.replace(/^- /, "").trim()).filter(line => line);
      } else {
        data[keyMap[tag]] = content;
      }
    }
  }
  return Object.keys(data).length > 0 ? data : null;
};

export const analyzeQuery = async (prompt: string): Promise<QueryResult & { engine: string, insight: AnalystInsight }> => {
  const { bridgeUrl } = getSettings();
  const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.API_KEY || (import.meta as any).env?.VITE_API_KEY;

  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    throw new Error("GEMINI_API_KEY is missing. If you are in AI Studio, please add it to the Secrets in the Settings menu. If you are on Vercel, ensure GEMINI_API_KEY is set in your project environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelName = "gemini-3-flash-preview";
  const now = new Date().toISOString().split('T')[0];

  try {
    // 0. Pre-check for Statistical Forecast
    if (prompt.toLowerCase().includes("forecast") || prompt.toLowerCase().includes("predict")) {
      // Use Gemini to extract the product name
      const extractRes = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Extract the product name from this request. If no specific product is mentioned, return "NONE". Request: "${prompt}"`,
      });
      const productName = extractRes.text?.trim() || "NONE";
      
      if (productName !== "NONE") {
        const forecastEndpoint = bridgeUrl ? `${bridgeUrl}/api/forecast` : '/api/forecast';
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
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: getSystemInstruction(now),
      }
    });

    const aiRaw = response.text;
    if (!aiRaw) {
      throw new Error("AI failed to generate a valid response.");
    }
    const plan = parseTuneResponse(aiRaw);

    if (!plan || !plan.sql) {
      throw new Error("AI failed to generate a valid query.");
    }

    // 2. Execute SQL on Bridge
    const executeEndpoint = bridgeUrl ? `${bridgeUrl}/api/execute` : '/api/execute';
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
      insightPrompt += `\n\nNote: The data provided above is the output of the Holt-Winters Statistical Model. Use these exact numbers for your "SuggestedWeeklyStock" recommendations.`;
    }

    const insightSys = `You are a world-class CEO and Strategic Consultant. Provide a high-level executive brief in TUNE format based on the data provided.
      
      ## REQUIREMENTS:
      - Use ZAR (R) for all currency references.
      - Provide deep strategic analysis, not just data summaries.
      - Compare trends and identify key performance indicators (KPIs).
      - Include market context (e.g., inflation, seasonal shifts in South Africa).
      - **SUPPLY CHAIN HEALTH CHECK**:
        - Inventory Coverage: \`CurrentStockOnHand / WeeklySalesVelocity\`.
        - Stock-out Risk: If \`CurrentStockOnHand < MinimumStockLevel\`.
        - Replenishment Accuracy: Compare \`StockAtTimeOfSale\` against \`Quantity\` sold to identify lost sales due to empty factory.
      - Offer actionable, data-driven decisions for the executive board.
      - **CRITICAL FORECASTING RULE**: If the data contains "Statistical Model Forecasts (Holt-Winters)", you MUST use these exact numbers for your "SuggestedWeeklyStock" recommendations. Do not calculate them yourself. Present the model's findings clearly.

      >>>SUM
      Executive Summary: A high-impact, one-sentence strategic overview.
      >>>TRD
      Trend Analysis & KPIs:
      - Detailed trend 1 with KPI impact.
      - Detailed trend 2 with year-over-year comparison.
      >>>RSK
      Risk Assessment:
      - Critical risk 1 (e.g., supply chain, margin compression).
      - Critical risk 2 (e.g., seasonal downturn).
      >>>STR
      Strategic Roadmap:
      - Immediate strategic move 1 (Actionable).
      - Long-term growth strategy based on the data.`;

    const insightResponse = await ai.models.generateContent({
      model: modelName,
      contents: insightPrompt,
      config: {
        systemInstruction: insightSys,
      }
    });

    const insightRaw = insightResponse.text;
    if (!insightRaw) {
      throw new Error("AI failed to generate insights.");
    }
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
      engine: statisticalForecasts ? `Holt-Winters + Gemini Paid (${modelName})` : `Gemini Paid (${modelName})`
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

  // Fallback to static data from constants
  const staticData: Record<string, string[]> = {};
  Object.keys(SCHEMA_MAP).forEach(key => {
    const shortKey = key.replace("dbo.", "");
    staticData[shortKey] = SCHEMA_MAP[key].fields;
  });
  schemaCache = staticData;
  return { success: true, data: staticData };
};

export const getAnalystInsight = async (queryResult: QueryResult): Promise<AnalystInsight & { engine: string }> => {
  // This is now handled within analyzeQuery for efficiency
  return {
    summary: "Analysis complete.",
    trends: [],
    anomalies: [],
    suggestions: [],
    engine: "Bridge Pipeline"
  };
};

export const generateStrategicBrief = async (data: any): Promise<{text: string, engine: string} | null> => {
  return null;
};
