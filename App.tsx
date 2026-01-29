
import React, { useState, useEffect } from 'react';
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

  const checkConnection = async (urlOverride?: string) => {
    const targetUrl = urlOverride || bridgeUrl;
    if (!targetUrl) {
      setConnStatus('offline');
      return;
    }
    
    setConnStatus('testing');
    setErrorDetail(null);

    // Timeout mechanism to prevent infinite "testing" state
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

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
        setErrorDetail("TIMEOUT: The bridge didn't respond in time. Is the ngrok tunnel active?");
      } else {
        setErrorDetail(`UNREACHABLE: Failed to connect to ${targetUrl}. Check your internet and ngrok status.`);
      }
    }
  };

  useEffect(() => {
    if (bridgeUrl) {
      checkConnection();
    } else {
      setConnStatus('offline');
    }
  }, []);

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
          <div className="p-6 md:p-16 max-w-4xl mx-auto space-y-10 overflow-y-auto h-full pb-32 custom-scrollbar">
            <div className="text-center space-y-4">
              <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center border-2 transition-all ${
                connStatus === 'online' ? 'bg-emerald-500/10 border-emerald-500' : 'bg-rose-500/10 border-rose-500'
              }`}>
                <span className="text-2xl">{connStatus === 'online' ? '✅' : '⛓️'}</span>
              </div>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Bridge Configuration</h2>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Status: {connStatus}</p>
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
                  <button 
                    onClick={() => handleUpdateBridge(bridgeUrl)} 
                    disabled={connStatus === 'testing'}
                    className="w-full py-4 bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-emerald-500 transition-all disabled:opacity-50"
                  >
                    {connStatus === 'testing' ? 'Verifying...' : 'Validate Link'}
                  </button>
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
        {/* Top Header Bar */}
        <header className="h-16 md:h-14 border-b border-slate-800 flex items-center justify-between px-6 md:px-10 bg-slate-950/80 backdrop-blur-xl z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 text-slate-400 hover:text-white"
            >
              <span className="text-2xl">☰</span>
            </button>
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${connStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 animate-pulse'}`}></div>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">{connStatus}</span>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-4 text-[10px] font-bold text-slate-600">
             <span>OgradyCore v2.5</span>
             <span className="h-1 w-1 bg-slate-800 rounded-full"></span>
             <span>Ultisales Cloud</span>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative">
           {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
