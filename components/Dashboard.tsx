
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, Legend, PieChart, Pie
} from 'recharts';
import { DEFAULT_BRIDGE_URL, MOCK_CHART_COLORS } from '../constants';
import { DOMAIN_MAPPINGS } from '../metadata_mappings';
import { generateStrategicBrief } from '../services/geminiService';

interface DetailedStats {
  salesYoY: any[];
  topProducts: any[];
  composition: any[];
  activeDate: string;
  engine: string;
  kpis: {
    totalRevenue: number;
    activeCustomers: number;
    lowStockCount: number;
    avgTicket: number;
    growthRate: number;
  };
}

const Dashboard: React.FC = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState<DetailedStats | null>(null);
  const [aiBrief, setAiBrief] = useState("Analyzing production fiscal streams...");
  const lastFetchRef = useRef<number>(0);

  const fetchBIData = useCallback(async () => {
    if (Date.now() - lastFetchRef.current < 2000) return;
    lastFetchRef.current = Date.now();

    const bridgeUrl = localStorage.getItem('og_bridge_url') || DEFAULT_BRIDGE_URL;
    setIsRefreshing(true);
    const baseUrl = bridgeUrl.replace(/\/$/, "");

    const runQuery = async (sql: string) => {
      try {
        const res = await fetch(`${baseUrl}/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '69420' },
          body: JSON.stringify({ sql: `SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED; ${sql}` }),
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) return [];
        return await res.json();
      } catch { return []; }
    };

    try {
      const latestDateRes = await runQuery(`SELECT MAX(TransactionDate) as lastDate FROM dbo.AUDIT`);
      const lastDateStr = latestDateRes?.[0]?.lastDate;
      
      let refDate = lastDateStr ? new Date(lastDateStr) : new Date();
      if (isNaN(refDate.getTime())) refDate = new Date();
      const refDateIso = refDate.toISOString().split('T')[0];

      // v4.6 Optimized Trailing Revenue SQL
      const yoySql = `
        SELECT DAY(TransactionDate) as day, 
        SUM(CASE WHEN TransactionDate >= DATEADD(day, -30, '${refDateIso}') THEN (Qty * RetailPriceExcl) ELSE 0 END) as currentYear, 
        SUM(CASE WHEN TransactionDate >= DATEADD(year, -1, DATEADD(day, -30, '${refDateIso}')) AND TransactionDate <= DATEADD(year, -1, '${refDateIso}') THEN (Qty * RetailPriceExcl) ELSE 0 END) as lastYear 
        FROM dbo.AUDIT 
        WHERE TransactionDate >= DATEADD(year, -1, DATEADD(day, -30, '${refDateIso}'))
        AND TransactionType IN (66, 67, 68, 70, 80)
        GROUP BY DAY(TransactionDate)`;

      const topProdSql = `
        SELECT TOP 10 S.Description, SUM(A.Qty) as sold, MAX(S.OnHand) as stock 
        FROM dbo.AUDIT A 
        JOIN dbo.STOCK S ON A.PLUCode = S.Barcode 
        WHERE A.TransactionDate >= DATEADD(day, -60, '${refDateIso}') 
        AND A.TransactionType IN (66, 70, 80)
        GROUP BY S.Description 
        ORDER BY sold DESC`;

      const compSql = `
        SELECT TOP 5 TransactionType, COUNT(*) as value 
        FROM dbo.AUDIT 
        WHERE TransactionDate >= DATEADD(day, -30, '${refDateIso}') 
        AND TransactionType IN (66, 67, 68, 70, 80, 84)
        GROUP BY TransactionType`;

      const kpiSql = `
        SELECT 
        (SELECT ISNULL(SUM(Qty * RetailPriceExcl),0) FROM dbo.AUDIT WHERE TransactionDate >= DATEADD(day, -30, '${refDateIso}') AND TransactionType IN (66, 70, 80)) as mRev, 
        (SELECT ISNULL(SUM(Qty * RetailPriceExcl),0) FROM dbo.AUDIT WHERE TransactionDate >= DATEADD(year, -1, DATEADD(day, -30, '${refDateIso}')) AND TransactionDate <= DATEADD(year, -1, '${refDateIso}') AND TransactionType IN (66, 70, 80)) as pRev, 
        (SELECT COUNT(DISTINCT DebtorOrCreditorNumber) FROM dbo.AUDIT WHERE TransactionDate >= DATEADD(day, -30, '${refDateIso}')) as activeCust, 
        (SELECT COUNT(*) FROM dbo.STOCK WHERE OnHand <= 5) as lowStock, 
        (SELECT ISNULL(AVG(RetailPriceExcl * Qty),0) FROM dbo.AUDIT WHERE TransactionDate >= DATEADD(day, -30, '${refDateIso}') AND TransactionType IN (66, 70, 80)) as ticket`;

      const [yoy, prod, compRaw, kpi] = await Promise.all([
        runQuery(yoySql), runQuery(topProdSql), runQuery(compSql), runQuery(kpiSql)
      ]);

      // Map raw composition types to business descriptions from metadata
      const composition = compRaw.map((item: any) => ({
        label: (DOMAIN_MAPPINGS.AUDIT.TRANSACTIONTYPE as any)[item.TransactionType.toString()] || `Type ${item.TransactionType}`,
        value: item.value
      }));

      const mRev = kpi[0]?.mRev || 0;
      const pRev = kpi[0]?.pRev || 1;
      const growth = ((mRev - pRev) / pRev) * 100;

      const newStats: DetailedStats = {
        salesYoY: Array.isArray(yoy) ? yoy.sort((a,b) => a.day - b.day) : [],
        topProducts: Array.isArray(prod) ? prod : [],
        composition,
        activeDate: refDateIso,
        engine: 'SQL_CORE_v4.6',
        kpis: {
          totalRevenue: mRev,
          activeCustomers: kpi[0]?.activeCust || 0,
          lowStockCount: kpi[0]?.lowStock || 0,
          avgTicket: kpi[0]?.ticket || 0,
          growthRate: growth
        }
      };

      setStats(newStats);
      const brief = await generateStrategicBrief(newStats);
      if (brief) setAiBrief(brief.text);

    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchBIData(); }, [fetchBIData]);

  if (!stats) return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 animate-pulse">
      <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.1)]">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
      <div className="text-center">
        <p className="text-xs font-black text-white uppercase tracking-widest">Bridging Ultisales MSSQL</p>
        <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-widest italic">v4.6 Unified Logic Engine</p>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-10 max-w-[1600px] mx-auto space-y-10 overflow-y-auto h-full pb-32 custom-scrollbar">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-800 pb-10">
        <div>
          <div className="flex items-center gap-4 mb-2">
             <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none">Executive <span className="text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">Suite</span></h1>
             <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-[10px] font-black text-emerald-500 uppercase tracking-widest">PROD LIVE</span>
          </div>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.5em] mt-3">
            Last Transaction: <span className="text-emerald-400">{stats.activeDate}</span>
          </p>
        </div>
        <button onClick={fetchBIData} className="flex items-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95">
           {isRefreshing ? "Synchronizing..." : "Sync Master Data"} 🔄
        </button>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
        {[
          { label: "Trailing 30D Rev", val: `R${stats.kpis.totalRevenue.toLocaleString()}`, icon: '💰', color: 'from-emerald-600/20 to-transparent', text: 'text-emerald-400' },
          { label: "Momentum Index", val: `${stats.kpis.growthRate > 0 ? '+' : ''}${stats.kpis.growthRate.toFixed(1)}%`, icon: '📈', color: 'from-blue-600/20 to-transparent', text: 'text-blue-400' },
          { label: "Inventory Alarms", val: stats.kpis.lowStockCount, icon: '⚠️', color: 'from-rose-600/20 to-transparent', text: 'text-rose-400' },
          { label: "Avg Transaction", val: `R${Math.round(stats.kpis.avgTicket)}`, icon: '🛒', color: 'from-amber-600/20 to-transparent', text: 'text-amber-400' }
        ].map((kpi, i) => (
          <div key={i} className={`bg-slate-900/40 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group hover:border-emerald-500/40 transition-all`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${kpi.color} opacity-20`}></div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4 relative z-10">{kpi.label}</span>
            <div className="flex items-center justify-between relative z-10">
              <h3 className={`text-2xl md:text-3xl font-black ${kpi.text}`}>{kpi.val}</h3>
              <span className="text-3xl opacity-30 group-hover:opacity-100 transition-opacity">{kpi.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-[3.5rem] p-12 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none text-[12rem] font-black">AI</div>
        <div className="flex-1 space-y-6 relative z-10">
          <h2 className="text-xs font-black text-emerald-500 uppercase tracking-[0.4em]">Strategic Analysis Engine</h2>
          <p className="text-slate-100 text-xl md:text-3xl font-semibold italic leading-snug max-w-4xl tracking-tight">"{aiBrief}"</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
        <div className="bg-slate-900/80 border border-slate-800 rounded-[3.5rem] p-12 shadow-2xl backdrop-blur-xl">
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-10 border-l-4 border-emerald-500 pl-6">Revenue Trajectory</h2>
          <div className="h-[400px]">
            {stats.salesYoY.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.salesYoY}>
                  <defs>
                    <linearGradient id="gCurr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.6}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="day" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} tickMargin={10} />
                  <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `R${v}`} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '24px', padding: '15px' }} />
                  <Area name="Active Revenue" type="monotone" dataKey="currentYear" stroke="#10b981" fill="url(#gCurr)" strokeWidth={5} />
                  <Area name="Benchmark Prev" type="monotone" dataKey="lastYear" stroke="#334155" fill="transparent" strokeWidth={2} strokeDasharray="10 10" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center border border-dashed border-slate-800 rounded-[2.5rem]">
                <p className="text-slate-600 text-xs font-black uppercase tracking-widest italic opacity-50 text-center px-10">Synchronizing with Transaction Stream...</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-[3.5rem] p-12 shadow-2xl backdrop-blur-xl">
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-10 border-l-4 border-blue-500 pl-6">Business Composition</h2>
          <div className="w-full h-[400px]">
            {stats.composition.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.composition} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={100} outerRadius={140} paddingAngle={10} cornerRadius={8}>
                    {stats.composition.map((_, index) => (<Cell key={`cell-${index}`} fill={MOCK_CHART_COLORS[index % MOCK_CHART_COLORS.length]} strokeWidth={0} />))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '24px' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', color: '#64748b', paddingTop: '30px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center border border-dashed border-slate-800 rounded-[2.5rem]">
                <p className="text-slate-600 text-xs font-black uppercase tracking-widest opacity-50">Composition Link Pending</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
