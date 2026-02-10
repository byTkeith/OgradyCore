
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, Legend, PieChart, Pie
} from 'recharts';
import { DEFAULT_BRIDGE_URL, MOCK_CHART_COLORS } from '../constants';
import { generateStrategicBrief } from '../services/geminiService';

interface DetailedStats {
  salesYoY: any[];
  topProducts: any[];
  composition: any[];
  activeYear: number;
  activeMonth: number;
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
  const [aiBrief, setAiBrief] = useState("Synchronizing Executive Intelligence...");
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
          body: JSON.stringify({ sql }),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) return [];
        return await res.json();
      } catch (e) { return []; }
    };

    try {
      // v4.2: Dynamic Date Detection - Find the latest data point in the system
      const latestDateRes = await runQuery(`SELECT MAX(TransactionDate) as lastDate FROM dbo.AUDIT`);
      const lastDateStr = latestDateRes?.[0]?.lastDate;
      
      let refDate = lastDateStr ? new Date(lastDateStr) : new Date();
      if (isNaN(refDate.getTime())) refDate = new Date();

      const opYear = refDate.getFullYear();
      const opMonth = refDate.getMonth() + 1;
      const prevYear = opYear - 1;

      // Primary Sales Query
      const yoySql = `
        SELECT DAY(TransactionDate) as day, 
        SUM(CASE WHEN YEAR(TransactionDate) = ${opYear} THEN (Qty * RetailPriceExcl) ELSE 0 END) as currentYear, 
        SUM(CASE WHEN YEAR(TransactionDate) = ${prevYear} THEN (Qty * RetailPriceExcl) ELSE 0 END) as lastYear 
        FROM dbo.AUDIT 
        WHERE MONTH(TransactionDate) = ${opMonth} 
        AND YEAR(TransactionDate) IN (${prevYear}, ${opYear}) 
        GROUP BY DAY(TransactionDate)`;

      const topProdSql = `
        SELECT TOP 10 S.Description, SUM(A.Qty) as sold, MAX(S.OnHand) as stock, AVG(A.RetailPriceExcl) as avgPrice 
        FROM dbo.AUDIT A 
        JOIN dbo.STOCK S ON A.PLUCode = S.Barcode 
        WHERE A.TransactionDate >= DATEADD(day, -60, '${refDate.toISOString().split('T')[0]}') 
        GROUP BY S.Description 
        ORDER BY sold DESC`;

      const compSql = `
        SELECT TOP 5 ISNULL(T.TYPE_DESCRIPTION, 'Operational') as label, COUNT(*) as value 
        FROM dbo.AUDIT A 
        LEFT JOIN dbo.TYPES T ON A.TransactionType = CAST(T.TYPE_ID AS INT) AND T.TABLE_NAME = 'AUDIT' AND T.TYPE_NAME = 'TRANSACTIONTYPE' 
        WHERE A.TransactionDate >= DATEADD(day, -30, '${refDate.toISOString().split('T')[0]}') 
        GROUP BY T.TYPE_DESCRIPTION`;

      const kpiSql = `
        SELECT 
        (SELECT ISNULL(SUM(Qty * RetailPriceExcl),0) FROM dbo.AUDIT WHERE YEAR(TransactionDate) = ${opYear} AND MONTH(TransactionDate) = ${opMonth}) as mRev, 
        (SELECT ISNULL(SUM(Qty * RetailPriceExcl),0) FROM dbo.AUDIT WHERE YEAR(TransactionDate) = ${prevYear} AND MONTH(TransactionDate) = ${opMonth}) as pRev, 
        (SELECT COUNT(DISTINCT DebtorOrCreditorNumber) FROM dbo.AUDIT WHERE TransactionDate >= DATEADD(day, -30, '${refDate.toISOString().split('T')[0]}')) as activeCust, 
        (SELECT COUNT(*) FROM dbo.STOCK WHERE OnHand <= 5) as lowStock, 
        (SELECT ISNULL(AVG(RetailPriceExcl * Qty),0) FROM dbo.AUDIT WHERE TransactionDate >= DATEADD(day, -30, '${refDate.toISOString().split('T')[0]}')) as ticket`;

      const [yoy, prod, comp, kpi] = await Promise.all([
        runQuery(yoySql), runQuery(topProdSql), runQuery(compSql), runQuery(kpiSql)
      ]);

      const mRev = kpi[0]?.mRev || 0;
      const pRev = kpi[0]?.pRev || 1;
      const growth = ((mRev - pRev) / pRev) * 100;

      const newStats: DetailedStats = {
        salesYoY: Array.isArray(yoy) ? yoy.sort((a,b) => a.day - b.day) : [],
        topProducts: Array.isArray(prod) ? prod : [],
        composition: Array.isArray(comp) ? comp : [],
        activeYear: opYear,
        activeMonth: opMonth,
        engine: 'SQL_MASTER',
        kpis: {
          totalRevenue: mRev,
          activeCustomers: kpi[0]?.activeCust || 0,
          lowStockCount: kpi[0]?.lowStock || 0,
          avgTicket: kpi[0]?.ticket || 0,
          growthRate: growth
        }
      };

      setStats(newStats);
      
      // Attempt AI Strategic Summary
      try {
        const brief = await generateStrategicBrief(newStats);
        if (brief) {
          setAiBrief(brief.text);
        } else {
          setAiBrief(`Operational update for ${opMonth}/${opYear}: Revenue recognized at R${mRev.toLocaleString()}. Dashboard synced with production.`);
        }
      } catch (err) {
        setAiBrief(`Reporting active. Current period: ${opMonth}/${opYear}. Total Sales: R${mRev.toLocaleString()}. (Strategic AI currently offline)`);
      }

    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchBIData(); }, [fetchBIData]);

  if (!stats) return (
    <div className="flex flex-col items-center justify-center h-full space-y-6">
      <div className="w-16 h-16 border-4 border-slate-800 border-t-emerald-500 rounded-full animate-spin"></div>
      <div className="text-center">
        <p className="text-xs font-black text-white uppercase tracking-widest">Bridging SQL Production</p>
        <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-widest italic">v4.2 Active Search</p>
      </div>
    </div>
  );

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="p-4 md:p-10 max-w-[1600px] mx-auto space-y-8 overflow-y-auto h-full pb-32 custom-scrollbar">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
             <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter">Executive <span className="text-emerald-500">Suite</span></h1>
             <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-[9px] font-black text-emerald-500 uppercase tracking-widest">
                LIVE PRODUCTION
             </div>
          </div>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em]">
            Period: <span className="text-emerald-400">{monthNames[stats.activeMonth - 1]} {stats.activeYear}</span> (Detected from DB)
          </p>
        </div>
        <button onClick={fetchBIData} className="flex items-center gap-2 px-6 py-3 bg-slate-900 border border-slate-800 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all text-emerald-500">
           {isRefreshing ? "Synchronizing..." : "Manual Refresh"} 🔄
        </button>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Net Revenue", val: `R${stats.kpis.totalRevenue.toLocaleString()}`, icon: '💰', color: 'text-emerald-400' },
          { label: "Growth Index", val: `${stats.kpis.growthRate > 0 ? '+' : ''}${stats.kpis.growthRate.toFixed(1)}%`, icon: '📈', color: stats.kpis.growthRate >= 0 ? 'text-blue-400' : 'text-rose-400' },
          { label: "Inventory Alerts", val: stats.kpis.lowStockCount, icon: '⚠️', color: 'text-rose-400' },
          { label: "Avg Ticket", val: `R${Math.round(stats.kpis.avgTicket)}`, icon: '🛒', color: 'text-amber-400' }
        ].map((kpi, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800/80 p-6 rounded-[2rem] shadow-xl group hover:border-emerald-500/40 transition-all">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">{kpi.label}</span>
            <div className="flex items-center justify-between">
              <h3 className={`text-2xl md:text-3xl font-black ${kpi.color}`}>{kpi.val}</h3>
              <span className="text-xl opacity-20 group-hover:opacity-100 transition-all">{kpi.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl relative border-l-8 border-l-emerald-600">
        <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none text-9xl">🧠</div>
        <div className="flex-1 space-y-4">
          <h2 className="text-xs font-black text-emerald-500 uppercase tracking-widest">AI Strategic Forecast</h2>
          <p className="text-slate-200 text-lg md:text-2xl font-medium italic leading-relaxed py-2">"{aiBrief}"</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl">
          <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-8">Revenue Momentum</h2>
          <div className="h-[350px]">
            {stats.salesYoY && stats.salesYoY.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.salesYoY}>
                  <defs>
                    <linearGradient id="curr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="day" stroke="#475569" fontSize={9} axisLine={false} tickLine={false} />
                  <YAxis stroke="#475569" fontSize={9} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '20px' }} />
                  <Area name="Sales" type="monotone" dataKey="currentYear" stroke="#10b981" fill="url(#curr)" strokeWidth={4} />
                  <Area name="Last Year" type="monotone" dataKey="lastYear" stroke="#334155" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center border border-dashed border-slate-800 rounded-3xl">
                <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest">No transaction data for {monthNames[stats.activeMonth - 1]}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-10 shadow-2xl">
          <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-8">Service Composition</h2>
          <div className="w-full h-[350px]">
            {stats.composition && stats.composition.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.composition} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={8}>
                    {stats.composition.map((_, index) => (<Cell key={`cell-${index}`} fill={MOCK_CHART_COLORS[index % MOCK_CHART_COLORS.length]} strokeWidth={0} />))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '20px' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center border border-dashed border-slate-800 rounded-3xl">
                <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest">Distribution data unavailable</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
