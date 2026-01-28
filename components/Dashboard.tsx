
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
    recentInvoices: '...',
    status: 'connecting' as 'connecting' | 'online' | 'offline'
  });

  const fetchLiveStats = async () => {
    const bridgeUrl = localStorage.getItem('og_bridge_url') || 'http://192.168.8.28:8000';
    const baseUrl = bridgeUrl.replace(/\/$/, "");

    try {
      const queries = {
        clients: "SELECT COUNT(*) as count FROM tblClients",
        stock: "SELECT COUNT(*) as count FROM tblStock",
        invoices: "SELECT COUNT(*) as count FROM tblInvoices WHERE INVOICEDATE >= DATEADD(month, -1, GETDATE())"
      };

      const fetchCount = async (sql: string) => {
        const res = await fetch(`${baseUrl}/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql }),
          mode: 'cors'
        });
        if (!res.ok) throw new Error("Bridge Error");
        const data = await res.json();
        return data[0]?.count || 0;
      };

      const [cCount, sCount, iCount] = await Promise.all([
        fetchCount(queries.clients),
        fetchCount(queries.stock),
        fetchCount(queries.invoices)
      ]);

      setLiveStats({
        clients: cCount.toLocaleString(),
        stockItems: sCount.toLocaleString(),
        recentInvoices: iCount.toLocaleString(),
        status: 'online'
      });
    } catch (e) {
      console.error("Dashboard live fetch failed:", e);
      setLiveStats(prev => ({ ...prev, status: 'offline' }));
    }
  };

  useEffect(() => {
    fetchLiveStats();
    const interval = setInterval(fetchLiveStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const statCards = [
    { label: 'Total Clients', value: liveStats.status === 'online' ? liveStats.clients : 'OFFLINE', color: 'text-emerald-400' },
    { label: 'Active Stock Items', value: liveStats.status === 'online' ? liveStats.stockItems : 'OFFLINE', color: 'text-emerald-400' },
    { label: 'Invoices (30d)', value: liveStats.status === 'online' ? liveStats.recentInvoices : 'OFFLINE', color: 'text-blue-400' },
    { label: 'Bridge Health', value: liveStats.status.toUpperCase(), color: liveStats.status === 'online' ? 'text-emerald-400' : 'text-rose-400' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10 overflow-y-auto h-full pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-800 pb-8 gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter">OgradyCore <span className="text-emerald-500 font-light">Overview</span></h1>
          <p className="text-slate-500 mt-2 font-medium italic">
            {liveStats.status === 'offline' 
              ? '⚠️ Connection failed. Configure endpoint in "Live Data Link".' 
              : `Real-time performance metrics for Ultisales DB`}
          </p>
        </div>
        <div className="flex gap-4">
          <button onClick={fetchLiveStats} className="px-6 py-3 bg-slate-900 border border-slate-800 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all">Refresh Stats</button>
          <button className="px-6 py-3 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-all">Sync Instance</button>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <div key={i} className={`bg-slate-900/50 backdrop-blur-md border border-slate-800 p-8 rounded-[2rem] shadow-sm transition-all group relative overflow-hidden ${liveStats.status === 'offline' ? 'opacity-70 grayscale' : 'hover:border-emerald-500/50'}`}>
            <div className="relative z-10">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{stat.label}</p>
              <div className="mt-6 flex items-baseline gap-3">
                <h3 className={`text-3xl font-black ${stat.color}`}>{stat.value}</h3>
              </div>
              <div className="mt-3 text-xs font-bold text-slate-500 flex items-center gap-1 uppercase tracking-widest">
                <span className={`w-1.5 h-1.5 rounded-full ${liveStats.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                {liveStats.status === 'online' ? 'Live Data Feed' : 'Offline Mode'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts section follows original design... */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 h-[28rem] shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-10 relative z-10">
            <h3 className="text-xl font-black text-slate-100 uppercase tracking-tighter">Profitability Velocity</h3>
          </div>
          <div className="h-full relative z-10 pb-10">
            <ResponsiveContainer width="100%" height="75%">
              <AreaChart data={mockSalesData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="month" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '16px' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#10b981" fillOpacity={1} fill="url(#colorSales)" strokeWidth={5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 h-[28rem] flex flex-col shadow-2xl">
          <h3 className="text-xl font-black text-slate-100 uppercase tracking-tighter mb-8">Stock Alerts</h3>
          <div className="space-y-4 flex-1 overflow-y-auto">
             <p className="text-xs text-slate-500 italic">Querying real-time levels...</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
