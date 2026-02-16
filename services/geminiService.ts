
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
      signal: AbortSignal.timeout(180000) // 3 minute timeout for heavy local LLM processing
    });

    if (!response.ok) {
      let errorMsg = `Server Error ${response.status}`;
      try {
        const errorData = await response.json();
        errorMsg = errorData.detail || errorMsg;
      } catch (e) {
        if (response.status === 404) errorMsg = "API endpoint not found. Ensure main.py is running on port 8000.";
        if (response.status === 500) errorMsg = "The Intelligence Node (AI) failed to generate a valid response. Rephrase your request.";
      }
      throw new Error(errorMsg);
    }

    return await response.json();

  } catch (error: any) {
    console.error("Pipeline Error:", error);
    let msg = error.message || "Connection failed.";
    if (error.name === 'TimeoutError') {
      msg = "AI Analyst timed out. Your local AI is processing but taking longer than 3 minutes.";
    } else if (msg.includes("Failed to fetch")) {
      msg = "Cannot reach the Intelligence Node. Check your Bridge Link settings or ensure the Python server is running.";
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
