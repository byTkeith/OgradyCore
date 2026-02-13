
import React, { useState, useRef, useEffect } from 'react';
import { analyzeQuery } from '../services/geminiService';
import { QueryResult, AnalystInsight } from '../types';
import Visualizer from './Visualizer';
import InsightPanel from './InsightPanel';

const SummaryTable: React.FC<{ data: any[], xAxis: string, yAxis: string }> = ({ data, xAxis, yAxis }) => {
  if (!data || data.length === 0) return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 italic">
      No records found in database for this query.
    </div>
  );
  
  // Resolve keys robustly (case-insensitive and alias-aware)
  const getKeys = () => {
    const firstRow = data[0];
    const allKeys = Object.keys(firstRow);
    
    const findKey = (target: string) => {
      // Direct match
      if (firstRow.hasOwnProperty(target)) return target;
      // Case-insensitive match
      const found = allKeys.find(k => k.toLowerCase() === target.toLowerCase());
      if (found) return found;
      return null;
    };

    const xKey = findKey(xAxis) || allKeys[0];
    const yKey = findKey(yAxis) || allKeys[1] || allKeys[0];
    return { xKey, yKey };
  };

  const { xKey, yKey } = getKeys();

  const formatVal = (val: any) => {
    if (typeof val === 'number') return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return String(val || 'N/A');
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
              <th className="px-4 py-3 whitespace-nowrap">{xKey}</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">{yKey}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {data.slice(0, 15).map((row, i) => (
              <tr key={i} className="hover:bg-emerald-500/5 transition-colors">
                <td className="px-4 py-3 text-slate-300 font-medium">{String(row[xKey] || 'N/A')}</td>
                <td className="px-4 py-3 text-right text-emerald-400 font-mono font-bold">{formatVal(row[yKey])}</td>
              </tr>
            ))}
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
      setError(err.message || "An error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto md:px-6 md:py-8 overflow-hidden bg-slate-950">
      <div className="flex items-center justify-between px-4 mb-4">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tighter">Executive Analyst</h2>
          <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest">OgradyCore Intelligence Node</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-16 custom-scrollbar">
        {results.length === 0 && !isLoading && !error && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 shadow-2xl">
              <span className="text-4xl">🔎</span>
            </div>
            <p className="text-slate-500 text-sm font-medium italic border-t border-slate-800 pt-4">
              "Show top 20 buyers for enamel over the last 5 years"
            </p>
          </div>
        )}

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-8 rounded-[2rem] max-w-2xl mx-auto">
             <h4 className="text-[10px] font-black uppercase text-rose-500 mb-2">Analysis Alert</h4>
             <p className="text-rose-400 text-xs font-mono break-words leading-relaxed">{error}</p>
             <button onClick={() => setError(null)} className="mt-4 text-[10px] font-black uppercase bg-slate-800 text-white px-4 py-2 rounded-lg">Dismiss</button>
          </div>
        )}

        {results.map((item, idx) => (
          <div key={idx} className="space-y-10 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-end">
              <div className="bg-slate-800 text-white px-6 py-4 rounded-3xl rounded-tr-none max-w-[80%] shadow-lg font-bold">
                {item.query}
              </div>
            </div>
            
            <div className="space-y-8 md:pl-10">
              <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-[2rem]">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">T-SQL GENERATED</h4>
                  <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded uppercase font-mono">{item.engine}</span>
                </div>
                <code className="text-[11px] block bg-black/40 p-4 rounded-xl text-emerald-400 overflow-x-auto font-mono whitespace-pre-wrap">{item.result.sql}</code>
              </div>

              {item.result.data && item.result.data.length > 0 ? (
                <>
                  <SummaryTable data={item.result.data} xAxis={item.result.xAxis} yAxis={item.result.yAxis} />
                  <Visualizer result={item.result} />
                  <InsightPanel insight={item.insight} />
                </>
              ) : (
                <div className="space-y-6">
                  <div className="bg-slate-900 border border-slate-800 p-10 rounded-[2rem] text-center text-slate-400 italic">
                    Query completed but zero records match the criteria in the ERP database.
                  </div>
                  <InsightPanel insight={item.insight} />
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="space-y-4 animate-pulse md:ml-10">
            <div className="h-10 bg-slate-900/50 rounded-full w-2/3 ml-auto"></div>
            <div className="h-20 bg-slate-900/50 rounded-3xl w-full border border-slate-800"></div>
            <div className="h-64 bg-slate-900/50 rounded-3xl w-full border border-slate-800"></div>
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-950 border-t border-slate-800/50">
        <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto">
          <input 
            type="text" 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            placeholder="Ask about Sales, Stock, or Debtors..." 
            className="w-full bg-slate-900 border border-slate-800 text-white pl-6 pr-28 py-4 rounded-full focus:outline-none focus:border-emerald-600 font-medium transition-all" 
          />
          <button 
            type="submit" 
            disabled={isLoading || !query.trim()} 
            className="absolute right-2 top-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-full font-black text-[9px] uppercase tracking-widest transition-all"
          >
            {isLoading ? '...' : 'ANALYZE'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
