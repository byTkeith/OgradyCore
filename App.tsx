
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import { AppSection } from './types';

const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<AppSection>(AppSection.DASHBOARD);
  const [connStatus, setConnStatus] = useState<'testing' | 'online' | 'offline'>('testing');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [bridgeUrl, setBridgeUrl] = useState(localStorage.getItem('og_bridge_url') || '');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const checkConnection = useCallback(async (urlOverride?: string) => {
    const targetUrl = urlOverride || bridgeUrl;
    if (!targetUrl) {
      setConnStatus('offline');
      return;
    }
    
    setConnStatus('testing');
    setErrorDetail(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const baseUrl = targetUrl.replace(/\/$/, "");
    try {
      const res = await fetch(`${baseUrl}/health`, {
        mode: 'cors',
        headers: { 'ngrok-skip-browser-warning': '69420' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      
      if (res.ok && data.status === 'online') {
        setConnStatus('online');
        localStorage.setItem('og_bridge_url', targetUrl);
      } else {
        setConnStatus('offline');
        setErrorDetail(data.message || 'Bridge responded but reported an internal error.');
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      setConnStatus('offline');
      if (err.name === 'AbortError') {
        setErrorDetail("TIMEOUT: The bridge didn't respond in time. Ensure the ngrok tunnel is active and stable.");
      } else {
        setErrorDetail(`UNREACHABLE: Failed to connect to ${targetUrl}. Please verify the URL and your local bridge status.`);
      }
    }
  }, [bridgeUrl]);

  useEffect(() => {
    if (bridgeUrl) {
      checkConnection();
    } else {
      setConnStatus('offline');
    }
  }, [checkConnection]);

  const handleUpdateBridge = (newUrl: string) => {
    setBridgeUrl(newUrl);
    checkConnection(newUrl);
  };

  const renderContent = () => {
    switch (activeSection) {
      case AppSection.DASHBOARD:
        return <Dashboard />;
      case AppSection.ANALYST_CHAT:
        return <ChatInterface />;
      case AppSection.DATA_EXPLORER:
        return (
          <div className="p-4 md:p-16 max-w-4xl mx-auto space-y-8 md:space-y-10 overflow-y-auto h-full pb-32 custom-scrollbar">
            <div className="text-center space-y-4">
              <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center border-2 transition-all ${
                connStatus === 'online' ? 'bg-emerald-500/10 border-emerald-500' : 
                connStatus === 'testing' ? 'bg-amber-500/10 border-amber-500 animate-pulse' : 
                'bg-rose-500/10 border-rose-500'
              }`}>
                <span className="text-2xl">
                  {connStatus === 'online' ? '✅' : connStatus === 'testing' ? '⏳' : '⛓️'}
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter">Bridge Configuration</h2>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                Status: <span className={connStatus === 'online' ? 'text-emerald-500' : 'text-slate-300'}>{connStatus}</span>
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 md:p-10 rounded-[2rem] space-y-6 shadow-2xl">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block">Ngrok HTTPS URL</label>
                <div className="flex flex-col gap-3">
                  <input 
                    type="text" 
                    value={bridgeUrl}
                    onChange={(e) => setBridgeUrl(e.target.value)}
                    placeholder="https://xxxx.ngrok-free.app"
                    className="w-full bg-black/40 border border-slate-700 rounded-xl px-5 py-4 text-sm font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => handleUpdateBridge(bridgeUrl)} 
                      disabled={connStatus === 'testing'}
                      className="py-4 bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-emerald-500 transition-all disabled:opacity-50"
                    >
                      {connStatus === 'testing' ? 'Verifying...' : 'Validate Link'}
                    </button>
                    <button 
                      onClick={() => { setConnStatus('offline'); setErrorDetail(null); }} 
                      className="py-4 bg-slate-800 text-slate-400 font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-slate-700 transition-all"
                    >
                      Clear State
                    </button>
                  </div>
                </div>
              </div>
              
              {errorDetail && (
                <div className="bg-rose-500/5 border border-rose-500/20 p-4 rounded-xl space-y-3">
                  <p className="text-rose-400 text-[10px] font-black uppercase">Diagnostics Trace:</p>
                  <p className="text-[10px] text-slate-400 font-mono leading-relaxed break-all">
                    {errorDetail}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans select-none">
      <Sidebar 
        activeSection={activeSection} 
        setActiveSection={setActiveSection} 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
      />
      
      <main className="flex-1 overflow-hidden flex flex-col relative">
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-4 md:px-10 bg-slate-950/80 backdrop-blur-xl z-30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 text-slate-400 hover:text-white"
            >
              <span className="text-2xl leading-none">☰</span>
            </button>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${connStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : connStatus === 'testing' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500 shadow-[0_0_8px_#ef4444]'}`}></div>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] truncate max-w-[60px] md:max-w-none">{connStatus}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">
             <span className="hidden xs:inline">OgradyCore v2.5</span>
             <button 
                onClick={() => checkConnection()} 
                className="text-emerald-500/70 hover:text-emerald-500 bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10 transition-all"
                title="Sync Connection"
              >
               ↻ Sync
             </button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative">
           {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
