// api/execute.ts - Cent-Perfect Statistical Forecasting Pipeline
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from "@google/generative-ai";

// ============ CONFIGURATION ============
const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:8000';
const API_KEY = process.env.GEMINI_API_KEY || '';

/**
 * ARCHITECT'S NOTE:
 * We have decoupled the logic. 
 * Use [v_AI_Forecasting_Engine_Granular] for high-resolution stats.
 * This view provides 'ds' and 'y' for direct ingestion into Prophet/ARIMA.
 */
const getSystemInstruction = (now: string): string => {
  const currentDate = new Date(now);
  const currentFiscalYear = (currentDate.getMonth() + 1) < 3 ? currentDate.getFullYear() - 1 : currentDate.getFullYear();

  return `
# ROLE: SENIOR STATISTICAL DATA HARVESTER

## 1. PRIMARY FORECASTING VIEW: [v_AI_Forecasting_Engine_Granular]
Use this view specifically for "Forecast", "Prediction", and "Inventory Modeling" prompts.
- **ds**: Date Stamp (Daily level granularity).
- **y**: Net Quantity (The FIVE-NINES cent-perfect target variable).
- **Revenue**: Total net revenue for financial weighted analysis.
- **CurrentStockOnHand**: Real-time warehouse levels to compare against the forecast.

## 2. AGGREGATION PROTOCOLS (MANDATORY)
To provide the background StatsModel (Prophet/ARIMA) with a clean series, you must aggregate based on the requested scope:

- **DAILY**: 
  SELECT ds, ProductName, SUM(y) AS y FROM v_AI_Forecasting_Engine_Granular GROUP BY ds, ProductName
- **WEEKLY**: 
  SELECT DATEADD(WEEK, DATEDIFF(WEEK, 0, ds), 0) AS ds, ProductName, SUM(y) AS y FROM v_AI_Forecasting_Engine_Granular GROUP BY DATEADD(WEEK, DATEDIFF(WEEK, 0, ds), 0), ProductName
- **MONTHLY**: 
  SELECT DATEFROMPARTS(YEAR(ds), MONTH(ds), 1) AS ds, ProductName, SUM(y) AS y FROM v_AI_Forecasting_Engine_Granular GROUP BY DATEFROMPARTS(YEAR(ds), MONTH(ds), 1), ProductName

## 3. ARCHITECTURAL RULES
- **TIME SERIES MANDATE**: You MUST pull at least 3 years (36 months) of data. NEVER fetch a single row.
- **NO SQL MATH**: Do not calculate safety stock or averages in SQL. Return the raw 'ds' and 'y' series.
- **FISCAL YEAR**: Current FY is ${currentFiscalYear}. Starts March 1st.
- **DATA INTEGRITY**: Always filter [WHERE ds <= CAST(GETDATE() AS DATE)] to exclude Year 2085 pollution.
- **IDENTITY**: Use [BranchName] and [ProductName] with LIKE '%...%'.

## 4. OUTPUT FORMAT (STRICT):
>>>SQL
{Your Generated MSSQL Query}
>>>EXP
{Identify the time-series scope: Daily/Weekly/Monthly}
>>>STRAT
{Strategic insight based on the historical movement detected}
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

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const now = new Date().toISOString().split('T')[0];

    // ARCHITECT'S NOTE: Standardized to 1.5-pro for stable production reasoning.
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-pro", 
      systemInstruction: getSystemInstruction(now)
    });

    const aiResult = await model.generateContent(prompt);
    const text = aiResult.response.text();
    
    // Tag Parser
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

    // 5. Forward to Bridge for StatsModel (Prophet/ARIMA) processing
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
        throw new Error(`Database Bridge Error: ${errorText}`);
    }

    const dbResult = await bridgeRes.json();

    return res.status(200).json({
      ...plan,
      data: dbResult.data || [],
      forecast_results: dbResult.forecast_results || null, // Capture results from Prophet/ARIMA
      engine: "gemini-1.5-pro-forecaster"
    });

  } catch (e: any) {
    console.error('Forecasting Pipeline Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}