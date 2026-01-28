
import React from 'react';
import { AppSection } from '../types';

interface SidebarProps {
  activeSection: AppSection;
  setActiveSection: (section: AppSection) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeSection, setActiveSection }) => {
  const navItems = [
    { id: AppSection.DASHBOARD, label: 'Core Dashboard', icon: '📊' },
    { id: AppSection.ANALYST_CHAT, label: 'Ogrady Analyst', icon: '🧠' },
    { id: AppSection.DATA_EXPLORER, label: 'Live Data Link', icon: '🔗' },
    { id: AppSection.REPORTS, label: 'Executive Reports', icon: '📄' },
  ];

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col h-full shadow-2xl">
      <div className="p-6">
        <h1 className="text-xl font-bold text-emerald-500 flex items-center gap-2">
          <span className="text-2xl">🟢</span> OgradyCore
        </h1>
        <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-black">Intelligent BI Suite</p>
      </div>

      <nav className="flex-1 mt-4 px-3 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
              activeSection === item.id
                ? 'bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                : 'text-slate-500 hover:bg-slate-900 hover:text-emerald-400'
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 mt-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">API Connectivity</span>
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-mono text-slate-300">SERVER: 192.168.8.28</p>
            <p className="text-[11px] font-mono text-slate-400">DB: Ultisales</p>
            <p className="text-[10px] text-emerald-500 mt-2 font-bold bg-emerald-500/10 py-1 px-2 rounded">USER: OgradrayCore</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
