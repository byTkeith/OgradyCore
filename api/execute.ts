// api/execute.ts - Finalized Forecasting Pipeline Logic (SDK v1.0+ Compatible)
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GoogleGenAI } from "@google/generative-ai" // Ensure this package is installed

const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:8000'
const API_KEY = process.env.GEMINI_API_KEY || ''

/**
 * ARCHITECT'S NOTE:
 * This system instruction forces the AI to produce high-density time series data
 * required by Prophet/ARIMA models, ensuring we never get "1 data point" errors.
 */
const getSystemInstruction = (now: string): string => {
  const currentDate = new Date(now);
  const fiscalYear = (currentDate.getMonth() + 1) < 3 ? currentDate.getFullYear() - 1 : currentDate.getFullYear();

  return `
# ROLE: SENIOR STATISTICAL DATA HARVESTER

## 1. PRIMARY FORECASTING VIEW: [v_AI_Forecasting_Engine_Granular]
Use this view specifically for "Forecast", "Prediction", and "Inventory Modeling" prompts.
- **ds**: Date Stamp (Daily level).
- **y**: Net Quantity (The target variable for models).
- **Revenue**: Total net revenue.
- **CurrentStockOnHand**: Use this to compare the forecast against real-time warehouse levels.

## 2. AGGREGATION PROTOCOLS (MANDATORY)
To provide the background StatsModel (Prophet/ARIMA) with a clean series, you must aggregate based on the requested scope:

- **DAILY**: 
  SELECT ds, ProductName, SUM(y) AS y FROM v_AI_Forecasting_Engine_Granular GROUP BY ds, ProductName
- **WEEKLY**: 
  SELECT DATEADD(WEEK, DATEDIFF(WEEK, 0, ds), 0) AS ds, ProductName, SUM(y) AS y FROM v_AI_Forecasting_Engine_Granular GROUP BY DATEADD(WEEK, DATEDIFF(WEEK, 0, ds), 0), ProductName
- **MONTHLY**: 
  SELECT DATEFROMPARTS(YEAR(ds), MONTH(ds), 1) AS ds, ProductName, SUM(y) AS y FROM v_AI_Forecasting_Engine_Granular GROUP BY DATEFROMPARTS(YEAR(ds), MONTH(ds), 1), ProductName

## 3. ARCHITECTURAL RULES
- **HISTORY**: Pull at least 3 years (36 months) of data to capture year-over-year seasonality.
- **NO SQL MATH**: Never perform averages or stock calculations in SQL. Just return the 'ds' and 'y' series.
- **FISCAL YEAR**: Current FY is ${fiscalYear}. March 1st is the start.
- **IDENTITY**: Use [BranchName] and [ProductName] with LIKE '%...%'.

## 4. OUTPUT FORMAT:
>>>SQL
{Your Generated SQL}
>>>EXP
{Identification of the time-series scope (Daily/Weekly/Monthly)}
>>>STRAT
{Strategic insight for the CEO based on the product's 3-year history}
>>>VIZ
line
>>>X
ds
>>>Y
y
`;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, source } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  // FIXED: Correct instantiation for @google/generative-ai
  // Error TS2559 fix: Pass the API key as a simple string or inside a config object
  const genAI = new GoogleGenAI(API_KEY);

  try {
    const now = new Date().toISOString().split('T')[0];
    
    // FIXED: System instruction is now passed as an object property
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-pro",
      systemInstruction: getSystemInstruction(now)
    });

    const aiResult = await model.generateContent(prompt);
    const text = aiResult.response.text();
    
    // Standard Tag Parser
    const sqlMatch = text.match(/>>>SQL\s*([\s\S]*?)(?=\s*>>>|$)/);
    const expMatch = text.match(/>>>EXP\s*([\s\S]*?)(?=\s*>>>|$)/);
    const stratMatch = text.match(/>>>STRAT\s*([\s\S]*?)(?=\s*>>>|$)/);
    const vizMatch = text.match(/>>>VIZ\s*([\s\S]*?)(?=\s*>>>|$)/);
    const xMatch = text.match(/>>>X\s*([\s\S]*?)(?=\s*>>>|$)/);
    const yMatch = text.match(/>>>Y\s*([\s\S]*?)(?=\s*>>>|$)/);

    const plan = {
      sql: sqlMatch ? sqlMatch[1].trim() : "",
      explanation: expMatch ? expMatch[1].trim() : "",
      strategicAnalysis: stratMatch ? stratMatch[1].trim() : "",
      visualizationType: vizMatch ? vizMatch[1].trim() : "line",
      xAxis: xMatch ? xMatch[1].trim() : "ds",
      yAxis: yMatch ? yMatch[1].trim() : "y"
    };

    if (!plan.sql) throw new Error("AI failed to generate a valid forecasting query.");

    // Forward to bridge for StatsModel processing
    const bridgeRes = await fetch(`${BRIDGE_URL.replace(/\/$/, "")}/api/execute`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true' 
      },
      body: JSON.stringify({ 
        sql: plan.sql, 
        source: source || 'API_2_FORECASTER',
        needs_forecasting: true 
      })
    });

    if (!bridgeRes.ok) {
        const errorText = await bridgeRes.text();
        throw new Error(`Database Error: ${errorText}`);
    }

    const dbResult = await bridgeRes.json();

    return res.status(200).json({
      ...plan,
      data: dbResult.data || [],
      forecast_results: dbResult.forecast_results || null, 
      engine: "gemini-1.5-pro-forecaster"
    });

  } catch (e: any) {
    console.error('Forecasting Pipeline Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}