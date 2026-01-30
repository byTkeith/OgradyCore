
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import { AppSection, AIProvider } from './types';
import { DEFAULT_BRIDGE_URL } from './constants';

const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<AppSection>(AppSection.DASHBOARD);
  const [connStatus, setConnStatus] = useState<'testing' | 'online' | 'offline'>('testing');
  const [ollamaStatus, setOllamaStatus] = useState<'idle' | 'online' | 'offline'>('idle');
  const [bridgeUrl, setBridgeUrl] = useState(localStorage.getItem('og_bridge_url') || DEFAULT_BRIDGE_URL);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [aiProvider, setAiProvider] = useState<AIProvider>((localStorage.getItem('og_ai_provider') as AIProvider) || 'AUTO');
  const [ollamaModel, setOllamaModel] = useState(localStorage.getItem('og_ollama_model') || 'deepseek-r1:8b');

  const checkConnection = useCallback(async (urlOverride?: string) => {
    const targetUrl = urlOverride || bridgeUrl;
    if (!targetUrl) return setConnStatus('offline');
    setConnStatus('testing');
    const baseUrl = targetUrl.replace(/\/$/, "");
    try {
      const res = await fetch(`${baseUrl}/health`, { 
          mode: 'cors', 
          headers: { 'ngrok-skip-browser-warning': '69420' } 
      });
      const data = await res.json();
      if (res.ok && data.status === 'online') {
        setConnStatus('online');
        setOllamaStatus(data.ollama_local === 'detected' ? 'online' : 'offline');
        localStorage.setItem('og_bridge_url', targetUrl);
      } else {
        setConnStatus('offline');
        setOllamaStatus('offline');
      }
    } catch (err) {
      setConnStatus('offline');
      setOllamaStatus('offline');
    }
  }, [bridgeUrl]);

  useEffect(() => { checkConnection(); }, [checkConnection]);

  const saveAiSettings = () => {
    localStorage.setItem('og_ai_provider', aiProvider);
    localStorage.setItem('og_ollama_model', ollamaModel);
    window.location.reload();
  };

  const renderContent = () => {
    switch (activeSection) {
      case AppSection.DASHBOARD: return <Dashboard />;
      case AppSection.ANALYST_CHAT: return <ChatInterface />;
      case AppSection.DATA_EXPLORER:
        return (
          <div className="p-8 md:p-16 max-w-6xl mx-auto space-y-12 overflow-y-auto h-full pb-32 custom-scrollbar">
            <div className="text-center">
              <h2 className="text-4xl font-black text-white uppercase tracking-tighter">System Core Settings</h2>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Hybrid Infrastructure Protocol</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl space-y-6">
                <h3 className="text-xs font-black text-emerald-500 uppercase tracking-widest flex items-center justify-between">
                  Primary Bridge Link
                  <span className={`w-2 h-2 rounded-full ${connStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500'}`}></span>
                </h3>
                <input type="text" value={bridgeUrl} onChange={(e) => setBridgeUrl(e.target.value)} className="w-full bg-black/40 border border-slate-700 rounded-xl px-5 py-4 text-sm font-mono text-emerald-400 focus:outline-none" />
                <button onClick={() => checkConnection(bridgeUrl)} className="w-full py-4 bg-emerald-600 text-white font-black uppercase text-[10px] rounded-xl hover:bg-emerald-500 transition-all">Sync Connection</button>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl space-y-6">
                <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest flex items-center justify-between">
                  Local AI Intelligence
                  <span className={`w-2 h-2 rounded-full ${ollamaStatus === 'online' ? 'bg-blue-500 shadow-[0_0_8px_#3b82f6]' : 'bg-rose-500'}`}></span>
                </h3>
                <div className="flex gap-2 p-1 bg-black/40 rounded-xl">
                  {['GEMINI', 'OLLAMA', 'AUTO'].map((p) => (
                    <button key={p} onClick={() => setAiProvider(p as AIProvider)} className={`flex-1 py-3 text-[8px] font-black uppercase rounded-lg transition-all ${aiProvider === p ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                      {p}
                    </button>
                  ))}
                </div>
                <input type="text" value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)} className="w-full bg-black/40 border border-slate-700 rounded-xl px-5 py-3 text-sm font-mono text-blue-400 focus:outline-none" />
                <button onClick={saveAiSettings} className="w-full py-4 bg-blue-600 text-white font-black uppercase text-[10px] rounded-xl hover:bg-blue-500 shadow-xl transition-all">Save Config</button>
              </div>
            </div>

            {/* OLLAMA SETUP GUIDE */}
            <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] shadow-2xl space-y-8">
               <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center text-3xl border border-blue-500/20">🧠</div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter">Ollama AI Activation Guide</h3>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Optimized for DeepSeek R1 Reasoning</p>
                  </div>
               </div>

               <div className="grid md:grid-cols-3 gap-6">
                 <div className="bg-black/40 p-6 rounded-2xl border border-slate-800 space-y-3">
                    <span className="text-[10px] font-black text-blue-400 uppercase">Step 1: Install</span>
                    <p className="text-xs text-slate-300">Download Ollama for Windows from <a href="https://ollama.com/download" target="_blank" className="text-blue-500 underline">ollama.com</a> and run the installer.</p>
                 </div>
                 <div className="bg-black/40 p-6 rounded-2xl border border-slate-800 space-y-3">
                    <span className="text-[10px] font-black text-blue-400 uppercase">Step 2: Pull Model</span>
                    <p className="text-xs text-slate-300">Open CMD and run:</p>
                    <code className="block bg-slate-950 p-2 rounded text-[10px] text-emerald-400">ollama pull deepseek-r1:8b</code>
                    <p className="text-[9px] text-amber-500 font-bold mt-2">TIP: Restart VS Code to refresh the terminal path!</p>
                 </div>
                 <div className="bg-black/40 p-6 rounded-2xl border border-slate-800 space-y-3">
                    <span className="text-[10px] font-black text-blue-400 uppercase">Step 3: Verify</span>
                    <p className="text-xs text-slate-300">Once it says "success", refresh this page. The blue status light should turn on.</p>
                 </div>
               </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-12 opacity-5 text-8xl pointer-events-none">🖥️</div>
               <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-4">Python Terminal Setup</h3>
               <div className="grid md:grid-cols-2 gap-8 mt-6">
                 <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Install dependencies</p>
                    <code className="block bg-black/60 p-4 rounded-2xl border border-slate-800 text-emerald-400 text-xs font-mono">python -m pip install fastapi uvicorn pyodbc pandas httpx</code>
                 </div>
                 <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Start the Bridge</p>
                    <code className="block bg-black/60 p-4 rounded-2xl border border-slate-800 text-emerald-400 text-xs font-mono">python main.py</code>
                 </div>
               </div>
            </div>
          </div>
        );
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      <main className="flex-1 overflow-hidden flex flex-col relative">
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 md:px-10 bg-slate-950/80 backdrop-blur-xl z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 text-slate-400">☰</button>
            <div className="flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full ${connStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'}`}></span>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{aiProvider} INTEL ACTIVE</span>
            </div>
          </div>
          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">OgradyCore v2.9</span>
        </header>
        <div className="flex-1 overflow-hidden relative">{renderContent()}</div>
      </main>
    </div>
  );
};

export default App;
