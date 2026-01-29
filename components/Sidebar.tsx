
import React from 'react';
import { AppSection } from '../types';

interface SidebarProps {
  activeSection: AppSection;
  setActiveSection: (section: AppSection) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeSection, setActiveSection, isOpen, onClose }) => {
  const navItems = [
    { id: AppSection.DASHBOARD, label: 'Dashboard', icon: '📊' },
    { id: AppSection.ANALYST_CHAT, label: 'AI Analyst', icon: '🧠' },
    { id: AppSection.DATA_EXPLORER, label: 'Bridge Link', icon: '🔗' },
  ];

  const handleNavClick = (id: AppSection) => {
    setActiveSection(id);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <aside className={`
        fixed md:relative z-50 w-72 md:w-64 bg-slate-950 border-r border-slate-800 flex flex-col h-full shadow-2xl transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-emerald-500 flex items-center gap-2">
              <span className="text-2xl">🟢</span> OgradyCore
            </h1>
            <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-black italic">Intelligent BI</p>
          </div>
          <button onClick={onClose} className="md:hidden text-slate-400 p-2">✕</button>
        </div>

        <nav className="flex-1 mt-4 px-3 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-sm font-semibold transition-all duration-300 ${
                activeSection === item.id
                  ? 'bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)] scale-[1.02]'
                  : 'text-slate-500 hover:bg-slate-900 hover:text-emerald-400'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 mt-auto">
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Connectivity</span>
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-mono text-slate-300 truncate">192.168.8.28:54927</p>
              <p className="text-[9px] text-emerald-500 mt-2 font-bold bg-emerald-500/10 py-1 px-2 rounded inline-block">Ultisales Master</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
