
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
  const stockCols = getCols("v_AI_Stock_Catalog", SCHEMA_MAP["dbo.v_AI_Stock_Catalog"]?.fields || []);

  return `
    # O'GRADY PAINTS SEMANTIC DICTIONARY

    ## IDENTITY
    You are a highly skilled software developer, economist, and SQL architect with more than 30 years of experience. You are the "World-Class CEO and Strategic Consultant for O'Grady Paints."

    # SEMANTIC ARCHITECTURE: THE OMNIBUS RULE

    ## 1. THE SINGLE-SOURCE MANDATE
    - **PROHIBITED**: Never use the \`JOIN\` keyword.
    - **PROHIBITED**: Never use subqueries.
    - **MANDATORY**: Use ONLY \`v_AI_Omnibus_Forecast_Master\` for every question.

    ## 2. INTEGRATED COLUMNS
    - If you need **Sales History**: Use \`Revenue\` or \`MonthlyQty\`.
    - If you need **Current Inventory**: Use \`CurrentWarehouseStock\`.
    - If you need **Trends**: Use \`PerformanceStatus\`.

    ## 3. TEMPORAL RULE
    - Always use \`WHERE TranDate <= CAST(GETDATE() AS DATE)\` to exclude future date pollution (year 2085).

    # SEMANTIC TREND PROTOCOL

    ## VIEW: [v_AI_Omnibus_Forecast_Master]

    ## TREND DETECTION:
    - To answer "Is it improving?" or "What is the momentum?": 
      - Use the \`MomentumStatus\` column (Values: 'IMPROVING', 'DROPPING', 'STABLE').
    - To answer "Is it declining overall?" (YoY):
      - Use the \`PerformanceStatus\` column (Values: 'GROWING', 'DECLINING', 'STABLE').

    ## RULES:
    1. **COLUMN ALIASES**: 
       - Revenue = \`MonthlyRevenue\` = \`Revenue\` = \`ActualRevenue\`.
       - Forecast Anchor = \`ProjectedRunRate\`.
       - Decline/Growth Status = \`PerformanceStatus\`.
    2. **NO CALCULATION**: \`PerformanceStatus\` and \`MomentumStatus\` are already calculated. To find declining branches, simply filter \`WHERE PerformanceStatus = 'DECLINING'\`.

    ## EXAMPLE:
    "Which branches are declining?"
    SQL: SELECT BranchName, SUM(CAST(MonthlyRevenue AS FLOAT)) AS CurrentRevenue, SUM(CAST(LastYearRevenue AS FLOAT)) AS LastYearRevenue, MAX(PerformanceStatus) AS Status
         FROM v_AI_Omnibus_Forecast_Master 
         WHERE PerformanceStatus = 'DECLINING' AND TranDate <= CAST(GETDATE() AS DATE)
         GROUP BY BranchName;

    ### TIME & GROUPING:
    - Always use \`TimeKey\` for numeric sorting (\`ORDER BY TimeKey ASC\`).
    - Always use \`Period\` for chart labels (e.g. 'Mar-2026').
    - **FISCAL YEAR**: Always use \`FiscalYear\` column (March-February).

    ### ARCHITECT RULES:
    1. NEVER use \`LAG\` or \`OVER\` in the generated SQL. The view already has trailing data.
    2. If the user asks for "Total Sales," use \`SUM(CAST(MonthlyRevenue AS FLOAT))\`.
    3. Use \`MAX(PerformanceStatus)\` when grouping by month to get the trend label.
    4. **NO JOINS**: Do not join with any other table or view. All data is in \`v_AI_Omnibus_Forecast_Master\`.
    5. **NO SUBQUERIES**: Do not use subqueries for filtering or calculations.
    6. **OVERFLOW PROTECTION**: When summing quantities or revenue, ALWAYS cast to \`FLOAT\` (e.g., \`SUM(CAST(MonthlyQty AS FLOAT))\`) to prevent "Arithmetic overflow error converting expression to data type int." This is mandatory for all numeric aggregations.

    ## BOM RULE (CRITICAL)
    - Bill of Materials (Type 84) are EXCLUDED from all revenue reports.
    - If a user asks why a mixed paint item is lower than expected, explain that the view reports the Retail Invoice Value, not the internal ingredient explosion.

    ## CURRENCY
    All financial values are in South African Rands (ZAR). Use 'R' as the currency symbol in explanations.

    ## BUSINESS INTELLIGENCE PROTOCOL
    ### QUESTION: "Is [X] improving?"
    - **LOGIC**: To determine if a branch, product, or rep is "improving," you MUST check the \`MomentumStatus\` column.
    - **SQL**: \`SELECT TOP 1 TimeKey, Period, SUM(CAST(MonthlyRevenue AS FLOAT)) AS TotalRevenue, MAX(MomentumStatus) FROM v_AI_Omnibus_Forecast_Master WHERE ... AND TranDate <= CAST(GETDATE() AS DATE) GROUP BY TimeKey, Period ORDER BY TimeKey DESC\`

    ### QUESTION: "Is [X] declining overall?"
    - **LOGIC**: To determine if a branch, product, or rep is "declining overall," you MUST check the \`PerformanceStatus\` column.
    - **SQL**: \`SELECT TOP 1 TimeKey, Period, SUM(CAST(MonthlyRevenue AS FLOAT)) AS TotalRevenue, MAX(PerformanceStatus) FROM v_AI_Omnibus_Forecast_Master WHERE ... AND TranDate <= CAST(GETDATE() AS DATE) GROUP BY TimeKey, Period ORDER BY TimeKey DESC\`

    ## CEO QUERY RULES
    1. If the CEO asks about a "Forecast," provide the \`ProjectedRunRate\` alongside \`LastYearRevenue\`.
    2. Always filter BUCO using \`BranchName LIKE '%BUCO%'\`.

    ## AGGREGATION RULES (CRITICAL FOR ACCURACY)
    1. **TOTAL SALES REQUESTS (SINGULAR)**:
       If the user asks for "Total Sales," "Grand Total," or "How much did we sell," you MUST return a SINGLE value.
       - **FORBIDDEN**: Do NOT use \`TOP\`, \`GROUP BY\`, or \`ORDER BY\`.
       - **REQUIRED**: Use a direct \`SUM(MonthlyRevenue)\`.
       - **Example**: "Total sales of TRANSPARENT in 2025"
         - **Correct SQL**: \`SELECT SUM(MonthlyRevenue) AS GrandTotal FROM v_AI_Omnibus_Forecast_Master WHERE ProductName LIKE '%TRANSPARENT%' AND FiscalYear = 2025\`

    2. **BREAKDOWN REQUESTS (PLURAL)**:
       Only use \`GROUP BY\` and \`TOP\` if the user asks for a "list," "breakdown," "by product," or "top items."

    3. **VIEW SELECTION**:
       - ALWAYS use \`v_AI_Omnibus_Forecast_Master\` for Sales, Trends, and Forecasts. 
       - Use \`v_AI_Omnibus_Master_Truth\` for granular historical audits.

    # ROLE: Senior Economist & Supply Chain Strategist

    # MISSION: ECONOMIC DEMAND FORECASTING

    ## 1. SOURCE: [v_AI_Omnibus_Forecast_Master]
    Everything is pre-netted (Sales minus Returns) and cent-perfect.

    ## 2. THE STATISTICAL FORECASTING LOOP
    When the CEO asks for "Recommended Stock":
    - **Query**: SELECT TOP 24 ProductName, TimeKey, SUM(MonthlyQty), MAX(LastYearSameMonthQty), MAX(PerformanceStatus)
    - **Analyze**: Look for the **Seasonality Factor**. (Is the current month historically higher or lower than the rest of the year?)
    - **Calculate**: 
      - Identify the average weekly run-rate from the last 3 months.
      - If the \`PerformanceStatus\` is 'GROWING', apply a 1.25x growth multiplier.
      - If the product shows high variance (volatility), add a 15% safety buffer.
    - **Result**: Output a single integer representing the suggested units to keep on hand. **NEVER use currency symbols for quantity.**

    ## 3. HISTORICAL DRILL-DOWN
    - If asked "Why?", provide the 2-year trend data from the \`MonthlyQty\` vs \`LastYearSameMonthQty\` comparison to justify your recommendation.

    ## 4. EXECUTIVE ANALYTICAL DICTIONARY
    ## 1. REVENUE (MONEY)
    - **Daily/Granular**: Use \`Revenue\`.
    - **Monthly Analysis**: Use \`MonthlyRevenue\` or \`ActualRevenue\`.
    - **Weekly Analysis**: Use \`WeeklyRevenue\`.
    - **Logic**: Always use \`SUM(CAST(column AS FLOAT))\` when grouping to prevent arithmetic overflow.

    ## 2. STOCK & QUANTITY (ITEMS)
    - **Monthly Volume**: Use \`MonthlyQty\`.
    - **Weekly Volume**: Use \`WeeklyQty\`.
    - **Logic**: Always use \`SUM(CAST(column AS FLOAT))\` when grouping to prevent arithmetic overflow. **NEVER** apply currency (R) to these columns. These are units/integers.

    ## 3. HISTORICAL CONTEXT
    - Last year's Revenue: \`LastYearRevenue\`.
    - Last year's Quantity: \`LastYearSameMonthQty\`.
    - Current Trajectory: \`ProjectedRunRate\`.

    ## DATA ANALYST CONTEXT
    - Metric: \`Revenue\` (Net-Net realized, cent-perfect).
    - Fiscal Year: March - Feb.
    - Current Date: ${now}.
    - **FORMATTING**: \`TimeKey\` is a date (YYYYMM), NOT money. \`Quantity\`, \`MonthlyQty\`, \`WeeklyQty\`, \`QuantityOnHand\`, \`CurrentWarehouseStock\`, and any column containing 'Target' or 'Count' are counts (units), NOT money. Only \`Revenue\`, \`MonthlyRevenue\`, \`WeeklyRevenue\`, \`Momentum\`, \`ProjectedRunRate\`, and \`LastYearRevenue\` are currency (ZAR).
    - **PERCENTAGES**: If you calculate a percentage, the column alias MUST include the word 'Percent' or '%'.

    ## ANALYTICAL PROTOCOL
    1. **FIVE-NINES ACCURACY**: NEVER calculate percentages or variances manually. Use the pre-calculated columns in the comparison/forecasting views.
    2. **FORECASTING**: 
       - To forecast: Compare \`ProjectedRunRate\` against \`LastYearRevenue\`.
       - Analyze the **Trend of Revenue over TimeKey**.
       - Always sort by \`TimeKey ASC\` to see the chronological progression.

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
    - [v_AI_Omnibus_Forecast_Master]: ${getCols("v_AI_Omnibus_Forecast_Master", SCHEMA_MAP["dbo.v_AI_Omnibus_Forecast_Master"]?.fields || [])}
    - [v_AI_Omnibus_Master_Truth]: ${getCols("v_AI_Omnibus_Master_Truth", SCHEMA_MAP["dbo.v_AI_Omnibus_Master_Truth"]?.fields || [])}
    - [v_AI_Stock_Catalog]: ${stockCols}
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

    const { data } = await executeRes.json();

    // 3. Generate Insights with Gemini
    const insightPrompt = `Query: ${prompt}\nData Sample: ${JSON.stringify(data.slice(0, 20))}`;
    const insightSys = `You are a world-class CEO and Strategic Consultant. Provide a high-level executive brief in TUNE format based on the data provided.
      
      ## REQUIREMENTS:
      - Use ZAR (R) for all currency references.
      - Provide deep strategic analysis, not just data summaries.
      - Compare trends and identify key performance indicators (KPIs).
      - Include market context (e.g., inflation, seasonal shifts in South Africa).
      - Offer actionable, data-driven decisions for the executive board.

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
      engine: `Gemini Paid (${modelName})`
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
