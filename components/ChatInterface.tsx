
import React, { useState, useRef, useEffect } from 'react';
import { analyzeQuery } from '../services/geminiService';
import { QueryResult, AnalystInsight } from '../types';
import Visualizer from './Visualizer';
import InsightPanel from './InsightPanel';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const SummaryTable: React.FC<{ data: any[], xAxis: string, yAxis: string }> = ({ data, xAxis, yAxis }) => {
  if (!data || data.length === 0) return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 italic">
      No records found in database for this query.
    </div>
  );
  
  // Resolve keys robustly
  const getKeys = () => {
    const firstRow = data[0];
    const allKeys = Object.keys(firstRow);
    
    const findKey = (target: string) => {
      if (!target) return null;
      if (firstRow.hasOwnProperty(target)) return target;
      const found = allKeys.find(k => k.toLowerCase() === target.toLowerCase());
      if (found) return found;
      const fuzzy = allKeys.find(k => k.toLowerCase().includes(target.toLowerCase()));
      if (fuzzy) return fuzzy;
      return null;
    };

    const xKey = findKey(xAxis) || allKeys[0];
    const yKey = findKey(yAxis) || allKeys[1] || allKeys[0];
    const allNumericKeys = allKeys.filter(k => typeof firstRow[k] === 'number');

    return { xKey, yKey, allKeys, allNumericKeys };
  };

  const { xKey, yKey, allKeys, allNumericKeys } = getKeys();

  // Calculate Grand Totals
  const totals = allNumericKeys.reduce((acc, key) => {
    acc[key] = data.reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
    return acc;
  }, {} as Record<string, number>);

  const formatVal = (val: any, key?: string) => {
    const k = (key || '').toLowerCase();
    const isVolumeField = k.includes('qty') || k.includes('quantity') || k.includes('stock') || k.includes('target') || k.includes('count') || k.includes('onhand') || k.includes('warehouse') || k.includes('volume');

    // Handle strings that might be pre-formatted as currency but should be integers (like Volume)
    if (typeof val === 'string' && isVolumeField && (val.includes('R') || val.includes('$'))) {
      const numericStr = val.replace(/[R$\s,]/g, '');
      const num = parseFloat(numericStr);
      if (!isNaN(num)) {
        return num.toLocaleString(undefined, { 
          minimumFractionDigits: 0, 
          maximumFractionDigits: 0 
        });
      }
    }

    if (typeof val === 'number') {
        // TimeKey, Year, Month should be treated as labels/integers, not money
        if (k.includes('timekey') || k.includes('year') || k.includes('month')) {
            return String(val);
        }
        // Quantities should be formatted as integers with no currency symbol
        if (isVolumeField) {
            return val.toLocaleString(undefined, { 
                minimumFractionDigits: 0, 
                maximumFractionDigits: 0 
            });
        }
        
        // Percentages should be formatted with a % sign
        if (k.includes('percent') || k.includes('%') || k.includes('pct') || k.includes('margin') || k.includes('variance') || k.includes('rate') || k.includes('contribution') || k.includes('share')) {
            return val.toLocaleString(undefined, { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            }) + '%';
        }

        // Default to currency for other numeric fields (Revenue, Momentum, etc.)
        return 'R ' + val.toLocaleString(undefined, { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        });
    }
    return String(val || '-');
  };

  return (
    <div className="space-y-6">
      {/* Grand Totals Card */}
      {allNumericKeys.length > 0 && data.length > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {allNumericKeys.map(key => (
            <div key={key} className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl shadow-xl">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{key} TOTAL</p>
              <p className="text-2xl font-black text-emerald-400 font-mono tracking-tighter">
                {formatVal(totals[key], key)}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="bg-slate-900/60 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Statistical Summary</span>
          <span className="text-[9px] text-slate-500 font-mono">{data.length} records found</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-black/20 text-slate-500 font-black uppercase tracking-tighter">
                <th className="px-4 py-3 w-12 text-center border-r border-slate-800 bg-slate-900/40">#</th>
                {allKeys.map(key => (
                   <th key={key} className={`px-4 py-3 whitespace-nowrap ${typeof data[0][key] === 'number' ? 'text-right' : ''}`}>
                      {key}
                   </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.slice(0, 50).map((row, i) => (
                <tr key={i} className="hover:bg-emerald-500/5 transition-colors">
                  <td className="px-4 py-3 text-center text-emerald-500 font-black font-mono text-xs border-r border-slate-800 bg-slate-900/20">{i + 1}</td>
                  {allKeys.map(key => (
                     <td key={key} className={`px-4 py-3 ${typeof row[key] === 'number' ? 'text-right text-emerald-400 font-mono font-bold whitespace-nowrap' : 'text-slate-300 font-medium'}`}>
                        {formatVal(row[key], key)}
                     </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4 flex justify-between items-center bg-black/10 text-slate-500 text-[10px] font-bold uppercase tracking-widest border-t border-slate-800">
            <span>Total Records: {data.length}</span>
            {data.length > 50 && <span>Showing first 50 records</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

const ChatInterface: React.FC = () => {
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ query: string; result: QueryResult; insight: AnalystInsight; engine: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const resultRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleDownloadPDF = async (index: number, query: string) => {
    const element = resultRefs.current[index];
    if (!element) return;

    try {
      const originalStyle = element.style.cssText;
      
      // Force a professional width for the capture
      element.style.width = '1200px';
      element.style.maxWidth = 'none';
      element.style.overflow = 'visible';
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#020617',
        logging: false,
        width: 1200,
        onclone: (clonedDoc: Document) => {
          const clonedElement = clonedDoc.body.querySelector(`[data-pdf-id="${index}"]`) as HTMLElement;
          if (clonedElement) {
            clonedElement.style.width = '1200px';
            clonedElement.style.padding = '60px';
            clonedElement.style.borderRadius = '0';
            clonedElement.style.border = 'none';
          }
        }
      });

      element.style.cssText = originalStyle;

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pdfWidth - (2 * margin);
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * contentWidth) / imgProps.width;
      
      let heightLeft = imgHeight;
      let position = 25; // Top margin for header
      let page = 1;

      // Header Function
      const addHeader = (p: any) => {
        p.setFillColor(15, 23, 42); // slate-900
        p.rect(0, 0, pdfWidth, 25, 'F'); // Increased height to 25 to match topMargin
        p.setTextColor(255, 255, 255);
        p.setFontSize(10);
        p.setFont("helvetica", "bold");
        p.text("O'GRADY PAINTS EXECUTIVE REPORT", margin, 12);
        p.setFontSize(8);
        p.setTextColor(148, 163, 184); // slate-400
        p.setFont("helvetica", "normal");
        p.text(`Generated: ${new Date().toLocaleString()}`, pdfWidth - margin - 50, 12);
      };

      // Footer Function
      const addFooter = (p: any, pageNum: number) => {
        // Draw a solid background rectangle to mask any image bleed from above
        p.setFillColor(2, 6, 23); // slate-950 (matching the app background)
        p.rect(0, pdfHeight - 20, pdfWidth, 20, 'F');
        
        p.setFontSize(8);
        p.setTextColor(148, 163, 184);
        p.text(`Page ${pageNum}`, pdfWidth / 2, pdfHeight - 10, { align: 'center' });
        p.text("CONFIDENTIAL - O'GRADY PAINTS BI CORE", margin, pdfHeight - 10);
      };

      // Add first page
      const topMargin = 25;
      const footerMargin = 20;
      const pageContentHeight = pdfHeight - topMargin - footerMargin;
      
      pdf.addImage(imgData, 'PNG', margin, topMargin, contentWidth, imgHeight, undefined, 'FAST');
      addHeader(pdf); // Add header AFTER image to mask top bleed
      addFooter(pdf, page); // Add footer AFTER image to mask bottom bleed

      heightLeft -= pageContentHeight;

      while (heightLeft > 0) {
        pdf.addPage();
        page++;
        
        // Calculate position to show the next segment of the image
        const shift = (page - 1) * pageContentHeight;
        pdf.addImage(imgData, 'PNG', margin, topMargin - shift, contentWidth, imgHeight, undefined, 'FAST');
        
        addHeader(pdf); // Add header AFTER image to mask top bleed
        addFooter(pdf, page); // Add footer AFTER image to mask bottom bleed
        heightLeft -= pageContentHeight;
      }

      const fileName = `Ogrady_Report_${query.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error("PDF Generation Error:", err);
      alert("Failed to generate PDF. Please try again.");
    }
  };

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
    setActiveQuery(currentQuery);
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
      setActiveQuery('');
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-6xl mx-auto md:px-6 md:py-8 overflow-hidden bg-slate-950">
      <div className="flex items-center justify-between px-4 mb-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tighter">Executive Analyst</h2>
            <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest">OgradyCore Intelligence Node</p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full flex items-center gap-2">
            <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">PDF Export Active</span>
            <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></div>
          </div>
          {results.length > 0 && (
            <button 
              onClick={() => handleDownloadPDF(results.length - 1, results[results.length - 1].query)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black uppercase px-4 py-1.5 rounded-full shadow-lg transition-all flex items-center gap-2"
            >
              <span>📄</span> Export Latest Analysis
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-16 custom-scrollbar">
        {results.length === 0 && !isLoading && !error && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 shadow-2xl">
              <span className="text-4xl">🔎</span>
            </div>
            <div className="space-y-2">
              <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Awaiting Strategic Request</p>
              <p className="text-slate-500 text-[10px] font-medium italic">
                Try: "Show top 20 buyers for enamel over the last 5 years"
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-8 rounded-[2rem] max-w-2xl mx-auto animate-in fade-in">
             <h4 className="text-[10px] font-black uppercase text-rose-500 mb-2">Analysis Pipeline Alert</h4>
             <p className="text-rose-400 text-xs font-mono break-words leading-relaxed">{error}</p>
             <button onClick={() => setError(null)} className="mt-4 text-[10px] font-black uppercase bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors">Dismiss</button>
          </div>
        )}

        {results.map((item, idx) => (
          <div 
            key={idx} 
            ref={el => { resultRefs.current[idx] = el; }}
            data-pdf-id={idx}
            className="space-y-10 animate-in fade-in slide-in-from-bottom-4 p-8 rounded-[3rem] bg-slate-900/30 border border-slate-800/50 shadow-inner"
          >
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
              <div className="bg-slate-800 text-white px-8 py-5 rounded-[2rem] rounded-tr-none shadow-2xl font-black text-lg border border-slate-700 max-w-[95%] md:max-w-[80%] tracking-tight">
                {item.query}
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadPDF(idx, item.query);
                }}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all active:scale-95 border-2 border-white/20 whitespace-nowrap"
              >
                <span>📄</span> EXPORT PDF
              </button>
            </div>
            
            <div className="space-y-12 md:pl-12">
              {item.result.sql && (
                <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-[2rem]">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">T-SQL GENERATED</h4>
                    <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded uppercase font-mono">{item.engine}</span>
                  </div>
                  <code className="text-[11px] block bg-black/40 p-4 rounded-xl text-emerald-400 overflow-x-auto font-mono whitespace-pre-wrap">{item.result.sql}</code>
                </div>
              )}

              {item.result.data && item.result.data.length > 0 ? (
                <>
                  <SummaryTable data={item.result.data} xAxis={item.result.xAxis} yAxis={item.result.yAxis} />
                  <Visualizer result={item.result} />

                  {item.result.strategicAnalysis && (
                    <div className="mt-8 p-8 bg-emerald-500/5 border border-emerald-500/20 rounded-[2rem]">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-4 flex items-center gap-2">
                        <span>📊</span> Strategic Analysis
                      </h4>
                      <p className="text-slate-300 leading-relaxed font-serif italic text-lg">
                        {item.result.strategicAnalysis}
                      </p>
                    </div>
                  )}

                  <div className="flex justify-center mt-8">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadPDF(idx, item.query);
                      }}
                      className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 hover:text-white bg-emerald-500/5 hover:bg-emerald-500 px-8 py-3 rounded-full shadow-xl transition-all transform hover:scale-105 border border-emerald-500/20"
                    >
                      <span>📥</span> Generate Full Report PDF
                    </button>
                  </div>
                  <InsightPanel insight={item.insight} onExportPDF={() => handleDownloadPDF(idx, item.query)} />
                </>
              ) : (
                <div className="space-y-6">
                  {item.result.sql && (
                    <div className="bg-slate-900 border border-slate-800 p-10 rounded-[2rem] text-center text-slate-400 italic">
                      Pipeline executed successfully, but zero matching records were found in the database.
                    </div>
                  )}
                  <InsightPanel insight={item.insight} onExportPDF={() => handleDownloadPDF(idx, item.query)} />
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 md:ml-10">
            <div className="flex justify-end">
              <div className="bg-slate-800/50 text-slate-400 px-6 py-4 rounded-3xl rounded-tr-none max-w-[80%] shadow-lg font-bold border border-slate-700/50 italic">
                {activeQuery || "Processing request..."}
              </div>
            </div>
            
            <div className="bg-slate-900/40 border border-slate-800/50 p-10 rounded-[2.5rem] flex flex-col items-center justify-center space-y-6">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs animate-pulse">⚡</span>
                </div>
              </div>
              <div className="text-center space-y-2">
                <h4 className="text-xs font-black text-white uppercase tracking-widest">Analyzing Intelligence Pipeline</h4>
                <p className="text-[10px] text-emerald-500/80 font-bold uppercase tracking-[0.2em] animate-pulse">Do not close this page. Connection must remain active.</p>
                <div className="flex gap-1 justify-center mt-4">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1 h-1 bg-emerald-500 rounded-full animate-bounce"></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-950 border-t border-slate-800/50">
        <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto">
          <input 
            type="text" 
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            placeholder="Search Sales, Trends, or Top Debtors..." 
            className="w-full bg-slate-900 border border-slate-800 text-white pl-6 pr-28 py-4 rounded-full focus:outline-none focus:border-emerald-600 font-medium transition-all shadow-xl" 
          />
          <button 
            type="submit" 
            disabled={isLoading || !query.trim()} 
            className="absolute right-2 top-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-full font-black text-[9px] uppercase tracking-widest transition-all disabled:opacity-50"
          >
            {isLoading ? '...' : 'ANALYZE'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatInterface;
