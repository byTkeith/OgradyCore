
import React, { useState, useRef, useEffect } from 'react';
import { analyzeQuery } from '../services/geminiService';
import { QueryResult, AnalystInsight } from '../types';
import Visualizer from './Visualizer';
import InsightPanel from './InsightPanel';

const SummaryTable: React.FC<{ data: any[], xAxis: string, yAxis: string }> = ({ data, xAxis, yAxis }) => {
  if (!data || data.length === 0) return null;
  
  // Format numbers nicely
  const formatVal = (val: any) => {
    if (typeof val === 'number') return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return val;
  };

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden mb-6">
      <div className="bg-slate-900/60 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Statistical Summary</span>
        <span className="text-[9px] text-slate-500 font-mono">{data.length} records found</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-black/20 text-slate-500 font-black uppercase tracking-tighter">
              <th className="px-4 py-2">{xAxis}</th>
              <th className="px-4 py-2 text-right">{yAxis}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {data.slice(0, 10).map((row, i) => (
              <tr key={i} className="hover:bg-emerald-500/5 transition-colors">
                <td className="px-4 py-2 text-slate-300 font-medium">{row[xAxis] || 'Unknown'}</td>
                <td className="px-4 py-2 text-right text-emerald-400 font-mono font-bold">{formatVal(row[yAxis])}</td>
              </tr>
            ))}
            {data.length > 10 && (
              <tr>
                <td colSpan={2} className="px-4 py-1 text-center text-[9px] text-slate-600 italic">Showing top 10 of {data.length} results</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

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
      const pipelineResult = await analyzeQuery(currentQuery);
      setResults(prev => [...prev, { 
        query: currentQuery, 
        result: pipelineResult, 
        insight: pipelineResult.insight, 
        engine: pipelineResult.engine 
      }]);
    } catch (err: any) {
      console.error("AI Error:", err);
      setError(err.message || "An unknown intelligence error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto md:px-6 md:py-8 overflow-hidden bg-slate-950">
      <div className="flex items-center justify-between px-4 mb-4">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tighter">Executive Analyst</h2>
          <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest">High-Performance Business Engine</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-16 custom-scrollbar print:overflow-visible">
        {results.length === 0 && !isLoading && !error && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6">
            <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 shadow-2xl">
              <span className="text-4xl">🚀</span>
            </div>
            <div className="max-w-md">
              <p className="text-2xl font-black text-white uppercase tracking-tight">Strategy Mode Active</p>
              <p className="text-slate-500 mt-4 text-sm font-medium leading-relaxed italic border-t border-slate-800 pt-4">
                "Compare sales of enamels vs gloss for the last 6 months"
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-10 rounded-[2.5rem] max-w-2xl mx-auto text-left animate-in fade-in slide-in-from-top-4">
             <div className="flex items-center gap-4 mb-6">
               <span className="text-4xl">⚠️</span>
               <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Connection Alert</h3>
             </div>
             <div className="bg-black/40 p-6 rounded-2xl border border-rose-500/20 mb-6">
                <p className="text-rose-400 text-xs font-mono break-words leading-relaxed">{error}</p>
             </div>
             <button onClick={() => setError(null)} className="text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-500 transition-all">Retry Link</button>
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
                <div className={`absolute top-0 right-10 -translate-y-1/2 px-4 py-1 rounded-full border text-[9px] font-black uppercase bg-emerald-500/20 border-emerald-500 text-emerald-400`}>
                  {item.engine}
                </div>
                <div className="mb-4">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">T-SQL Blueprint</h4>
                    <code className="text-[12px] block bg-black/40 p-6 rounded-2xl text-emerald-400 overflow-x-auto font-mono border border-slate-800">{item.result.sql}</code>
                </div>
                <p className="text-sm text-slate-300 italic font-medium mt-4 border-l-2 border-emerald-500 pl-4">Logical Path: {item.result.explanation}</p>
              </div>

              <div className="grid lg:grid-cols-1 gap-6">
                <SummaryTable data={item.result.data} xAxis={item.result.xAxis} yAxis={item.result.yAxis} />
                <Visualizer result={item.result} />
              </div>
              
              <InsightPanel insight={item.insight} />
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex flex-col gap-6 animate-pulse md:ml-12">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
              <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">Crunching Strategic Data...</p>
            </div>
            <div className="h-24 bg-slate-900/50 rounded-[2rem] w-full border border-slate-800"></div>
            <div className="h-[300px] bg-slate-900/50 rounded-[2rem] w-full border border-slate-800"></div>
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-950/90 backdrop-blur-xl border-t border-slate-800/50 print:hidden">
        <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto">
          <input 
            type="text" 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            placeholder="What's our biggest revenue driver this week?" 
            className="w-full bg-slate-900 border border-slate-800 text-white pl-8 pr-32 py-5 rounded-[2rem] focus:outline-none focus:border-emerald-600 transition-all font-medium text-lg" 
          />
          <button 
            type="submit" 
            disabled={isLoading || !query.trim()} 
            className="absolute right-2 top-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-8 py-3.5 rounded-full transition-all font-black text-[10px] uppercase tracking-widest shadow-xl"
          >
            {isLoading ? 'ANALYZING...' : 'COMMAND'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
