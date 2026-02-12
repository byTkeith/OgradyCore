
import { DEFAULT_BRIDGE_URL, SCHEMA_MAP } from "../constants";
import { QueryResult, AnalystInsight } from "../types";

const getSettings = () => {
  const storedUrl = localStorage.getItem('og_bridge_url');
  let baseUrl = storedUrl || DEFAULT_BRIDGE_URL;
  return { bridgeUrl: baseUrl.replace(/\/$/, "") };
};

export const analyzeQuery = async (prompt: string): Promise<QueryResult & { engine: string, insight: AnalystInsight }> => {
  const { bridgeUrl } = getSettings();
  
  // If bridgeUrl is empty, it uses relative '/api/analyze' (for single-server mode)
  // If it's an ngrok URL, it uses that.
  const endpoint = bridgeUrl ? `${bridgeUrl}/api/analyze` : '/api/analyze';
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true', // Essential for ngrok tunnels
        'Accept': 'application/json'
      },
      body: JSON.stringify({ prompt }),
      signal: AbortSignal.timeout(95000) 
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Unknown server error" }));
      throw new Error(errorData.detail || `Bridge Error (${response.status})`);
    }

    return await response.json();

  } catch (error: any) {
    console.error("Pipeline Error:", error);
    let msg = error.message || "Connection failed.";
    if (msg.includes("Failed to fetch")) {
      msg = "Cannot reach Remote Computer. Check your Ngrok URL and ensure the server is running.";
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
