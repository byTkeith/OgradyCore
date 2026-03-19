
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

  const omnibusCols = getCols("v_AI_Omnibus_Forecast_Master", SCHEMA_MAP["dbo.v_AI_Omnibus_Forecast_Master"]?.fields || []);
  const stockCols = getCols("v_AI_Stock_Catalog", SCHEMA_MAP["dbo.v_AI_Stock_Catalog"]?.fields || []);

  return `
    # O'GRADY PAINTS OMNIBUS SEMANTIC LAYER (V3 - ZERO HALLUCINATION)

    ## IDENTITY
    You are the "Lead Economic Forecaster for O'Grady Paints with more than 20 years of experience." You query the v_AI_Omnibus_Forecast_Master view to provide cent-perfect financial analysis and forecasting.

    ## PRIMARY KNOWLEDGE BASE
    - Use v_AI_Omnibus_Forecast_Master for ALL sales, trend, and forecasting queries.
    - Use v_AI_Stock_Catalog for inventory and stock analysis.

    ## ANALYTICAL PROTOCOL
    1. **NO JOINS**: All data is pre-joined in the Omnibus views.
    2. **ACCURACY**: Use SUM(Revenue) for all financial totals. It is cent-perfect and net of returns.
    3. **FORECASTING**: To forecast, compare _MonthlyRev to _PrevMonthRev (Momentum) and _LastYearSameMonthRev (Seasonality).
    4. **INTELLIGENCE FLAGS**: 
       - SeasonalPerformanceStatus: 'SEASONAL_GROWTH' means we are beating last year's same month.
       - MonthlyMomentumStatus: 'MOMENTUM_UP' means we are beating last month.

    ## SEMANTIC MAPPING
    - Regions: Pretoria = SalesRepName LIKE '%CORREEN%'.
    - Groups: BUCO = BranchName LIKE '%BUCO%', Build It = BranchName LIKE '%BUILD IT%'.
    - Dates: Fiscal Year starts March 1st. Use FiscalYear for annual reports. Current Date: ${now}.

    ## FORBIDDEN
    - DO NOT use LAG(), LEAD(), or OVER(). All trend math is pre-calculated in the view.
    - DO NOT calculate discounts or rounding. Revenue is the final "Truth" figure.

    ## OUTPUT FORMAT (TUNE)
    Strictly follow this format (no markdown backticks):
    >>>SQL
    SELECT ...
    >>>EXP
    Explanation...
    >>>VIZ
    bar|line|pie|area
    >>>X
    ColumnNameForX
    >>>Y
    ColumnNameForY

    # CORE VIEWS (GROUND TRUTH)
    1. [v_AI_Omnibus_Forecast_Master]: Universal Sales & Forecasting. Columns: ${omnibusCols}
    2. [v_AI_Stock_Catalog]: Inventory & Catalog. Columns: ${stockCols}
  `;
};

const parseTuneResponse = (rawText: string) => {
  if (!rawText) return null;
  const data: any = {};
  const pattern = />>>(SQL|EXP|VIZ|X|Y|SUM|TRD|RSK|STR)\s*([\s\S]*?)(?=(?:>>>)|$)/g;
  let match;
  
  const keyMap: Record<string, string> = {
    "SQL": "sql",
    "EXP": "explanation",
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
    const insightPrompt = `Query: ${prompt}\nData Sample: ${JSON.stringify(data.slice(0, 10))}`;
    const insightSys = `You are a CFO. Provide strategic analysis in TUNE format:
      >>>SUM
      One sentence summary.
      >>>TRD
      - Trend 1
      - Trend 2
      >>>RSK
      - Risk 1
      - Risk 2
      >>>STR
      - Strategy 1
      - Strategy 2`;

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
