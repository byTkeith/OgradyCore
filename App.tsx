
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import { AppSection } from './types';
import { DEFAULT_BRIDGE_URL } from './constants';
import { initSchema } from './services/geminiService';

export type ConnStatus = 'testing' | 'online' | 'db_error' | 'offline';

const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<AppSection>(AppSection.DASHBOARD);
  const [connStatus, setConnStatus] = useState<ConnStatus>('testing');
  const [lastError, setLastError] = useState<string | null>(null);
  const [bridgeUrl, setBridgeUrl] = useState(localStorage.getItem('og_bridge_url') || DEFAULT_BRIDGE_URL);
  const [detectedSchema, setDetectedSchema] = useState<Record<string, string[]>>({});
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const checkConnection = useCallback(async (urlOverride?: string) => {
    const targetUrl = (urlOverride || bridgeUrl).replace(/\/$/, "");
    if (!targetUrl) return setConnStatus('offline');
    
    setConnStatus('testing');
    setLastError(null);
    
    try {
      // Step 1: Check if Bridge (Python) is even reachable
      const pingRes = await fetch(`${targetUrl}/ping`, { 
        headers: { 'ngrok-skip-browser-warning': '69420' }
      }).catch(() => null);

      if (!pingRes || !pingRes.ok) {
        setConnStatus('offline');
        setLastError("The Bridge Server (Python) is unreachable. Check your Ngrok link and ensure main.py is running.");
        return;
      }

      // Step 2: Bridge is alive, now check Database
      const healthRes = await fetch(`${targetUrl}/health`, { 
          headers: { 'ngrok-skip-browser-warning': '69420' } 
      });
      const healthData = await healthRes.json();
      
      if (healthData.db_connected) {
        setConnStatus('online');
        localStorage.setItem('og_bridge_url', targetUrl);
        
        // Step 3: Fetch Schema
        const schemaResult = await initSchema(targetUrl);
        if (schemaResult.success) {
          setDetectedSchema(schemaResult.data);
        } else {
          setLastError(`Database connected, but schema discovery failed: ${schemaResult.error}`);
        }
      } else {
        setConnStatus('db_error');
        setLastError(`Bridge is Online, but SQL Server connection failed: ${healthData.error}`);
      }
    } catch (err: any) {
      setConnStatus('offline');
      setLastError(err.message || "Network error occurred while contacting the bridge.");
    }
  }, [bridgeUrl]);

  useEffect(() => { 
    checkConnection(); 
  }, [checkConnection]);

  const handleUpdateBridge = () => {
    checkConnection(bridgeUrl);
  };

  const renderContent = () => {
    switch (activeSection) {
      case AppSection.DASHBOARD: return <Dashboard />;
      case AppSection.ANALYST_CHAT: return <ChatInterface />;
      case AppSection.DATA_EXPLORER:
        return (
          <div className="p-8 md:p-16 max-w-6xl mx-auto space-y-12 overflow-y-auto h-full pb-32 custom-scrollbar">
            <div className="text-center">
              <h2 className="text-4xl font-black text-white uppercase tracking-tighter">System Diagnostic</h2>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Bridge Protocol v3.4</p>
            </div>

            <div className="grid md:grid-cols-1 gap-8 max-w-2xl mx-auto">
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-emerald-500 uppercase tracking-widest">Bridge Endpoint</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-slate-500 uppercase">STATUS:</span>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                      connStatus === 'online' ? 'bg-emerald-500/20 text-emerald-500' :
                      connStatus === 'db_error' ? 'bg-amber-500/20 text-amber-500' :
                      'bg-rose-500/20 text-rose-500'
                    }`}>
                      {connStatus.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">URL/NGROK LINK</label>
                  <input 
                    type="text" 
                    value={bridgeUrl} 
                    onChange={(e) => setBridgeUrl(e.target.value)} 
                    className="w-full bg-black/40 border border-slate-700 rounded-xl px-5 py-4 text-sm font-mono text-emerald-400 focus:outline-none focus:border-emerald-500/50" 
                  />
                </div>
                <button 
                  onClick={handleUpdateBridge} 
                  className="w-full py-4 bg-emerald-600 text-white font-black uppercase text-[10px] rounded-xl hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-900/20"
                >
                  {connStatus === 'testing' ? 'Verifying...' : 'Re-Validate System'}
                </button>
              </div>

              {lastError && (
                <div className={`border p-6 rounded-2xl animate-in fade-in slide-in-from-top-2 ${
                  connStatus === 'db_error' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-rose-500/10 border-rose-500/20'
                }`}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl">{connStatus === 'db_error' ? '⚡' : '⚠️'}</span>
                    <h4 className={`text-[10px] font-black uppercase tracking-widest ${
                      connStatus === 'db_error' ? 'text-amber-500' : 'text-rose-500'
                    }`}>
                      {connStatus === 'db_error' ? 'Database Connection Refused' : 'Bridge Communication Error'}
                    </h4>
                  </div>
                  <p className={`text-xs font-mono leading-relaxed ${
                    connStatus === 'db_error' ? 'text-amber-400/80' : 'text-rose-400/80'
                  }`}>{lastError}</p>
                </div>
              )}
            </div>

            {Object.keys(detectedSchema).length > 0 && (
              <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] shadow-2xl space-y-6">
                 <div className="flex items-center justify-between">
                   <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                     <span className="text-2xl">📊</span> Live Schema Tables
                   </h3>
                 </div>
                 <div className="grid md:grid-cols-2 gap-4">
                   {Object.entries(detectedSchema).map(([table, cols]) => (
                     <div key={table} className="bg-black/40 p-5 rounded-2xl border border-slate-800">
                        <p className="text-[10px] font-black text-emerald-500 uppercase mb-3">{table}</p>
                        <div className="flex flex-wrap gap-2">
                          {cols.map(c => <span key={c} className="text-[9px] font-mono bg-slate-800 px-2 py-1 rounded text-slate-400">{c}</span>)}
                        </div>
                     </div>
                   ))}
                 </div>
              </div>
            )}
          </div>
        );
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      <Sidebar 
        activeSection={activeSection} 
        setActiveSection={setActiveSection} 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)}
        connStatus={connStatus}
      />
      <main className="flex-1 overflow-hidden flex flex-col relative">
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 md:px-10 bg-slate-950/80 backdrop-blur-xl z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 text-slate-400">☰</button>
            <div className="flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full ${
                connStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 
                connStatus === 'db_error' ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b]' :
                'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
              }`}></span>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">
                {connStatus === 'online' ? 'GEMINI LINK STABLE' : 
                 connStatus === 'db_error' ? 'BRIDGE UP / DB DOWN' : 'LINK DISCONNECTED'}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">OgradyCore v3.4</span>
        </header>
        <div className="flex-1 overflow-hidden relative">{renderContent()}</div>
      </main>
    </div>
  );
};

export default App;
