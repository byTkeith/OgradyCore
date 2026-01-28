import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import { AppSection } from './types';

const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<AppSection>(AppSection.DASHBOARD);
  const [connStatus, setConnStatus] = useState<'testing' | 'online' | 'offline'>('testing');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [bridgeUrl, setBridgeUrl] = useState(localStorage.getItem('og_bridge_url') || 'http://192.168.8.28:8000');

  const checkConnection = async () => {
    setConnStatus('testing');
    setErrorDetail(null);
    const baseUrl = bridgeUrl.replace(/\/$/, "");
    try {
      const res = await fetch(`${baseUrl}/health`, {
        mode: 'cors',
        cache: 'no-cache',
        headers: {
          'ngrok-skip-browser-warning': '69420'
        }
      });
      if (res.ok) {
        setConnStatus('online');
        localStorage.setItem('og_bridge_url', bridgeUrl);
      } else {
        setConnStatus('offline');
        setErrorDetail('The bridge is reachable, but the database connection inside it failed.');
      }
    } catch (err: any) {
      setConnStatus('offline');
      if (window.location.protocol === 'https:' && bridgeUrl.startsWith('http:')) {
        setErrorDetail("MIXED CONTENT BLOCK: You are on an HTTPS site but your bridge is HTTP. You MUST use an ngrok 'https://' URL to fix this.");
      } else {
        setErrorDetail("UNREACHABLE: Ensure main.py is running and your ngrok tunnel is open.");
      }
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const renderContent = () => {
    switch (activeSection) {
      case AppSection.DASHBOARD:
        return <Dashboard />;
      case AppSection.ANALYST_CHAT:
        return <ChatInterface />;
      case AppSection.DATA_EXPLORER:
        return (
          <div className="p-8 md:p-16 max-w-5xl mx-auto space-y-12 overflow-y-auto h-full pb-32 custom-scrollbar">
            <div className="space-y-4 text-center">
              <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center border-2 transition-all duration-1000 ${
                connStatus === 'online' ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.2)]' : 'bg-rose-500/10 border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.1)]'
              }`}>
                <span className="text-3xl">{connStatus === 'online' ? '✅' : '❌'}</span>
              </div>
              <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Bridge Command Center</h2>
              <p className="text-slate-500 font-medium italic">Global Link Status: {connStatus === 'online' ? 'ACTIVE' : 'INACTIVE'}</p>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-[2.5rem] space-y-8 shadow-2xl">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest px-1">Bridge Endpoint (Must be HTTPS for Vercel)</label>
                <div className="flex flex-col md:flex-row gap-4">
                  <input 
                    type="text" 
                    value={bridgeUrl}
                    onChange={(e) => setBridgeUrl(e.target.value)}
                    placeholder="https://xxxx-xxxx.ngrok-free.app"
                    className="flex-1 bg-black/40 border border-slate-700 rounded-2xl px-6 py-4 text-sm font-mono text-emerald-400 focus:outline-none focus:border-emerald-500 transition-all"
                  />
                  <button 
                    onClick={checkConnection}
                    className="px-8 py-4 bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-emerald-500 transition-all shadow-lg"
                  >
                    Save & Test
                  </button>
                </div>
                {errorDetail && (
                  <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl mt-4">
                    <p className="text-rose-400 text-[11px] font-bold uppercase tracking-tight">⚠️ {errorDetail}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] space-y-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-black">1</div>
                <h4 className="text-xs font-black text-white uppercase tracking-widest">Start Bridge</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">Run <code className="text-emerald-500">python main.py</code> in your project folder.</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] space-y-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-black">2</div>
                <h4 className="text-xs font-black text-white uppercase tracking-widest">Tunnel Command</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed italic">If 'ngrok' is not recognized, put ngrok.exe in the folder and run:</p>
                <code className="block bg-black p-2 rounded text-[10px] text-emerald-400">.\ngrok.exe http 8000</code>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] space-y-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-black">3</div>
                <h4 className="text-xs font-black text-white uppercase tracking-widest">Sync Globally</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">Copy the HTTPS URL from the ngrok window and paste it into the box above.</p>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-8 rounded-[2rem] space-y-4">
              <h4 className="text-xs font-black text-emerald-500 uppercase tracking-widest">Vercel Framework Configuration</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                When you import this project into Vercel, use the following settings:
              </p>
              <ul className="text-[11px] text-slate-500 space-y-2 list-disc pl-4">
                <li>Framework Preset: <span className="text-white font-bold italic">Vite</span></li>
                <li>Root Directory: <span className="text-white font-bold italic">./</span></li>
                <li>Environment Variables: Add <span className="text-emerald-500 font-bold">API_KEY</span> with your Google Gemini Key.</li>
              </ul>
            </div>
          </div>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} />
      <main className="flex-1 overflow-hidden flex flex-col relative">
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-10 bg-slate-950/60 backdrop-blur-xl z-20">
          <div className="flex items-center gap-6">
            <div className={`w-2 h-2 rounded-full ${connStatus === 'online' ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`}></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{connStatus.toUpperCase()}</span>
            <span className="text-[10px] font-mono text-slate-500 truncate max-w-[200px]">{bridgeUrl}</span>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
           {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;