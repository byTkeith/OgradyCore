
import React, { useState, useEffect, useCallback } from 'react';
import { DEFAULT_BRIDGE_URL } from '../constants';
import { AppSection } from '../types';

interface DashboardProps {
  bridgeUrl?: string;
  isOnline?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ bridgeUrl, isOnline = true }) => {
  const [latency, setLatency] = useState<number | null>(null);
  const [dbName, setDbName] = useState<string>('Unknown');
  const [lastCheck, setLastCheck] = useState<string>(new Date().toLocaleTimeString());

  const checkHealth = useCallback(async () => {
    if (!bridgeUrl) return;
    const start = Date.now();
    try {
      const baseUrl = bridgeUrl.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/health`, {
        headers: { 'ngrok-skip-browser-warning': '69420' },
        signal: AbortSignal.timeout(5000)
      });
      const data = await res.json();
      const end = Date.now();
      
      if (res.ok && data.status === 'online') {
        setLatency(end - start);
        setDbName('UltiSales (MSSQL)');
        setLastCheck(new Date().toLocaleTimeString());
      }
    } catch (e) {
      setLatency(null);
    }
  }, [bridgeUrl]);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Only ping every 30s
    return () => clearInterval(interval);
  }, [checkHealth]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-5xl md:text-7xl font-black text-white uppercase tracking-tighter">
          Ogrady<span className="text-emerald-500">Core</span>
        </h1>
        <p className="text-sm text-slate-500 font-bold uppercase tracking-[0.5em]">
          Intelligence Bridge v8.2
        </p>
      </div>

      {/* Status Card */}
      <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] shadow-2xl w-full max-w-2xl relative overflow-hidden group">
        <div className={`absolute inset-0 opacity-10 transition-colors duration-500 ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center border-4 shadow-xl transition-colors duration-500 ${
              isOnline ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-rose-500 bg-rose-500/10 text-rose-500'
            }`}>
              <span className="text-3xl">{isOnline ? '⚡' : '⛔'}</span>
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                {isOnline ? 'System Active' : 'System Offline'}
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-1">
                {isOnline ? `Connected to ${dbName}` : 'Bridge connection failed'}
              </p>
            </div>
          </div>

          <div className="text-right space-y-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-black/40 rounded-xl border border-slate-700/50">
              <span className="text-[10px] text-slate-500 font-bold uppercase">Latency</span>
              <span className={`text-sm font-mono font-bold ${latency && latency < 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {latency ? `${latency}ms` : '---'}
              </span>
            </div>
            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">
              Last Ping: {lastCheck}
            </p>
          </div>
        </div>
      </div>

      {/* Action Area */}
      {isOnline && (
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
           <p className="text-center text-slate-500 text-xs mb-6 font-medium italic">
             Visualizations disabled to prioritize Analyst Bandwidth.
           </p>
           {/* Note: This is just a visual indicator, the user navigates via Sidebar */}
           <div className="flex gap-4 opacity-50 pointer-events-none">
              <div className="h-32 w-32 rounded-2xl border border-slate-800 bg-slate-900/50"></div>
              <div className="h-32 w-32 rounded-2xl border border-slate-800 bg-slate-900/50"></div>
              <div className="h-32 w-32 rounded-2xl border border-slate-800 bg-slate-900/50"></div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
