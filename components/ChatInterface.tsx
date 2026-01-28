
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
      alert("Connectivity Error: Could not reach OgradyCore Analyst Service.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">OgradyCore Analyst</h2>
          <p className="text-slate-500 text-sm mt-1 font-medium italic">Powered by Real-Time SQL Inference engine</p>
        </div>
        <div className="flex items-center gap-3 bg-slate-900/50 px-4 py-2 rounded-xl border border-slate-800">
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"></div>
           <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">MSSQL Connected</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto mb-8 space-y-16 pr-4 custom-scrollbar">
        {results.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
            <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
              <span className="text-4xl text-emerald-400">🧠</span>
            </div>
            <div className="max-w-md">
              <p className="text-xl font-bold text-slate-200">How can OgradyCore assist you today?</p>
              <p className="text-slate-500 mt-2 text-sm">Ask about sales drops, client trends, or stock levels. I will translate your request into T-SQL automatically.</p>
            </div>
          </div>
        )}

        {results.map((item, idx) => (
          <div key={idx} className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="flex justify-end">
              <div className="bg-slate-800 border border-slate-700 text-white px-6 py-4 rounded-3xl rounded-tr-none max-w-xl shadow-xl">
                <p className="text-sm font-semibold text-emerald-400 mb-1">PROMPT:</p>
                <p className="text-sm">{item.query}</p>
              </div>
            </div>

            <div className="flex justify-start gap-6">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center border border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)] text-lg shrink-0">🟢</div>
              <div className="space-y-6 flex-1">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">SQL Execution Trace</p>
                    <button className="text-[10px] text-slate-500 hover:text-white transition-colors uppercase font-bold">Copy SQL</button>
                  </div>
                  <code className="text-[13px] block bg-black/50 p-4 rounded-xl text-emerald-300 overflow-x-auto mb-4 font-mono leading-relaxed border border-slate-800">
                    {item.result.sql}
                  </code>
                  <p className="text-sm text-slate-400 leading-relaxed font-medium italic">{item.result.explanation}</p>
                </div>
                
                <Visualizer result={item.result} />
                <InsightPanel insight={item.insight} />
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start gap-6 animate-pulse">
            <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center border border-slate-700 text-xs text-slate-600 italic">...</div>
            <div className="space-y-6 flex-1">
              <div className="h-32 bg-slate-900/50 rounded-3xl w-full border border-slate-800"></div>
              <div className="h-80 bg-slate-900/50 rounded-3xl w-full border border-slate-800"></div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="relative mt-auto group">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type your business inquiry (e.g. 'Compare stock vs sales for last month')..."
          className="w-full bg-slate-900 border-2 border-slate-800 text-white pl-8 pr-32 py-5 rounded-[2rem] focus:outline-none focus:border-emerald-600 transition-all shadow-2xl placeholder-slate-600 text-sm font-medium"
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="absolute right-4 top-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-full transition-all duration-300 font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-900/40"
        >
          {isLoading ? 'Processing' : 'Analyze'}
        </button>
      </form>
    </div>
  );
};

export default ChatInterface;
