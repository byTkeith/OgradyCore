
import React, { useState, useEffect, useCallback } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, LineChart, Line, Legend, PieChart, Pie
} from 'recharts';
import { DEFAULT_BRIDGE_URL, MOCK_CHART_COLORS } from '../constants';
import { generateStrategicBrief, getDrilldownAnalysis } from '../services/geminiService';

interface DetailedStats {
  salesYoY: any[];
  topProducts: any[];
  composition: any[];
  cumulativeRevenue: any[];
  activeYear: number;
  isFallback: boolean;
  isAiEnabled: boolean;
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
  const [aiBrief, setAiBrief] = useState("Accessing SQL Clusters...");
  const [drillDown, setDrillDown] = useState<{title: string, data: any, insight: string} | null>(null);

  const fetchBIData = useCallback(async () => {
    const bridgeUrl = localStorage.getItem('og_bridge_url') || DEFAULT_BRIDGE_URL;
    setIsRefreshing(true);
    const baseUrl = bridgeUrl.replace(/\/$/, "");

    const runQuery = async (sql: string) => {
      try {
        const res = await fetch(`${baseUrl}/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '69420' },
          body: JSON.stringify({ sql }),
          mode: 'cors'
        });
        return await res.json();
      } catch (e) { return []; }
    };

    // Stage 1: Detection
    const check2026 = await runQuery(`SELECT COUNT(*) as cnt FROM dbo.AUDIT WHERE YEAR(TransactionDate) = 2026`);
    const opYear = (check2026?.[0]?.cnt > 5) ? 2026 : 2025;
    const prevYear = opYear - 1;

    // Stage 2: Heavy-Lifting SQL (Calculations handled by Server)
    const yoySql = `
      SELECT 
        DAY(TransactionDate) as day,
        SUM(CASE WHEN YEAR(TransactionDate) = ${opYear} THEN (Qty * RetailPriceExcl) ELSE 0 END) as currentYear,
        SUM(CASE WHEN YEAR(TransactionDate) = ${prevYear} THEN (Qty * RetailPriceExcl) ELSE 0 END) as lastYear
      FROM dbo.AUDIT 
      WHERE MONTH(TransactionDate) = MONTH(GETDATE())
      AND YEAR(TransactionDate) IN (${prevYear}, ${opYear})
      GROUP BY DAY(TransactionDate)
      ORDER BY day`;

    const cumulativeSql = `
      SELECT 
        DAY(TransactionDate) as day,
        SUM(SUM(Qty * RetailPriceExcl)) OVER (ORDER BY DAY(TransactionDate)) as cumulative
      FROM dbo.AUDIT
      WHERE MONTH(TransactionDate) = MONTH(GETDATE()) AND YEAR(TransactionDate) = ${opYear}
      GROUP BY DAY(TransactionDate)
      ORDER BY day`;

    const topProdSql = `
      SELECT TOP 10 
        S.Description, SUM(A.Qty) as sold, MAX(S.OnHand) as stock, AVG(A.RetailPriceExcl) as avgPrice
      FROM dbo.AUDIT A JOIN dbo.STOCK S ON A.PLUCode = S.Barcode
      WHERE A.TransactionDate >= DATEADD(day, -30, GETDATE())
      GROUP BY S.Description ORDER BY sold DESC`;

    const compSql = `
      SELECT ISNULL(T.TYPE_DESCRIPTION, 'Misc') as label, COUNT(*) as value
      FROM dbo.AUDIT A LEFT JOIN dbo.TYPES T ON A.TransactionType = CAST(T.TYPE_ID AS INT)
      AND T.TABLE_NAME = 'AUDIT' AND T.TYPE_NAME = 'TRANSACTIONTYPE'
      WHERE A.TransactionDate >= DATEADD(day, -30, GETDATE()) GROUP BY T.TYPE_DESCRIPTION`;

    const kpiSql = `
      SELECT 
        (SELECT ISNULL(SUM(Qty * RetailPriceExcl),0) FROM dbo.AUDIT WHERE YEAR(TransactionDate) = ${opYear} AND MONTH(TransactionDate) = MONTH(GETDATE())) as mRev,
        (SELECT ISNULL(SUM(Qty * RetailPriceExcl),0) FROM dbo.AUDIT WHERE YEAR(TransactionDate) = ${prevYear} AND MONTH(TransactionDate) = MONTH(GETDATE())) as pRev,
        (SELECT COUNT(DISTINCT DebtorOrCreditorNumber) FROM dbo.AUDIT WHERE TransactionDate >= DATEADD(day, -30, GETDATE())) as activeCust,
        (SELECT COUNT(*) FROM dbo.STOCK WHERE OnHand <= 5) as lowStock,
        (SELECT ISNULL(AVG(RetailPriceExcl * Qty),0) FROM dbo.AUDIT WHERE TransactionDate >= DATEADD(day, -30, GETDATE())) as ticket`;

    try {
      const [yoy, cum, prod, comp, kpi] = await Promise.all([
        runQuery(yoySql), runQuery(cumulativeSql), runQuery(topProdSql), runQuery(compSql), runQuery(kpiSql)
      ]);

      const mRev = kpi[0]?.mRev || 0;
      const pRev = kpi[0]?.pRev || 1;
      const growth = ((mRev - pRev) / pRev) * 100;

      const newStats = {
        salesYoY: yoy, cumulativeRevenue: cum, topProducts: prod, composition: comp,
        activeYear: opYear, isFallback: opYear === 2025, isAiEnabled: true,
        kpis: {
          totalRevenue: mRev, activeCustomers: kpi[0]?.activeCust || 0,
          lowStockCount: kpi[0]?.lowStock || 0, avgTicket: kpi[0]?.ticket || 0,
          growthRate: growth
        }
      };

      setStats(newStats);

      // Attempt AI Strategic Brief, fallback to local logic if quota hit
      const brief = await generateStrategicBrief(newStats);
      if (brief) {
        setAiBrief(brief);
      } else {
        setAiBrief(`Local Statistics: ${opYear} revenue is R${mRev.toLocaleString()} with a ${growth.toFixed(1)}% delta compared to previous period. Stock alerts are active for ${newStats.kpis.lowStockCount} items.`);
        setStats(prev => prev ? {...prev, isAiEnabled: false} : null);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchBIData(); }, [fetchBIData]);

  const handleBarClick = async (data: any) => {
    setDrillDown({ title: data.Description, data: data, insight: "Accessing Intelligent Diagnostics..." });
    const insight = await getDrilldownAnalysis(data);
    setDrillDown({ title: data.Description, data: data, insight });
  };

  if (!stats) return (
    <div className="flex flex-col items-center justify-center h-full space-y-4">
      <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Establishing Database Handshake...</p>
    </div>
  );

  return (
    <div className="p-4 md:p-10 max-w-[1600px] mx-auto space-y-8 overflow-y-auto h-full pb-32 custom-scrollbar print:p-0">
      {/* Dynamic Fiscal Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                <span className={`w-2 h-2 rounded-full ${stats.isAiEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-blue-400'}`}></span>
                <span className="text-[9px] font-black text-white uppercase tracking-widest">
                  {stats.isAiEnabled ? 'AI Augmented' : 'SQL-Local Mode'}
                </span>
             </div>
             <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase ml-2">BI <span className="text-emerald-500">Suite</span></h1>
          </div>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em]">
            Operational Year: <span className={stats.isFallback ? 'text-amber-500' : 'text-emerald-500'}>{stats.activeYear} {stats.isFallback ? '(Retrospective)' : '(Live)'}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => window.print()} className="px-6 py-3 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-slate-700">Export Report</button>
          <button onClick={fetchBIData} className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-500 transition-all hover:bg-emerald-500 hover:text-white">🔄</button>
        </div>
      </header>

      {/* KPI Section - Calculated Locally/SQL */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 print:grid-cols-4">
        {[
          { label: `MTD Revenue (${stats.activeYear})`, val: `R${stats.kpis.totalRevenue.toLocaleString()}`, icon: '💰', color: 'text-emerald-400' },
          { label: "Performance Delta", val: `${stats.kpis.growthRate > 0 ? '+' : ''}${stats.kpis.growthRate.toFixed(1)}%`, icon: '📈', color: stats.kpis.growthRate >= 0 ? 'text-blue-400' : 'text-rose-400' },
          { label: "Inventory Criticality", val: stats.kpis.lowStockCount, icon: '⚠️', color: 'text-rose-400' },
          { label: "Basket Efficiency", val: `R${Math.round(stats.kpis.avgTicket)}`, icon: '🛒', color: 'text-amber-400' }
        ].map((kpi, i) => (
          <div key={i} className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 p-6 rounded-[2rem] hover:border-emerald-500/30 transition-all shadow-xl group">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">{kpi.label}</span>
            <div className="flex items-center justify-between">
              <h3 className={`text-2xl md:text-3xl font-black ${kpi.color}`}>{kpi.val}</h3>
              <span className="text-xl opacity-20 group-hover:opacity-100 transition-all">{kpi.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Intelligence Brief - Handles Fallback */}
      <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-8 md:p-10 shadow-2xl relative border-l-8 border-l-emerald-600">
        <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none text-9xl">📊</div>
        <div className="flex-1 space-y-4">
          <h2 className="text-xl font-black text-white uppercase tracking-tighter leading-none">
            {stats.isAiEnabled ? 'Strategic Narrative' : 'Statistical Summary'}
          </h2>
          <p className="text-slate-200 text-lg md:text-2xl font-medium italic leading-relaxed py-2">
            "{aiBrief}"
          </p>
        </div>
      </div>

      {/* 100% SQL-Reliant Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-8 md:p-10 shadow-2xl">
          <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-8">Sales Velocity <span className="text-emerald-500">{stats.activeYear} vs {stats.activeYear-1}</span></h2>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.salesYoY}>
                <defs>
                  <linearGradient id="curr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                  <linearGradient id="prev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="day" stroke="#475569" fontSize={9} axisLine={false} tickLine={false} />
                <YAxis stroke="#475569" fontSize={9} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '20px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 900, paddingTop: '30px' }} />
                <Area name={`${stats.activeYear} (Current)`} type="monotone" dataKey="currentYear" stroke="#10b981" fill="url(#curr)" strokeWidth={4} />
                <Area name={`${stats.activeYear-1} (Previous)`} type="monotone" dataKey="lastYear" stroke="#3b82f6" fill="url(#prev)" strokeWidth={2} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-8 md:p-10 shadow-2xl">
          <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-8">Growth Path (MTD Cumulative)</h2>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.cumulativeRevenue}>
                <defs><linearGradient id="cumG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="day" stroke="#475569" fontSize={9} axisLine={false} tickLine={false} />
                <YAxis stroke="#475569" fontSize={9} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '20px' }} />
                <Area name="MTD Accumulation" type="stepAfter" dataKey="cumulative" stroke="#3b82f6" fill="url(#cumG)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-8 md:p-10 shadow-2xl flex flex-col">
          <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-4">Transaction Mix</h2>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.composition} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={8}>
                  {stats.composition.map((_, index) => (<Cell key={`cell-${index}`} fill={MOCK_CHART_COLORS[index % MOCK_CHART_COLORS.length]} strokeWidth={0} />))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '20px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 900 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-[3rem] p-8 md:p-10 shadow-2xl">
          <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-8">SKU Risk: Live Stock vs Velocity</h2>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.topProducts} onClick={(e: any) => e && e.activePayload && handleBarClick(e.activePayload[0].payload)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="Description" stroke="#475569" fontSize={8} interval={0} angle={-15} textAnchor="end" height={60} axisLine={false} tickLine={false} />
                <YAxis stroke="#475569" fontSize={9} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '20px' }} />
                <Bar name="Sales (30D)" dataKey="sold" fill="#10b981" radius={[6, 6, 0, 0]} barSize={20} />
                <Bar name="Stock Hand" dataKey="stock" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Modal - same as previous version but with local diagnostics fallback */}
      {drillDown && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-2xl">
          <div className="bg-slate-900 border border-emerald-500/30 w-full max-w-3xl rounded-[3rem] p-12 relative">
            <button onClick={() => setDrillDown(null)} className="absolute top-10 right-10 text-slate-500 hover:text-white text-3xl font-black transition-all">✕</button>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-8">{drillDown.title}</h2>
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-10 rounded-[2.5rem]">
              <p className="text-[11px] font-black text-emerald-500 uppercase tracking-widest mb-4">Analyst Strategic Verdict</p>
              <p className="text-slate-100 text-xl leading-relaxed italic font-medium">{drillDown.insight}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
