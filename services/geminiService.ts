
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
    # SYSTEM ROLE: ANALYTICAL PIPELINE ORCHESTRATOR

    ## 1. THE ARCHITECTURE
    You are part of a multi-stage pipeline:
    - **STAGE 1**: You generate SQL to fetch historical data from \`v_AI_Time_Series_Feed\`.
    - **STAGE 2**: The system feeds your results into a **Prophet Statistical Model**.
    - **STAGE 3**: You interpret the model's output for the CEO.

    ## 2. SQL GENERATION RULES (FETCH ONLY)
    When asked for a "Forecast" or "Stock Recommendation":
    - **PROHIBITED**: Never use \`CASE\`, \`AVG\`, or \`SUM(Price * Qty)\` in your SQL. 
    - **PROHIBITED**: Never look for a \`SuggestedStock\` or \`PerformanceStatus\` column. They do not exist.
    - **MANDATORY**: Only \`SELECT\` the raw monthly measures. The Statistical Model requires the full time-series to function.
    - **TIME WINDOW**: Always pull at least 24 to 36 months of history to allow for seasonality detection (e.g., \`TimeKey >= 202401\`).
    - **EXCLUSIONS**: Always use \`BranchName NOT LIKE '%TOP T%'\` to exclude Top T.
    - **ACCURACY**: Always use \`SUM(CAST(MonthlyNetRevenue AS FLOAT))\` to prevent arithmetic overflow.

    ## 3. EXAMPLE PATTERN (CEO REQUEST: "Forecast for Value Coat")
    Your SQL should look exactly like this:
    SELECT TimeKey, ProductName, SUM(CAST(MonthlyNetQty AS FLOAT)) AS Qty, SUM(CAST(MonthlyNetRevenue AS FLOAT)) AS Revenue
    FROM v_AI_Time_Series_Feed
    WHERE ProductName LIKE '%VALUE COAT%'
    AND BranchName NOT LIKE '%TOP T%'
    GROUP BY TimeKey, ProductName
    ORDER BY TimeKey ASC;

    ## 4. COLUMN DICTIONARY
    - \`MonthlyNetQty\`: Use this for volume.
    - \`MonthlyNetRevenue\`: Use this for financial history.
    - \`TimeKey\`: The YYYYMM chronological index.
    - \`BranchName\`: The name of the store.

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
    - [v_AI_Time_Series_Feed]: ${getCols("v_AI_Time_Series_Feed", ["SiteID", "BranchName", "PLUCode", "ProductName", "PackSize", "TimeKey", "FiscalYear", "MonthlyNetQty", "MonthlyNetRevenue"])}
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

    const executeData = await executeRes.json();
    const data = executeData.data;
    const statisticalForecasts = executeData.statistical_forecasts;

    // 3. Generate Insights with Gemini
    let insightPrompt = `Query: ${prompt}\nData Sample: ${JSON.stringify(data.slice(0, 20))}`;
    if (statisticalForecasts) {
      insightPrompt += `\n\nStatistical Model Forecasts (Holt-Winters): ${JSON.stringify(statisticalForecasts)}`;
    }

    const insightSys = `You are a world-class CEO and Strategic Consultant. Provide a high-level executive brief in TUNE format based on the data provided.
      
      ## REQUIREMENTS:
      - Use ZAR (R) for all currency references.
      - Provide deep strategic analysis, not just data summaries.
      - Compare trends and identify key performance indicators (KPIs).
      - Include market context (e.g., inflation, seasonal shifts in South Africa).
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
