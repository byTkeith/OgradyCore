
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto md:px-6 md:py-8 overflow-hidden">
      {/* Header with Print Control */}
      <div className="flex items-center justify-between px-4 mb-4 print:hidden">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tighter">AI Analyst Session</h2>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Natural Language Data Exploration</p>
        </div>
        {results.length > 0 && (
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-slate-700"
          >
            🖨️ Print Transcript
          </button>
        )}
      </div>

      {/* Scrollable Chat History */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-12 custom-scrollbar print:overflow-visible print:h-auto">
        {results.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 p-4 print:hidden">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
              <span className="text-3xl md:text-4xl text-emerald-400">🧠</span>
            </div>
            <div className="max-w-xs md:max-w-md">
              <p className="text-xl md:text-2xl font-black text-white tracking-tight">Executive Analyst</p>
              <p className="text-slate-500 mt-2 text-xs md:text-sm font-medium leading-relaxed">
                Ask about sales trends, inventory risks, or customer behaviors.<br/>
                <span className="text-emerald-500/50 italic">"What are our top 10 products by profit margin this month?"</span>
              </p>
            </div>
          </div>
        )}

        {results.map((item, idx) => (
          <div key={idx} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 print:break-inside-avoid print:py-10 print:border-b print:border-slate-200">
            {/* User Message */}
            <div className="flex justify-end print:justify-start">
              <div className="bg-slate-800 border border-slate-700 text-white px-5 py-3 md:px-6 md:py-4 rounded-3xl rounded-tr-none max-w-[85%] md:max-w-xl shadow-xl print:bg-white print:text-black print:border-slate-300 print:shadow-none">
                <p className="text-[9px] font-black text-emerald-500 mb-1 uppercase tracking-widest print:text-slate-500">Business Inquiry</p>
                <p className="text-sm font-semibold">{item.query}</p>
              </div>
            </div>

            {/* AI Response */}
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-3 print:hidden">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center border border-emerald-400 shadow-[0_0_10px_#10b981] text-sm font-bold">OG</div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Intelligent Analyst Engine</span>
              </div>
              
              <div className="space-y-6 pl-2 md:pl-10 print:pl-0">
                <div className="bg-slate-900 border border-slate-800 p-5 md:p-6 rounded-3xl print:bg-white print:text-black print:border-slate-300">
                  <p className="text-[9px] font-black text-emerald-500 uppercase mb-3 tracking-widest print:text-slate-500">Query Validation (SQL)</p>
                  <code className="text-[11px] block bg-black/40 p-4 rounded-xl text-emerald-300 overflow-x-auto mb-4 font-mono leading-relaxed border border-slate-800 print:bg-slate-50 print:text-slate-800 print:border-slate-200">
                    {item.result.sql}
                  </code>
                  <p className="text-xs text-slate-400 leading-relaxed font-medium italic print:text-slate-600">{item.result.explanation}</p>
                </div>
                
                <Visualizer result={item.result} />
                <InsightPanel insight={item.insight} />
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex flex-col gap-4 animate-pulse pl-10 print:hidden">
            <div className="h-24 bg-slate-900/50 rounded-3xl w-full border border-slate-800"></div>
            <div className="h-64 bg-slate-900/50 rounded-3xl w-full border border-slate-800"></div>
          </div>
        )}
      </div>

      {/* Input Form - Sticky at bottom */}
      <div className="p-4 bg-slate-950/80 backdrop-blur-md border-t border-slate-800/50 print:hidden">
        <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask your data a question..."
            className="w-full bg-slate-900 border border-slate-800 text-white pl-6 pr-24 py-4 md:py-5 rounded-2xl md:rounded-[2rem] focus:outline-none focus:border-emerald-600 transition-all text-sm font-medium placeholder-slate-600 shadow-2xl"
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="absolute right-2 top-2 md:right-3 md:top-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 md:px-6 md:py-2.5 rounded-xl md:rounded-full transition-all font-black text-[10px] uppercase tracking-widest shadow-lg"
          >
            {isLoading ? '...' : 'Query'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
