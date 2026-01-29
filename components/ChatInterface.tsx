
import React, { useState, useRef, useEffect } from 'react';
import { analyzeQuery, getAnalystInsight } from '../services/geminiService';
import { QueryResult, AnalystInsight } from '../types';
import Visualizer from './Visualizer';
import InsightPanel from './InsightPanel';

const ChatInterface: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ query: string; result: QueryResult; insight: AnalystInsight }[]>([]);
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
      setResults(prev => [...prev, { query: currentQuery, result: qResult, insight }]);
    } catch (err: any) {
      console.error("AI Chat Error:", err);
      if (err.message === "QUOTA_EXCEEDED") {
        setError("API Quota Reached: The intelligent core is currently resting. Core BI data is still accessible via the Dashboard.");
      } else {
        setError("Connectivity Error: Could not reach the Analyst Service.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto md:px-6 md:py-8 overflow-hidden bg-slate-950">
      <div className="flex items-center justify-between px-4 mb-4 print:hidden">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tighter">AI Executive Analyst</h2>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Natural Language Data Exploration</p>
        </div>
        {results.length > 0 && (
          <button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black px-4 py-2 rounded-xl shadow-lg">🖨️ Export Transcript</button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-16 custom-scrollbar print:overflow-visible">
        {results.length === 0 && !isLoading && !error && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6">
            <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 shadow-2xl"><span className="text-4xl">🤖</span></div>
            <div className="max-w-md">
              <p className="text-2xl font-black text-white tracking-tight leading-none">Intelligence Hub 2.6</p>
              <p className="text-slate-500 mt-4 text-sm font-medium leading-relaxed italic">"What are our top 10 categories by margin this month?"</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-8 rounded-[2rem] max-w-2xl mx-auto text-center animate-in fade-in slide-in-from-top-4">
             <span className="text-4xl block mb-4">💤</span>
             <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Service Suspended</h3>
             <p className="text-slate-400 text-sm leading-relaxed">{error}</p>
             <div className="mt-6 flex justify-center gap-4">
               <button onClick={() => setError(null)} className="text-[9px] font-black uppercase tracking-widest text-emerald-500 border border-emerald-500/20 px-4 py-2 rounded-lg hover:bg-emerald-500/5 transition-all">Try Again</button>
             </div>
          </div>
        )}

        {results.map((item, idx) => (
          <div key={idx} className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-end"><div className="bg-slate-800 border border-slate-700 text-white px-6 py-4 rounded-3xl rounded-tr-none max-w-[85%] shadow-2xl"><p className="text-base font-bold">{item.query}</p></div></div>
            <div className="space-y-10 md:pl-12">
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] shadow-xl">
                <code className="text-[12px] block bg-black/40 p-5 rounded-2xl text-emerald-400 overflow-x-auto mb-5 font-mono border border-slate-800">{item.result.sql}</code>
                <p className="text-sm text-slate-300 italic font-medium">{item.result.explanation}</p>
              </div>
              <Visualizer result={item.result} />
              <InsightPanel insight={item.insight} />
            </div>
          </div>
        ))}

        {isLoading && <div className="h-32 bg-slate-900/50 rounded-3xl w-full border border-slate-800 animate-pulse md:ml-12"></div>}
      </div>

      <div className="p-4 bg-slate-950/90 backdrop-blur-xl border-t border-slate-800/50 print:hidden">
        <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto">
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Query live records via SQL intelligence..." className="w-full bg-slate-900 border border-slate-800 text-white pl-8 pr-28 py-6 rounded-[2rem] focus:outline-none focus:border-emerald-600 transition-all font-medium" />
          <button type="submit" disabled={isLoading || !query.trim()} className="absolute right-3 top-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-6 py-4 rounded-full transition-all font-black text-[10px] uppercase tracking-widest shadow-xl">{isLoading ? '...' : 'QUERY'}</button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
