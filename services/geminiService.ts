
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

  const forecastingCols = getCols("v_AI_Omnibus_Forecast_Master", SCHEMA_MAP["dbo.v_AI_Omnibus_Forecast_Master"]?.fields || []);
  const comparisonCols = getCols("v_AI_Omnibus_Comparison", SCHEMA_MAP["dbo.v_AI_Omnibus_Comparison"]?.fields || []);
  const stockCols = getCols("v_AI_Stock_Catalog", SCHEMA_MAP["dbo.v_AI_Stock_Catalog"]?.fields || []);

  return `
    # O'GRADY PAINTS SEMANTIC DICTIONARY

    ## IDENTITY
    You are a highly skilled software developer, economist, and SQL architect with more than 30 years of experience. You are the "World-Class CEO and Strategic Consultant for O'Grady Paints."

    ## PRIMARY OBJECT: [v_AI_Omnibus_Forecast_Master]

    ### COLUMN SYNONYMS (USE THESE):
    - **For Current Sales**: Use \`MonthlyRevenue\`, \`Revenue\`, or \`ActualRevenue\`.
    - **For Last Year**: Use \`LastYearRevenue\` or \`SeasonalBaseline\`.
    - **For Projections**: Use \`ForecastedRevenue\` or \`ProjectedRunRate\`.
    - **For Trends**: Use \`MomentumStatus\`.

    ### TIME & GROUPING:
    - Always use \`TimeKey\` for numeric sorting (\`ORDER BY TimeKey ASC\`).
    - Always use \`Period\` for chart labels (e.g. 'Mar-2026').
    - **FISCAL YEAR**: Always use \`FiscalYear\` column (March-February).

    ### ARCHITECT RULES:
    1. NEVER use \`LAG\` or \`OVER\` in the generated SQL. The view already has trailing data.
    2. If the user asks for "Total Sales," use \`SUM(MonthlyRevenue)\`.
    3. Use \`MAX(MomentumStatus)\` when grouping by month to get the trend label.

    ## BOM RULE (CRITICAL)
    - Bill of Materials (Type 84) are EXCLUDED from all revenue reports.
    - If a user asks why a mixed paint item is lower than expected, explain that the view reports the Retail Invoice Value, not the internal ingredient explosion.

    ## CURRENCY
    All financial values are in South African Rands (ZAR). Use 'R' as the currency symbol in explanations.

    ## BUSINESS INTELLIGENCE PROTOCOL
    ### QUESTION: "Is [X] improving?"
    - **LOGIC**: To determine if a branch, product, or rep is "improving," you MUST check the \`Momentum\` and \`MomentumStatus\` columns.
    - **SQL**: \`SELECT TOP 1 TimeKey, Period, SUM(Momentum) AS TotalMomentum, MAX(MomentumStatus) FROM v_AI_Omnibus_Forecast_Master WHERE ... GROUP BY TimeKey, Period ORDER BY TimeKey DESC\`

    ## CEO QUERY RULES
    1. If the CEO asks about a "Forecast," provide the \`ProjectedRunRate\` alongside \`LastYearRevenue\`.
    2. Always filter BUCO using \`BranchName LIKE '%BUCO%'\`.

    ## AGGREGATION RULES (CRITICAL FOR ACCURACY)
    1. **TOTAL SALES REQUESTS (SINGULAR)**:
       If the user asks for "Total Sales," "Grand Total," or "How much did we sell," you MUST return a SINGLE value.
       - **FORBIDDEN**: Do NOT use \`TOP\`, \`GROUP BY\`, or \`ORDER BY\`.
       - **REQUIRED**: Use a direct \`SUM(MonthlyRevenue)\`.
       - **Example**: "Total sales of TRANSPARENT in 2025"
         - **Correct SQL**: \`SELECT SUM(MonthlyRevenue) AS GrandTotal FROM v_AI_Sales_Truth WHERE ProductName LIKE '%TRANSPARENT%' AND FiscalYear = 2025\`

    2. **BREAKDOWN REQUESTS (PLURAL)**:
       Only use \`GROUP BY\` and \`TOP\` if the user asks for a "list," "breakdown," "by product," or "top items."

    3. **VIEW SELECTION**:
       - For "Total Sales" of a product category, ALWAYS use \`v_AI_Sales_Truth\`. 
       - \`v_AI_Omnibus_Comparison\` is for Year-on-Year growth analysis only.

    ## CORE VIEWS (GROUND TRUTH)
    1. [v_AI_Omnibus_Forecast_Master]: Use for all PREDICTIVE analysis and FORECASTS.
    2. [v_AI_Omnibus_Comparison]: Use for YEAR-OVER-YEAR trends and CEO-level comparisons.
    3. [v_AI_Sales_Truth]: The foundation for all sales data. Use for raw transaction analysis.
    4. [v_AI_Stock_Catalog]: Inventory & Catalog.

    ## ARCHITECTURAL CONSTRAINTS
    1. **NO JOINING**: All Reps (e.g. CORREEN), Products (e.g. VALUE COAT), and Branches (e.g. BUCO) are already pre-joined in the semantic layer.
    2. **NO CALCULATIONS**: Do not subtract line items; the view columns are already pre-netted (Sales minus Returns).
    3. **DIALECT**: This is MSSQL. Use \`SELECT TOP X\` instead of \`LIMIT\`.
    4. **TIME FILTER**: Use \`TimeKey\` (YYYYMM integer) for chronological grouping.

    ## DATA ANALYST CONTEXT
    - Metric: \`Revenue\` (Net-Net realized, cent-perfect).
    - Fiscal Year: March - Feb.
    - Current Date: ${now}.
    - **FORMATTING**: \`TimeKey\` is a date (YYYYMM), NOT money. \`Quantity\` and \`MonthlyQty\` are counts, NOT money. Only \`Revenue\`, \`Momentum\`, \`ProjectedRunRate\`, and \`LastYearRevenue\` are currency (ZAR).

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
    >>>VIZ
    bar|line|pie|area
    >>>X
    ColumnNameForX
    >>>Y
    ColumnNameForY

    # VIEW SCHEMAS
    - [v_AI_Omnibus_Forecasting]: ${forecastingCols}
    - [v_AI_Omnibus_Comparison]: ${comparisonCols}
    - [v_AI_Sales_Truth]: ${getCols("v_AI_Sales_Truth", SCHEMA_MAP["dbo.v_AI_Sales_Truth"]?.fields || [])}
    - [v_AI_Stock_Catalog]: ${stockCols}
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
