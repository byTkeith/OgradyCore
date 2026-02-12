
import React from 'react';
import { AnalystInsight } from '../types';

interface InsightPanelProps {
  insight: AnalystInsight;
}

const InsightPanel: React.FC<InsightPanelProps> = ({ insight }) => {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-emerald-900/40 to-slate-950 border border-emerald-500/20 rounded-[2.5rem] p-10 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-5 mb-8">
          <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/30">
            <span className="text-3xl">📊</span>
          </div>
          <div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Executive Intelligence</h3>
            <p className="text-[10px] text-emerald-500 font-black uppercase tracking-[0.2em]">OgradyCore Strategy Engine</p>
          </div>
        </div>
        
        <div className="relative mb-12">
          <div className="absolute -left-4 top-0 bottom-0 w-1 bg-emerald-500 rounded-full shadow-[0_0_15px_#10b981]"></div>
          <p className="text-xl md:text-2xl text-slate-100 font-bold italic pl-6 leading-relaxed">
            "{insight.summary}"
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Trends */}
          <div className="space-y-5">
            <h4 className="text-[11px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]"></span> 
              Market Trends
            </h4>
            <div className="space-y-3">
              {insight.trends.map((item, i) => (
                <div key={i} className="group bg-slate-900/60 p-4 rounded-xl border border-slate-800 hover:border-emerald-500/40 transition-all">
                  <p className="text-sm text-slate-300 group-hover:text-white transition-colors leading-snug">{item}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Risks */}
          <div className="space-y-5">
            <h4 className="text-[11px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_10px_#f43f5e]"></span> 
              Risk Factors
            </h4>
            <div className="space-y-3">
              {insight.anomalies.map((item, i) => (
                <div key={i} className="group bg-slate-900/60 p-4 rounded-xl border border-slate-800 hover:border-rose-500/40 transition-all">
                  <p className="text-sm text-slate-300 group-hover:text-white transition-colors leading-snug">{item}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Strategic Moves */}
          <div className="space-y-5">
            <h4 className="text-[11px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_#3b82f6]"></span> 
              Strategic Moves
            </h4>
            <div className="space-y-3">
              {insight.suggestions.map((item, i) => (
                <div key={i} className="group bg-slate-900/60 p-4 rounded-xl border border-slate-800 hover:border-blue-500/40 transition-all">
                  <p className="text-sm text-slate-300 group-hover:text-white transition-colors leading-snug">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsightPanel;
