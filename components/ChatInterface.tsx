
import React, { useState, useRef, useEffect } from 'react';
import { analyzeQuery, getAnalystInsight } from '../services/geminiService';
import { QueryResult, AnalystInsight } from '../types';
import Visualizer from './Visualizer';
import InsightPanel from './InsightPanel';

const ChatInterface: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ query: string; result: QueryResult; insight: AnalystInsight; engine: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [results, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    setError(null);
    const currentQuery = query;
    setQuery('');
    setIsLoading(true);

    try {
      const qResult = await analyzeQuery(currentQuery);
      const insight = await getAnalystInsight(qResult);
      setResults(prev => [...prev, { query: currentQuery, result: qResult, insight, engine: qResult.engine }]);
    } catch (err: any) {
      console.error("Self-Sufficient Intelligence Error:", err);
      if (err.message === "GEMINI_QUOTA_EXCEEDED_AND_OLLAMA_OFFLINE") {
        setError("Dual Intelligence failure: Gemini quota reached and local Ollama server is offline. Please start Ollama locally.");
      } else if (err.message === "OLLAMA_OFFLINE") {
        setError("Local Intelligence (Ollama) unreachable. Check your settings or server status.");
      } else {
        setError("Intelligence Link Interrupted. Ensure your bridge is active.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto md:px-6 md:py-8 overflow-hidden bg-slate-950">
      <div className="flex items-center justify-between px-4 mb-4">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tighter">AI Executive Analyst</h2>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Hybrid Gemini/Ollama Intelligence</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-16 custom-scrollbar print:overflow-visible">
        {results.length === 0 && !isLoading && !error && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6">
            <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 shadow-2xl">
              <span className="text-4xl">⚡</span>
            </div>
            <div className="max-w-md">
              <p className="text-2xl font-black text-white uppercase tracking-tight">OgradyCore Hybrid Core</p>
              <p className="text-slate-500 mt-4 text-sm font-medium leading-relaxed italic border-t border-slate-800 pt-4">
                "Show me product sales for the last 30 days grouped by operator."
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-10 rounded-[2.5rem] max-w-2xl mx-auto text-center animate-in fade-in slide-in-from-top-4">
             <span className="text-4xl block mb-6">⚙️</span>
             <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Self-Sufficiency Alert</h3>
             <p className="text-slate-400 text-sm leading-relaxed mb-6">{error}</p>
             <button onClick={() => setError(null)} className="text-[10px] font-black uppercase tracking-widest text-emerald-500 border border-emerald-500/20 px-6 py-3 rounded-xl hover:bg-emerald-500/10 transition-all">Retry Analysis</button>
          </div>
        )}

        {results.map((item, idx) => (
          <div key={idx} className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-end">
              <div className="bg-slate-800 border border-slate-700 text-white px-8 py-5 rounded-[2rem] rounded-tr-none max-w-[85%] shadow-2xl">
                <p className="text-base font-bold">{item.query}</p>
              </div>
            </div>
            
            <div className="space-y-10 md:pl-12">
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-xl relative">
                <div className={`absolute top-0 right-10 -translate-y-1/2 px-4 py-1 rounded-full border text-[9px] font-black uppercase ${item.engine === 'GEMINI' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-blue-500/20 border-blue-500 text-blue-400'}`}>
                  Source: {item.engine}
                </div>
                <code className="text-[12px] block bg-black/40 p-6 rounded-2xl text-emerald-400 overflow-x-auto mb-6 font-mono border border-slate-800">{item.result.sql}</code>
                <p className="text-sm text-slate-300 italic font-medium">Logic: {item.result.explanation}</p>
              </div>
              <Visualizer result={item.result} />
              <InsightPanel insight={item.insight} />
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex flex-col gap-6 animate-pulse md:ml-12">
            <div className="h-32 bg-slate-900/50 rounded-[2.5rem] w-full border border-slate-800"></div>
            <div className="h-[400px] bg-slate-900/50 rounded-[2.5rem] w-full border border-slate-800"></div>
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-950/90 backdrop-blur-xl border-t border-slate-800/50 print:hidden">
        <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto">
          <input 
            type="text" 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            placeholder="Query fiscal data using natural language..." 
            className="w-full bg-slate-900 border border-slate-800 text-white pl-8 pr-32 py-6 rounded-[2.5rem] focus:outline-none focus:border-emerald-600 transition-all font-medium text-lg" 
          />
          <button 
            type="submit" 
            disabled={isLoading || !query.trim()} 
            className="absolute right-3 top-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-8 py-4 rounded-full transition-all font-black text-[10px] uppercase tracking-widest shadow-xl"
          >
            {isLoading ? 'ANALYZING...' : 'RUN QUERY'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
