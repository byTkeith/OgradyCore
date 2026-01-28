
import React from 'react';
import { AnalystInsight } from '../types';

interface InsightPanelProps {
  insight: AnalystInsight;
}

const InsightPanel: React.FC<InsightPanelProps> = ({ insight }) => {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-emerald-900/40 to-slate-950 border border-emerald-500/20 rounded-[2rem] p-8 shadow-2xl backdrop-blur-sm">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
            <span className="text-2xl">💡</span>
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-100 uppercase tracking-tighter">Analyst Verdict</h3>
            <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">OgradyCore Intelligence</p>
          </div>
        </div>
        
        <p className="text-slate-300 leading-relaxed mb-10 text-lg font-medium italic border-l-4 border-emerald-500 pl-6 py-2">
          "{insight.summary}"
        </p>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></span> Market Trends
            </h4>
            <ul className="space-y-3">
              {insight.trends.map((item, i) => (
                <li key={i} className="text-sm text-slate-400 bg-slate-900/50 p-3 rounded-xl border border-slate-800/50">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_#fb7185]"></span> Risk Factors
            </h4>
            <ul className="space-y-3">
              {insight.anomalies.map((item, i) => (
                <li key={i} className="text-sm text-slate-400 bg-slate-900/50 p-3 rounded-xl border border-slate-800/50">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa]"></span> Strategic Moves
            </h4>
            <ul className="space-y-3">
              {insight.suggestions.map((item, i) => (
                <li key={i} className="text-sm text-slate-400 bg-slate-900/50 p-3 rounded-xl border border-slate-800/50">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsightPanel;
