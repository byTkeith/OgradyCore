
import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const mockSalesData = [
  { month: 'Jan', sales: 4000, profit: 2400 },
  { month: 'Feb', sales: 3000, profit: 1398 },
  { month: 'Mar', sales: 2000, profit: 9800 },
  { month: 'Apr', sales: 2780, profit: 3908 },
  { month: 'May', sales: 1890, profit: 4800 },
  { month: 'Jun', sales: 2390, profit: 3800 },
  { month: 'Jul', sales: 3490, profit: 4300 },
];

const Dashboard: React.FC = () => {
  const [liveStats, setLiveStats] = useState({
    clients: '...',
    stockItems: '...',
    recentTrans: '...',
    status: 'connecting' as 'connecting' | 'online' | 'offline'
  });

  const fetchLiveStats = async () => {
    const bridgeUrl = localStorage.getItem('og_bridge_url');
    if (!bridgeUrl) {
      setLiveStats(prev => ({ ...prev, status: 'offline' }));
      return;
    }
    
    const baseUrl = bridgeUrl.replace(/\/$/, "");

    try {
      const fetchCount = async (sql: string) => {
        const res = await fetch(`${baseUrl}/query`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420'
          },
          body: JSON.stringify({ sql }),
          mode: 'cors'
        });
        if (!res.ok) throw new Error("Sync Error");
        const data = await res.json();
        return data[0]?.count || 0;
      };

      // Table names updated with dbo. prefix
      const [cCount, sCount, tCount] = await Promise.all([
        fetchCount("SELECT COUNT(*) as count FROM dbo.DEBTOR"),
        fetchCount("SELECT COUNT(*) as count FROM dbo.STOCK"),
        fetchCount("SELECT COUNT(*) as count FROM dbo.AUDIT")
      ]);

      setLiveStats({
        clients: cCount.toLocaleString(),
        stockItems: sCount.toLocaleString(),
        recentTrans: tCount.toLocaleString(),
        status: 'online'
      });
    } catch (e) {
      setLiveStats(prev => ({ ...prev, status: 'offline' }));
    }
  };

  useEffect(() => {
    fetchLiveStats();
    const interval = setInterval(fetchLiveStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10 overflow-y-auto h-full pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-800 pb-8 gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter">OgradyCore <span className="text-emerald-500 font-light">Overview</span></h1>
          <p className="text-slate-500 mt-2 font-medium italic">
            {liveStats.status === 'offline' ? '⚠️ Sync Link Required' : 'Operational metrics synced with Ultisales'}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Active Debtors', value: liveStats.clients },
          { label: 'Stock Master', value: liveStats.stockItems },
          { label: 'Audit Log Entries', value: liveStats.recentTrans },
          { label: 'DB Context', value: liveStats.status === 'online' ? 'DBO.ULTISALES' : 'OFFLINE' }
        ].map((stat, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] hover:border-emerald-500/30 transition-all duration-500 shadow-xl">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</p>
            <h3 className="text-3xl font-black text-emerald-400 mt-4 tracking-tight">{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 h-[28rem] shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-white uppercase tracking-tighter">Velocity Performance</h2>
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest px-3 py-1 bg-black/40 rounded-full">Trend Simulation</span>
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={mockSalesData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="month" stroke="#475569" fontSize={11} />
            <YAxis stroke="#475569" fontSize={11} />
            <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '16px' }} />
            <Area type="monotone" dataKey="sales" stroke="#10b981" fill="#10b98111" strokeWidth={5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Dashboard;
