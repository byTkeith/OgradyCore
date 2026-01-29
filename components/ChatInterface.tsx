
import React, { useState, useRef, useEffect } from 'react';
import { analyzeQuery, getAnalystInsight } from '../services/geminiService';
import { QueryResult, AnalystInsight } from '../types';
import Visualizer from './Visualizer';
import InsightPanel from './InsightPanel';

const ChatInterface: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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

    const currentQuery = query;
    setQuery('');
    setIsLoading(true);

    try {
      const qResult = await analyzeQuery(currentQuery);
      const insight = await getAnalystInsight(qResult);
      setResults(prev => [...prev, { query: currentQuery, result: qResult, insight }]);
    } catch (error) {
      console.error("AI Query Error:", error);
      alert("Intelligence Link Error: Could not reach OgradyCore Analyst.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto md:px-6 md:py-8 overflow-hidden bg-slate-950">
      {/* Header with Print Control */}
      <div className="flex items-center justify-between px-4 mb-4 print:hidden">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tighter">AI Executive Analyst</h2>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Natural Language to SQL Insight Engine</p>
        </div>
        {results.length > 0 && (
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg"
          >
            🖨️ Export Transcript
          </button>
        )}
      </div>

      {/* Scrollable Chat History */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-16 custom-scrollbar print:overflow-visible print:h-auto">
        {results.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 p-4 print:hidden">
            <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
              <span className="text-4xl text-emerald-400">📊</span>
            </div>
            <div className="max-w-md">
              <p className="text-2xl font-black text-white tracking-tight">OgradyCore Analyst v2.6</p>
              <p className="text-slate-500 mt-2 text-sm font-medium leading-relaxed">
                Connect directly to Ultisales records using natural language.<br/>
                <span className="text-emerald-500/50 italic">"How did sales this year (2026) compare to last year (2025)?"</span>
              </p>
            </div>
          </div>
        )}

        {results.map((item, idx) => (
          <div key={idx} className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 print:break-inside-avoid print:py-10 print:border-b print:border-slate-300">
            {/* User Prompt */}
            <div className="flex justify-end print:justify-start">
              <div className="bg-slate-800 border border-slate-700 text-white px-6 py-4 rounded-3xl rounded-tr-none max-w-[85%] md:max-w-xl shadow-2xl print:bg-slate-50 print:text-black print:border-slate-300 print:shadow-none">
                <p className="text-[9px] font-black text-emerald-500 mb-2 uppercase tracking-widest print:text-slate-500">Business Inquiry Prompt</p>
                <p className="text-base font-bold leading-snug">{item.query}</p>
              </div>
            </div>

            {/* AI Response Output */}
            <div className="flex flex-col gap-8">
              <div className="flex items-center gap-3 print:hidden">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center border border-emerald-400 shadow-[0_0_15px_#10b981] text-sm font-black text-white">OG</div>
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Operational Intelligence Response</span>
              </div>
              
              <div className="space-y-10 pl-2 md:pl-12 print:pl-0">
                {/* SQL and Logic Block */}
                <div className="bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-[2rem] shadow-xl print:bg-white print:text-black print:border-slate-300">
                  <p className="text-[9px] font-black text-emerald-500 uppercase mb-4 tracking-widest print:text-slate-500">SQL Data retrieval (2026 Context)</p>
                  <code className="text-[12px] block bg-black/40 p-5 rounded-2xl text-emerald-400 overflow-x-auto mb-5 font-mono leading-relaxed border border-slate-800 print:bg-slate-50 print:text-slate-800 print:border-slate-200">
                    {item.result.sql}
                  </code>
                  <div className="flex items-start gap-4">
                    <span className="text-emerald-500 text-xl">ℹ️</span>
                    <p className="text-sm text-slate-300 leading-relaxed font-medium italic print:text-slate-600">{item.result.explanation}</p>
                  </div>
                </div>
                
                {/* Visualization and Insight Panels */}
                <Visualizer result={item.result} />
                <InsightPanel insight={item.insight} />
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex flex-col gap-6 animate-pulse pl-12 print:hidden">
            <div className="h-32 bg-slate-900/50 rounded-3xl w-full border border-slate-800"></div>
            <div className="h-[400px] bg-slate-900/50 rounded-3xl w-full border border-slate-800"></div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Form */}
      <div className="p-4 bg-slate-950/90 backdrop-blur-xl border-t border-slate-800/50 print:hidden">
        <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Query fiscal 2026 dataset..."
            className="w-full bg-slate-900 border border-slate-800 text-white pl-8 pr-28 py-5 md:py-6 rounded-[2rem] focus:outline-none focus:border-emerald-600 transition-all text-base font-medium placeholder-slate-600 shadow-3xl"
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="absolute right-3 top-3 md:right-4 md:top-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-6 py-3 rounded-full transition-all font-black text-[10px] uppercase tracking-widest shadow-xl"
          >
            {isLoading ? 'ANALYZING...' : 'RUN QUERY'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
