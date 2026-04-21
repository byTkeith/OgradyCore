// api/execute.ts - Optimized for Localhost High-Performance Pipeline
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from "@google/generative-ai";

const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:8000';
const API_KEY = process.env.GEMINI_API_KEY || '';

const getSystemInstruction = (now: string): string => {
  return `
# ROLE: SENIOR STATISTICAL DATA ARCHITECT

## 1. THE PROPHET PROTOCOL
You are harvesting data for a Facebook Prophet / ARIMA model.
- **MANDATORY VIEW**: [v_AI_Forecasting_Engine_Granular]
- **COLUMN CONVENTION**: You MUST use [ds] for the date and [y] for the quantity. This is the required format for the statistical engine.
- **SORTING RULE**: You MUST [ORDER BY ProductName, ds ASC]. This ensures the time-series is segmented product-by-product.

## 2. AGGREGATION RULES
- **WEEKLY FORECAST**: 
  SELECT DATEADD(WEEK, DATEDIFF(WEEK, 0, ds), 0) AS ds, ProductName, SUM(y) AS y, MAX(CurrentStockOnHand) AS Stock
  FROM v_AI_Forecasting_Engine_Granular
  WHERE ds >= DATEADD(YEAR, -3, GETDATE())
  GROUP BY DATEADD(WEEK, DATEDIFF(WEEK, 0, ds), 0), ProductName
  ORDER BY ProductName, ds ASC;

## 3. SEMANTIC STANDARDS
- All Revenue and Quantity is pre-calculated for Five-Nines accuracy.
- Branch filtering uses [BranchName] with LIKE '%...%'.
- Do NOT perform any math (AVG/MIN/MAX) on the 'y' value. Just return the series.

## 4. OUTPUT FORMAT
>>>SQL
{Your SQL}
>>>EXP
{Identify the series frequency: Weekly/Daily}
>>>STRAT
{High-level context for the CEO}
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

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.1-pro-preview",
      systemInstruction: getSystemInstruction(new Date().toISOString())
    });

    const aiResult = await model.generateContent(prompt);
    const text = aiResult.response.text();
    
    // Regex for our tag system
    const sqlMatch = text.match(/>>>SQL\s*([\s\S]*?)(?=\s*>>>|$)/);
    const plan = { sql: sqlMatch ? sqlMatch[1].trim() : "" };

    // Execute with infinite timeout (since we are moving to localhost)
    const bridgeRes = await fetch(`${BRIDGE_URL}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        sql: plan.sql, 
        source: source || 'API_2_FORECASTER',
        needs_forecasting: true 
      })
    });

    const dbResult = await bridgeRes.json();

    return res.status(200).json({
      ...plan,
      data: dbResult.data || [],
      forecast_results: dbResult.forecast_results || null,
      engine: "gemini-1.5-pro-forecaster"
    });

  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}