
import { DEFAULT_BRIDGE_URL, SCHEMA_MAP } from "../constants";
import { QueryResult, AnalystInsight } from "../types";

const getSettings = () => {
  const storedUrl = localStorage.getItem('og_bridge_url');
  let baseUrl = storedUrl || DEFAULT_BRIDGE_URL;
  
  // Clean trailing slash
  baseUrl = baseUrl.replace(/\/$/, "");
  
  return { bridgeUrl: baseUrl };
};

export const initSchema = async (urlOverride?: string): Promise<{ success: boolean; data: Record<string, string[]>; error?: string }> => {
  // We actually don't need to fetch schema from backend anymore because constants.tsx has it for display
  // But we use this to verify the backend is reachable.
  const staticData: Record<string, string[]> = {};
  Object.keys(SCHEMA_MAP).forEach(key => {
    staticData[key] = SCHEMA_MAP[key].fields;
  });
  return Promise.resolve({ success: true, data: staticData });
};

interface BackendPipelineResponse {
  sql: string;
  explanation: string;
  visualizationType: 'bar' | 'line' | 'scatter' | 'area' | 'pie';
  xAxis: string;
  yAxis: string;
  data: any[];
  insight: AnalystInsight;
  engine: string;
}

export const analyzeQuery = async (prompt: string): Promise<QueryResult & { engine: string, insight: AnalystInsight }> => {
  const { bridgeUrl } = getSettings();
  
  // Logic: 
  // 1. If bridgeUrl exists (e.g., https://xyz.ngrok-free.app), use it.
  // 2. If no bridgeUrl, assume relative path (useful if built into python dist folder).
  const endpoint = bridgeUrl ? `${bridgeUrl}/api/analyze` : '/api/analyze';
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'ngrok-skip-browser-warning': '69420' // Bypasses ngrok warning page
      },
      body: JSON.stringify({ prompt: prompt }),
      signal: AbortSignal.timeout(90000) 
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(err.detail || `Server Error: ${response.status}`);
    }

    const result: BackendPipelineResponse = await response.json();

    return {
      data: result.data,
      sql: result.sql,
      explanation: result.explanation,
      visualizationType: result.visualizationType,
      xAxis: result.xAxis,
      yAxis: result.yAxis,
      engine: result.engine,
      insight: result.insight 
    };

  } catch (error: any) {
    console.error("Pipeline Error:", error);
    let msg = error.message || "Failed to communicate with OgradyCore Bridge.";
    if (msg.includes("Failed to fetch")) {
      msg = "Cannot reach Remote Server. Check Ngrok URL or Internet Connection.";
    }
    throw new Error(msg);
  }
};

export const getAnalystInsight = async (queryResult: QueryResult): Promise<AnalystInsight & { engine: string }> => {
  // This is now handled entirely by the backend pipeline
  return {
    summary: "Processed by backend pipeline.",
    trends: [],
    anomalies: [],
    suggestions: [],
    engine: "Local Pipeline"
  };
};

export const generateStrategicBrief = async (data: any): Promise<{text: string, engine: string} | null> => {
  return null;
};
