
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import { AppSection, AIProvider } from './types';
import { DEFAULT_BRIDGE_URL } from './constants';

const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<AppSection>(AppSection.DASHBOARD);
  const [connStatus, setConnStatus] = useState<'testing' | 'online' | 'offline'>('testing');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [bridgeUrl, setBridgeUrl] = useState(localStorage.getItem('og_bridge_url') || DEFAULT_BRIDGE_URL);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [aiProvider, setAiProvider] = useState<AIProvider>((localStorage.getItem('og_ai_provider') as AIProvider) || 'AUTO');
  const [ollamaUrl, setOllamaUrl] = useState(localStorage.getItem('og_ollama_url') || 'http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState(localStorage.getItem('og_ollama_model') || 'llama3.1:8b');

  const checkConnection = useCallback(async (urlOverride?: string) => {
    const targetUrl = urlOverride || bridgeUrl;
    if (!targetUrl) return setConnStatus('offline');
    setConnStatus('testing');
    const baseUrl = targetUrl.replace(/\/$/, "");
    try {
      const res = await fetch(`${baseUrl}/health`, { mode: 'cors', headers: { 'ngrok-skip-browser-warning': '69420' } });
      const data = await res.json();
      if (res.ok && data.status === 'online') {
        setConnStatus('online');
        localStorage.setItem('og_bridge_url', targetUrl);
      } else {
        setConnStatus('offline');
        setErrorDetail(data.message);
      }
    } catch (err) {
      setConnStatus('offline');
    }
  }, [bridgeUrl]);

  useEffect(() => { checkConnection(); }, [checkConnection]);

  const saveAiSettings = () => {
    localStorage.setItem('og_ai_provider', aiProvider);
    localStorage.setItem('og_ollama_url', ollamaUrl);
    localStorage.setItem('og_ollama_model', ollamaModel);
    window.location.reload();
  };

  const renderContent = () => {
    switch (activeSection) {
      case AppSection.DASHBOARD: return <Dashboard />;
      case AppSection.ANALYST_CHAT: return <ChatInterface />;
      case AppSection.DATA_EXPLORER:
        return (
          <div className="p-8 md:p-16 max-w-5xl mx-auto space-y-12 overflow-y-auto h-full pb-32 custom-scrollbar">
            <div className="text-center">
              <h2 className="text-4xl font-black text-white uppercase tracking-tighter">System Core Settings</h2>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Self-Sufficient Infrastructure Protocol</p>
            </div>
            <div className="grid md:grid-cols-2 gap-10">
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl space-y-6">
                <h3 className="text-xs font-black text-emerald-500 uppercase tracking-widest">SQL Bridge Endpoint</h3>
                <input type="text" value={bridgeUrl} onChange={(e) => setBridgeUrl(e.target.value)} className="w-full bg-black/40 border border-slate-700 rounded-xl px-5 py-4 text-sm font-mono text-emerald-400 focus:outline-none" />
                <button onClick={() => checkConnection(bridgeUrl)} className="w-full py-4 bg-emerald-600 text-white font-black uppercase text-[10px] rounded-xl">Re-Connect Bridge</button>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl space-y-6">
                <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest">Hybrid AI Provider</h3>
                <div className="flex gap-2 p-1 bg-black/40 rounded-xl">
                  {['GEMINI', 'OLLAMA', 'AUTO'].map((p) => (
                    <button key={p} onClick={() => setAiProvider(p as AIProvider)} className={`flex-1 py-3 text-[8px] font-black uppercase rounded-lg transition-all ${aiProvider === p ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                      {p === 'AUTO' ? 'Self-Sufficient (Hybrid)' : p}
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Server Host</label>
                  <input type="text" value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} className="w-full bg-black/40 border border-slate-700 rounded-xl px-5 py-3 text-sm font-mono text-blue-400 focus:outline-none" placeholder="http://localhost:11434" />
                </div>
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Active Brain (Model)</label>
                  <input type="text" value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)} className="w-full bg-black/40 border border-slate-700 rounded-xl px-5 py-3 text-sm font-mono text-blue-400 focus:outline-none" placeholder="e.g. deepseek-r1:8b" />
                </div>
                
                <div className="bg-black/20 p-4 rounded-xl border border-slate-800/50">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Recommended Commands:</p>
                  <div className="space-y-2">
                    {[
                      { tag: 'deepseek-r1:8b', desc: 'Best Logic & Reasoning' },
                      { tag: 'llama3.1:8b', desc: 'Reliable Standard' },
                      { tag: 'gemma2:9b', desc: 'Google Open Model' }
                    ].map(m => (
                      <button 
                        key={m.tag}
                        onClick={() => setOllamaModel(m.tag)}
                        className="w-full flex items-center justify-between group px-2 py-1 rounded hover:bg-white/5 transition-all"
                      >
                        <code className="text-[10px] text-emerald-500 font-bold">ollama run {m.tag}</code>
                        <span className="text-[9px] text-slate-600 group-hover:text-slate-400 transition-all italic">{m.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={saveAiSettings} className="w-full py-4 bg-blue-600 text-white font-black uppercase text-[10px] rounded-xl hover:bg-blue-500 shadow-xl">Commit Hybrid Config</button>
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
              <span className={`w-2 h-2 rounded-full ${connStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500'}`}></span>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{aiProvider} INTEL ACTIVE</span>
            </div>
          </div>
          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">OgradyCore v2.6 Hyper-Link</span>
        </header>
        <div className="flex-1 overflow-hidden relative">{renderContent()}</div>
      </main>
    </div>
  );
};

export default App;
