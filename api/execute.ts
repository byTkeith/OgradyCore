// api/execute.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from "@google/generative-ai"; // Corrected import

const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:8000';
const API_KEY = process.env.GEMINI_API_KEY || '';

const getSystemInstruction = (now: string): string => {
  const currentDate = new Date(now);
  const currentFiscalYear = (currentDate.getMonth() + 1) < 3 ? currentDate.getFullYear() - 1 : currentDate.getFullYear();

  return `
# ROLE: SENIOR STATISTICAL DEMAND PLANNER

## 1. PRIMARY DATA SOURCE: [v_AI_Omnibus_Master_Truth]
This is your God View. It contains cent-perfect Revenue, NetQty, Cost, GrossProfit, and Warehouse Stock.
- **FORCASTING MANDATE**: You MUST pull a 36-month time series. 
- **STRUCTURE**: Group by [TimeKey] and [ProductName].
- **ORDER**: Always [ORDER BY TimeKey ASC].
- **ACCURACY**: Use [MonthlyRevenue] and [MonthlyQty]. These are Five-Nines verified.

## 2. ARCHITECTURAL GUARDRAILS
- **NO SQL MATH**: Do not calculate safety stock in SQL. The backend StatsEngine handles the modeling.
- **FISCAL YEAR**: Current FY is ${currentFiscalYear}. Starts March 1st.
- **FILTER**: Always filter [WHERE TranDate <= CAST(GETDATE() AS DATE)] to exclude Year 2085 pollution.

## 3. OUTPUT FORMAT (STRICT):
>>>SQL
{The generated MSSQL query}
>>>EXP
{Identify the scope: Daily/Weekly/Monthly}
>>>STRAT
{Strategic insight based on 3-year history}
>>>VIZ
line
>>>X
TimeKey
>>>Y
MonthlyQty
`;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, source } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  try {
    // 1. Initialize the SDK (Correct class name for v0.24.1)
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    // 2. Instantiate Model (1.5 Pro is the top-tier paid model)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-pro", 
      systemInstruction: getSystemInstruction(new Date().toISOString())
    });

    const aiResult = await model.generateContent(prompt);
    const text = aiResult.response.text();
    
    // 3. Tag Parser
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
      xAxis: xMatch ? xMatch[1].trim() : "TimeKey",
      yAxis: yMatch ? yMatch[1].trim() : "MonthlyQty"
    };

    // 4. Execute via Bridge
    const bridgeRes = await fetch(`${BRIDGE_URL.replace(/\/$/, "")}/api/execute`, {
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
      engine: "gemini-3.1-pro-preview"
    });

  } catch (e: any) {
    console.error('Forecasting Pipeline Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}