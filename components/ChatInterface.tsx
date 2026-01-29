
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
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto md:px-6 md:py-8 overflow-hidden">
      {/* Scrollable Chat History */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-12 custom-scrollbar">
        {results.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 p-4">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
              <span className="text-3xl md:text-4xl text-emerald-400">🧠</span>
            </div>
            <div className="max-w-xs md:max-w-md">
              <p className="text-xl md:text-2xl font-black text-white tracking-tight">Ogrady Analyst</p>
              <p className="text-slate-500 mt-2 text-xs md:text-sm font-medium leading-relaxed">
                "Show me top 10 selling items this week"<br/>
                "Compare stock levels vs sales volume"
              </p>
            </div>
          </div>
        )}

        {results.map((item, idx) => (
          <div key={idx} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* User Message */}
            <div className="flex justify-end">
              <div className="bg-slate-800 border border-slate-700 text-white px-5 py-3 md:px-6 md:py-4 rounded-3xl rounded-tr-none max-w-[85%] md:max-w-xl shadow-xl">
                <p className="text-[9px] font-black text-emerald-500 mb-1 uppercase tracking-widest">Query</p>
                <p className="text-sm font-medium">{item.query}</p>
              </div>
            </div>

            {/* AI Response */}
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center border border-emerald-400 shadow-[0_0_10px_#10b981] text-sm font-bold">OG</div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Analyst Engine</span>
              </div>
              
              <div className="space-y-6 pl-2 md:pl-10">
                <div className="bg-slate-900 border border-slate-800 p-5 md:p-6 rounded-3xl">
                  <p className="text-[9px] font-black text-emerald-500 uppercase mb-3 tracking-widest">Executed SQL</p>
                  <code className="text-[11px] block bg-black/40 p-4 rounded-xl text-emerald-300 overflow-x-auto mb-4 font-mono leading-relaxed border border-slate-800">
                    {item.result.sql}
                  </code>
                  <p className="text-xs text-slate-400 leading-relaxed font-medium italic">{item.result.explanation}</p>
                </div>
                
                <Visualizer result={item.result} />
                <InsightPanel insight={item.insight} />
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex flex-col gap-4 animate-pulse pl-10">
            <div className="h-24 bg-slate-900/50 rounded-3xl w-full border border-slate-800"></div>
            <div className="h-64 bg-slate-900/50 rounded-3xl w-full border border-slate-800"></div>
          </div>
        )}
      </div>

      {/* Input Form - Sticky at bottom */}
      <div className="p-4 bg-slate-950/80 backdrop-blur-md border-t border-slate-800/50">
        <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything..."
            className="w-full bg-slate-900 border border-slate-800 text-white pl-6 pr-24 py-4 md:py-5 rounded-2xl md:rounded-[2rem] focus:outline-none focus:border-emerald-600 transition-all text-sm font-medium placeholder-slate-600"
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="absolute right-2 top-2 md:right-3 md:top-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 md:px-6 md:py-2.5 rounded-xl md:rounded-full transition-all font-black text-[10px] uppercase tracking-widest shadow-lg"
          >
            {isLoading ? '...' : 'Run'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
