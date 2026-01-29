
import React, { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DEFAULT_BRIDGE_URL } from '../constants';

interface VelocityPoint {
  date: string;
  revenue: number;
}

const Dashboard: React.FC = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [liveStats, setLiveStats] = useState({
    clients: '...',
    stockItems: '...',
    recentTrans: '...',
    status: 'connecting' as 'connecting' | 'online' | 'offline'
  });
  
  const [velocityData, setVelocityData] = useState<VelocityPoint[]>([]);

  const fetchLiveStats = useCallback(async () => {
    const bridgeUrl = localStorage.getItem('og_bridge_url') || DEFAULT_BRIDGE_URL;
    if (!bridgeUrl) {
      setLiveStats(prev => ({ ...prev, status: 'offline' }));
      return;
    }
    
    setIsRefreshing(true);
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
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveStats();
    const interval = setInterval(fetchLiveStats, 120000); // Auto refresh every 2 mins
    return () => clearInterval(interval);
  }, [fetchLiveStats]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-10 overflow-y-auto h-full pb-32 custom-scrollbar">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-black text-white tracking-tighter uppercase">Ultisales <span className="text-emerald-500 font-light italic">Sync</span></h1>
          <p className="text-slate-500 text-[10px] md:text-xs mt-1 font-bold uppercase tracking-widest">
            {liveStats.status === 'offline' ? '⚠️ Waiting for sync bridge' : 'Direct schema telemetry'}
          </p>
        </div>
        <button 
          onClick={fetchLiveStats} 
          disabled={isRefreshing}
          className={`p-2 rounded-xl border border-slate-800 bg-slate-900 transition-all ${isRefreshing ? 'opacity-50 animate-spin' : 'hover:border-emerald-500/50'}`}
        >
          <span className="text-lg">🔄</span>
        </button>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {[
          { label: 'Debtors', value: liveStats.clients, icon: '👥' },
          { label: 'Products', value: liveStats.stockItems, icon: '📦' },
          { label: 'History', value: liveStats.recentTrans, icon: '📜' },
          { label: 'Health', value: liveStats.status === 'online' ? 'UP' : 'ERR', icon: '📡' }
        ].map((stat, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 p-4 md:p-6 rounded-2xl md:rounded-[2rem] hover:border-emerald-500/30 transition-all duration-500">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</span>
              <span className="text-xs md:text-sm">{stat.icon}</span>
            </div>
            <h3 className="text-lg md:text-3xl font-black text-emerald-400 truncate">{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl md:rounded-[3rem] p-5 md:p-10 min-h-[24rem] shadow-2xl flex flex-col">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-8">
          <div>
            <h2 className="text-lg md:text-2xl font-black text-white uppercase tracking-tighter">Daily Revenue Velocity</h2>
            <p className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Aggregated Value (Last 30 Days)</p>
          </div>
          {velocityData.length === 0 && liveStats.status === 'online' && (
            <span className="text-[8px] md:text-[9px] text-amber-500 font-black uppercase bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">Empty AUDIT.Log</span>
          )}
        </div>
        
        <div className="flex-1 min-h-[16rem]">
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
                <XAxis dataKey="date" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis stroke="#475569" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => `R${v}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px' }} 
                  itemStyle={{ color: '#10b981' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#colorRevenue)" strokeWidth={3} animationDuration={1000} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-slate-800 rounded-2xl bg-black/20 p-6 text-center">
              <p className="text-slate-600 font-black uppercase tracking-widest text-[9px]">No Transactional data detected in the last 30 days</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
