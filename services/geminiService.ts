
import { GoogleGenAI, Type } from "@google/genai";
import { SCHEMA_MAP } from "../constants";
import { QueryResult, AnalystInsight } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const SYSTEM_INSTRUCTION = `
You are a senior Business Intelligence Analyst for 'OgradyCore'.
You have access to a SQL Server database schema (Ultisales). 

CRITICAL: The tables in the database use the 'tbl' prefix. 
Examples: 
- tblClients (not DEBTOR)
- tblInvoices (not TRANSACTIONS)
- tblStock (not STOCK)
- tblAudit (not AUDIT)

Your task:
1. Translate Natural Language into a valid T-SQL query using the 'tbl' prefix for table names.
2. Determine the best visualization type (bar, line, scatter, area, pie) and axis mappings.
3. Provide an explanation of the analytical logic.

Database Schema Map Reference:
${JSON.stringify(SCHEMA_MAP, null, 2)}
`;

// Helper to get the current bridge URL
const getBridgeUrl = () => {
  return localStorage.getItem('og_bridge_url') || 'http://192.168.8.28:8000';
};

export const analyzeQuery = async (prompt: string): Promise<QueryResult> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `User request: ${prompt}. 
    Respond in JSON format only.
    Structure:
    {
      "sql": "SELECT ... FROM tblClients ...",
      "explanation": "analytical explanation",
      "visualizationType": "bar" | "line" | "scatter" | "area" | "pie",
      "xAxis": "field name for x axis",
      "yAxis": "field name for y axis"
    }`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sql: { type: Type.STRING },
          explanation: { type: Type.STRING },
          visualizationType: { type: Type.STRING },
          xAxis: { type: Type.STRING },
          yAxis: { type: Type.STRING }
        },
        required: ["sql", "explanation", "visualizationType", "xAxis", "yAxis"]
      }
    }
  });

  const geminiResult = JSON.parse(response.text || '{}');
  const baseUrl = getBridgeUrl().replace(/\/$/, "");

  try {
    const dbResponse = await fetch(`${baseUrl}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: geminiResult.sql })
    });

    if (!dbResponse.ok) {
      const errorData = await dbResponse.json();
      throw new Error(errorData.detail || 'Backend execution failed');
    }

    const realData = await dbResponse.json();

    return {
      ...geminiResult,
      data: realData
    } as QueryResult;
  } catch (error: any) {
    console.error("Bridge Error:", error);
    return {
      ...geminiResult,
      data: [],
      explanation: `⚠️ SQL generated, but connection to Bridge failed. 
      Error: ${error.message}. 
      Check "Live Data Link" settings and ensure Bridge is running.`
    } as QueryResult;
  }
};

export const getAnalystInsight = async (queryResult: QueryResult): Promise<AnalystInsight> => {
  if (!queryResult.data || queryResult.data.length === 0) {
    return {
      summary: "Cannot provide insight because no data was retrieved from the database bridge.",
      trends: [],
      anomalies: [],
      suggestions: ["Check your database connection in the settings panel."]
    };
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze this dataset from the Ultisales database:
    SQL Query: ${queryResult.sql}
    Data (sample): ${JSON.stringify(queryResult.data.slice(0, 10))}
    
    Identify trends, highlight potential anomalies, and suggest market strategies.
    Respond in JSON only.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          trends: { type: Type.ARRAY, items: { type: Type.STRING } },
          anomalies: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["summary", "trends", "anomalies", "suggestions"]
      }
    }
  });

  return JSON.parse(response.text || '{}') as AnalystInsight;
};
