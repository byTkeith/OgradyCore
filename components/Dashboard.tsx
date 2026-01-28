
import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface VelocityPoint {
  date: string;
  revenue: number;
}

const Dashboard: React.FC = () => {
  const [liveStats, setLiveStats] = useState({
    clients: '...',
    stockItems: '...',
    recentTrans: '...',
    status: 'connecting' as 'connecting' | 'online' | 'offline'
  });
  
  const [velocityData, setVelocityData] = useState<VelocityPoint[]>([]);

  const fetchLiveStats = async () => {
    const bridgeUrl = localStorage.getItem('og_bridge_url');
    if (!bridgeUrl) {
      setLiveStats(prev => ({ ...prev, status: 'offline' }));
      return;
    }
    
    const baseUrl = bridgeUrl.replace(/\/$/, "");

    try {
      const runQuery = async (sql: string) => {
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
        return await res.json();
      };

      // Fetch individual counts
      const [cRes, sRes, tRes] = await Promise.all([
        runQuery("SELECT COUNT(*) as count FROM dbo.DEBTOR"),
        runQuery("SELECT COUNT(*) as count FROM dbo.STOCK"),
        runQuery("SELECT COUNT(*) as count FROM dbo.AUDIT")
      ]);

      setLiveStats({
        clients: (cRes[0]?.count || 0).toLocaleString(),
        stockItems: (sRes[0]?.count || 0).toLocaleString(),
        recentTrans: (tRes[0]?.count || 0).toLocaleString(),
        status: 'online'
      });

      // Daily Revenue Velocity (Last 30 Days)
      const vRes = await runQuery(`
        SELECT TOP 30 
          CAST(TransactionDate AS DATE) as d, 
          SUM(ISNULL(Qty, 0) * ISNULL(RetailPriceExcl, 0)) as revenue 
        FROM dbo.AUDIT 
        WHERE TransactionDate >= DATEADD(day, -30, GETDATE())
        GROUP BY CAST(TransactionDate AS DATE) 
        ORDER BY d ASC
      `);

      if (vRes && vRes.length > 0) {
        setVelocityData(vRes.map((r: any) => ({
          date: new Date(r.d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          revenue: Math.round(r.revenue || 0)
        })));
      } else {
        setVelocityData([]);
      }

    } catch (e) {
      setLiveStats(prev => ({ ...prev, status: 'offline' }));
    }
  };

  useEffect(() => {
    fetchLiveStats();
    const interval = setInterval(fetchLiveStats, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10 overflow-y-auto h-full pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-800 pb-8 gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Ultisales <span className="text-emerald-500 font-light italic">Sync</span></h1>
          <p className="text-slate-500 mt-2 font-medium italic">
            {liveStats.status === 'offline' ? '⚠️ Sync Link Disconnected' : 'Live analytics directly from dbo schema'}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Active Debtors', value: liveStats.clients, desc: 'dbo.DEBTOR' },
          { label: 'Inventory Master', value: liveStats.stockItems, desc: 'dbo.STOCK' },
          { label: 'Audit Trail', value: liveStats.recentTrans, desc: 'dbo.AUDIT' },
          { label: 'Link Integrity', value: liveStats.status === 'online' ? 'VERIFIED' : 'LOST', desc: 'Bridge connection' }
        ].map((stat, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] hover:border-emerald-500/30 transition-all duration-500 group">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</p>
            <h3 className="text-3xl font-black text-emerald-400 mt-3 group-hover:scale-105 transition-transform">{stat.value}</h3>
            <div className="mt-4 pt-4 border-t border-slate-800/50">
               <span className="text-[9px] font-mono text-slate-600 bg-black/30 px-2 py-1 rounded">{stat.desc}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 h-[34rem] shadow-2xl relative overflow-hidden">
        <div className="flex justify-between items-center mb-10 relative z-10">
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Daily Revenue Velocity</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Aggregated Revenue (Last 30 Days)</p>
          </div>
          {velocityData.length === 0 && liveStats.status === 'online' && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-2xl">
              <span className="text-[10px] text-amber-500 font-black uppercase tracking-widest">Database contains no recent audit logs</span>
            </div>
          )}
        </div>
        
        <div className="h-full pb-16 relative z-10">
          {velocityData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={velocityData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="date" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} dx={-10} tickFormatter={(v) => `R${v}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '16px', fontSize: '11px' }} 
                  itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#colorRevenue)" strokeWidth={4} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-slate-800 rounded-[2rem] bg-black/20">
              <p className="text-slate-600 font-black uppercase tracking-[0.2em] text-[10px]">No Transactional data detected in dbo.AUDIT</p>
              <p className="text-slate-700 text-[10px] mt-2 italic">Awaiting live sales activity...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
