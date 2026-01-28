
export interface DataRecord {
  [key: string]: string | number | boolean | null;
}

export interface QueryResult {
  data: DataRecord[];
  sql: string;
  explanation: string;
  visualizationType: 'bar' | 'line' | 'scatter' | 'area' | 'pie';
  xAxis: string;
  yAxis: string;
}

export interface AnalystInsight {
  summary: string;
  trends: string[];
  anomalies: string[];
  suggestions: string[];
}

export enum AppSection {
  DASHBOARD = 'DASHBOARD',
  ANALYST_CHAT = 'ANALYST_CHAT',
  DATA_EXPLORER = 'DATA_EXPLORER',
  REPORTS = 'REPORTS'
}
