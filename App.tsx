
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
        cache: 'no-cache'
      });
      if (res.ok) {
        setConnStatus('online');
        localStorage.setItem('og_bridge_url', bridgeUrl);
      } else {
        setConnStatus('offline');
        setErrorDetail('Bridge responded, but database check failed.');
      }
    } catch (err: any) {
      setConnStatus('offline');
      if (window.location.protocol === 'https:' && bridgeUrl.startsWith('http:')) {
        setErrorDetail("Security Block: You are using HTTPS but your Bridge is HTTP. Browsers block this 'Mixed Content'. Please use an ngrok HTTPS URL for the bridge.");
      } else {
        setErrorDetail(err.message || "Connection refused. Is main.py running?");
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
          <div className="p-8 md:p-16 max-w-4xl mx-auto space-y-12 overflow-y-auto h-full pb-32">
            <div className="space-y-4 text-center">
              <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center border-2 transition-all duration-1000 ${
                connStatus === 'online' ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.2)]' : 'bg-rose-500/10 border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.1)]'
              }`}>
                <span className="text-3xl">{connStatus === 'online' ? '✅' : '❌'}</span>
              </div>
              <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Bridge Configuration</h2>
              <p className="text-slate-500 font-medium italic">Current status: {connStatus.toUpperCase()}</p>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-[2.5rem] space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest px-1">Active Bridge Endpoint</label>
                <div className="flex gap-4">
                  <input 
                    type="text" 
                    value={bridgeUrl}
                    onChange={(e) => setBridgeUrl(e.target.value)}
                    placeholder="e.g. http://192.168.8.28:8000 or https://xyz.ngrok.io"
                    className="flex-1 bg-black/40 border border-slate-700 rounded-2xl px-6 py-4 text-sm font-mono text-emerald-400 focus:outline-none focus:border-emerald-500 transition-all"
                  />
                  <button 
                    onClick={checkConnection}
                    className="px-8 py-4 bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-emerald-500 transition-all shadow-lg"
                  >
                    Update & Test
                  </button>
                </div>
              </div>

              {errorDetail && (
                <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-2xl">
                  <p className="text-rose-400 text-sm font-bold flex items-center gap-2">
                    <span>⚠️</span> Diagnostic: {errorDetail}
                  </p>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] space-y-4">
                <h4 className="text-xs font-black text-white uppercase tracking-widest">Internal (Same Wi-Fi)</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Use your direct local IP if you are testing locally on the same network.
                </p>
                <code className="block bg-black/30 p-3 rounded-lg text-emerald-500/80 text-[10px]">http://192.168.8.28:8000</code>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] space-y-4">
                <h4 className="text-xs font-black text-white uppercase tracking-widest">External (Vercel/Global)</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Use <strong>ngrok</strong> to generate a secure HTTPS URL that works anywhere in the world.
                </p>
                <code className="block bg-black/30 p-3 rounded-lg text-emerald-500/80 text-[10px]">https://your-tunnel.ngrok-free.app</code>
              </div>
            </div>
          </div>
        );
      case AppSection.REPORTS:
        return (
          <div className="p-16 text-center max-w-2xl mx-auto space-y-6">
            <div className="text-5xl mb-6">📑</div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Executive Reports</h2>
            <p className="text-slate-500 font-medium leading-relaxed">System is ready for automated reporting. Select a timeframe to begin generation.</p>
          </div>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} />
      
      <main className="flex-1 overflow-hidden flex flex-col relative bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-emerald-950/20 via-slate-950 to-slate-950">
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-10 bg-slate-950/60 backdrop-blur-xl z-20">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${connStatus === 'online' ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`}></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {connStatus === 'online' ? 'BRIDGE LIVE' : 'BRIDGE OFFLINE'}
              </span>
            </div>
            <div className="h-4 w-px bg-slate-800"></div>
            <span className="text-[10px] font-mono text-slate-500 tracking-tighter truncate max-w-[200px]">{bridgeUrl}</span>
          </div>
          
          <div className="flex items-center gap-8">
            <div className="text-right">
              <p className="text-xs font-black text-white uppercase tracking-tighter">OgradrayCore</p>
              <p className="text-[9px] text-emerald-500 font-black uppercase tracking-[0.1em] mt-0.5 tracking-tighter">Administrator</p>
            </div>
            <div className="h-8 w-px bg-slate-800"></div>
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center font-black text-white shadow-lg">OC</div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden relative">
           {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
