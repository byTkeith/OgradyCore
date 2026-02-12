
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import { AppSection } from './types';
import { DEFAULT_BRIDGE_URL } from './constants';
import { DOMAIN_MAPPINGS } from './metadata_mappings';
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
    // Logic: if urlOverride/bridgeUrl is empty, use relative path '/api'.
    const baseUrl = (urlOverride || bridgeUrl || "").replace(/\/$/, "");
    const pingUrl = baseUrl ? `${baseUrl}/api/ping` : '/api/ping';
    const healthUrl = baseUrl ? `${baseUrl}/api/health` : '/api/health';
    
    setConnStatus('testing');
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); 

      const pingRes = await fetch(pingUrl, { 
        headers: { 'ngrok-skip-browser-warning': '69420' },
        signal: controller.signal
      }).catch(() => null);

      clearTimeout(timeoutId);

      if (!pingRes || !pingRes.ok) {
        setConnStatus('offline');
        setLastError("Bridge link timeout. Verify endpoint.");
        return;
      }

      const healthRes = await fetch(healthUrl, { 
          headers: { 'ngrok-skip-browser-warning': '69420' } 
      });
      const healthData = await healthRes.json();
      
      if (healthData.db_connected) {
        setConnStatus('online');
        // Only save if user explicitly typed a URL. If empty (default), keep it empty.
        if (urlOverride) localStorage.setItem('og_bridge_url', baseUrl);
        
        setLastError(null);
        
        initSchema(baseUrl).then(schemaResult => {
          if (schemaResult.data && typeof schemaResult.data === 'object') {
            setDetectedSchema(schemaResult.data);
          }
          if (schemaResult.error) setLastError(schemaResult.error);
        });
      } else {
        setConnStatus('db_error');
        setLastError(`SQL link failure: ${healthData.error}`);
      }
    } catch (err: any) {
      setConnStatus('offline');
      setLastError("Hybrid link interference detected.");
    }
  }, [bridgeUrl]);

  useEffect(() => { checkConnection(); }, [checkConnection]);

  const renderContent = () => {
    switch (activeSection) {
      case AppSection.DASHBOARD: return <Dashboard bridgeUrl={bridgeUrl} isOnline={connStatus === 'online'} />;
      case AppSection.ANALYST_CHAT: return <ChatInterface />;
      case AppSection.DATA_EXPLORER:
        return (
          <div className="p-8 md:p-16 max-w-6xl mx-auto space-y-16 overflow-y-auto h-full pb-32 custom-scrollbar">
            <div className="text-center">
              <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Diagnostic Core</h2>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2 italic">Hybrid Analysis v4.4</p>
            </div>

            <div className="grid md:grid-cols-1 gap-8 max-w-2xl mx-auto">
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-emerald-500 uppercase tracking-widest">Active Endpoint</h3>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                    connStatus === 'online' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'
                  }`}>
                    {connStatus}
                  </span>
                </div>
                <input 
                  type="text" 
                  value={bridgeUrl} 
                  placeholder="Leave empty for local automatic mode"
                  onChange={(e) => setBridgeUrl(e.target.value)} 
                  className="w-full bg-black/40 border border-slate-700 rounded-xl px-5 py-4 text-sm font-mono text-emerald-400 focus:outline-none focus:border-emerald-500/50" 
                />
                <button onClick={() => checkConnection(bridgeUrl)} className="w-full py-4 bg-emerald-600 text-white font-black uppercase text-[10px] rounded-xl hover:bg-emerald-500 transition-all">Verify Connection</button>
              </div>

              {lastError && (
                <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-2xl animate-in fade-in">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-2">Alert Buffer</h4>
                  <p className="text-xs font-mono text-rose-400/80 leading-relaxed">{lastError}</p>
                </div>
              )}
            </div>

            {/* Knowledge Base Section */}
            <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] shadow-2xl space-y-8">
               <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">🧠 Knowledge Base (Mappings)</h3>
               <div className="grid md:grid-cols-2 gap-6">
                 {Object.entries(DOMAIN_MAPPINGS).map(([table, mappings]) => (
                   <div key={table} className="bg-black/40 p-6 rounded-2xl border border-slate-800/50">
                     <p className="text-xs font-black text-emerald-500 uppercase mb-4 tracking-widest border-b border-emerald-500/20 pb-2">{table} TABLE MAPPINGS</p>
                     <div className="space-y-4">
                       {Object.entries(mappings).map(([field, values]) => (
                         <div key={field}>
                           <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">{field}:</p>
                           <div className="flex flex-wrap gap-2">
                             {Object.entries(values as any).map(([id, desc]) => (
                               <span key={id} className="text-[9px] font-mono bg-slate-800/80 px-2 py-1 rounded text-slate-300 border border-slate-700">
                                 <b className="text-emerald-400">{id}</b>: {desc as string}
                               </span>
                             ))}
                           </div>
                         </div>
                       ))}
                     </div>
                   </div>
                 ))}
               </div>
            </div>

            {Object.keys(detectedSchema).length > 0 && (
              <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] shadow-2xl space-y-6">
                 <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">📊 Production Schema Inventory</h3>
                 <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {Object.entries(detectedSchema).map(([table, cols]) => (
                     <div key={table} className="bg-black/40 p-5 rounded-2xl border border-slate-800">
                        <p className="text-[10px] font-black text-emerald-500 uppercase mb-3">{table}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {Array.isArray(cols) ? cols.map(c => (
                            <span key={c} className="text-[8px] font-mono bg-slate-800/50 px-1.5 py-0.5 rounded text-slate-400 border border-slate-700/30">{c}</span>
                          )) : <span className="text-[8px] text-rose-500 italic">Unreadable</span>}
                        </div>
                     </div>
                   ))}
                 </div>
              </div>
            )}
          </div>
        );
      default: return <Dashboard bridgeUrl={bridgeUrl} isOnline={connStatus === 'online'} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} connStatus={connStatus} />
      <main className="flex-1 overflow-hidden flex flex-col relative">
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 md:px-10 bg-slate-950/80 backdrop-blur-xl z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 text-slate-400">☰</button>
            <div className="flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full ${connStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'}`}></span>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">{connStatus === 'online' ? 'Hybrid Protocol Active' : 'Link Offline'}</span>
            </div>
          </div>
          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">OgradyCore v4.4</span>
        </header>
        <div className="flex-1 overflow-hidden relative">{renderContent()}</div>
      </main>
    </div>
  );
};

export default App;
