
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
        if (!res.ok) throw new Error("Bridge Error");
        const data = await res.json();
        return data[0]?.count || 0;
      };

      const [cCount, sCount, iCount] = await Promise.all([
        fetchCount("SELECT COUNT(*) as count FROM tblClients"),
        fetchCount("SELECT COUNT(*) as count FROM tblStock"),
        fetchCount("SELECT COUNT(*) as count FROM tblInvoices WHERE INVOICEDATE >= DATEADD(month, -1, GETDATE())")
      ]);

      setLiveStats({
        clients: cCount.toLocaleString(),
        stockItems: sCount.toLocaleString(),
        recentInvoices: iCount.toLocaleString(),
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
            {liveStats.status === 'offline' ? '⚠️ Dashboard Bridge Offline' : 'Real-time performance metrics'}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Clients', value: liveStats.clients },
          { label: 'Active Stock', value: liveStats.stockItems },
          { label: 'Recent Invoices', value: liveStats.recentInvoices },
          { label: 'Health', value: liveStats.status.toUpperCase() }
        ].map((stat, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem]">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</p>
            <h3 className="text-3xl font-black text-emerald-400 mt-4">{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 h-[28rem]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={mockSalesData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="month" stroke="#475569" fontSize={11} />
            <YAxis stroke="#475569" fontSize={11} />
            <Tooltip contentStyle={{ backgroundColor: '#020617', borderRadius: '16px' }} />
            <Area type="monotone" dataKey="sales" stroke="#10b981" fill="#10b98144" strokeWidth={5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Dashboard;
