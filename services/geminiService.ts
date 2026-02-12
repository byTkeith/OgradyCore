
import { DEFAULT_BRIDGE_URL, SCHEMA_MAP } from "../constants";
import { QueryResult, AnalystInsight } from "../types";

const getSettings = () => {
  const storedUrl = localStorage.getItem('og_bridge_url');
  let baseUrl = storedUrl || DEFAULT_BRIDGE_URL;
  return { bridgeUrl: baseUrl.replace(/\/$/, "") };
};

export const analyzeQuery = async (prompt: string): Promise<QueryResult & { engine: string, insight: AnalystInsight }> => {
  const { bridgeUrl } = getSettings();
  const endpoint = bridgeUrl ? `${bridgeUrl}/api/analyze` : '/api/analyze';
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ prompt }),
      // Extended timeout to support DeepSeek/Llama heavy reasoning
      signal: AbortSignal.timeout(300000) 
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Request processing failed." }));
      throw new Error(errorData.detail || `Server Error ${response.status}`);
    }

    return await response.json();

  } catch (error: any) {
    console.error("Pipeline Error:", error);
    let msg = error.message || "Connection failed.";
    if (error.name === 'TimeoutError') {
      msg = "The request timed out. The local AI is taking too long to process this query. Try a simpler question or check your server load.";
    } else if (msg.includes("Failed to fetch")) {
      msg = "Cannot reach Remote Computer. Check Ngrok status or verify the Bridge URL in settings.";
    }
    throw new Error(msg);
  }
};

export const initSchema = async (urlOverride?: string): Promise<{ success: boolean; data: Record<string, string[]>; error?: string }> => {
  const staticData: Record<string, string[]> = {};
  Object.keys(SCHEMA_MAP).forEach(key => {
    staticData[key] = SCHEMA_MAP[key].fields;
  });
  return Promise.resolve({ success: true, data: staticData });
};

export const getAnalystInsight = async (queryResult: QueryResult): Promise<AnalystInsight & { engine: string }> => {
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
