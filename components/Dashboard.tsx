
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
  hourlySales: any[];
  operatorSales: any[];
  volumeTrend: any[];
  cumulativeRevenue: any[];
  activeYear: number;
  isFallback: boolean;
  kpis: {
    totalRevenue: number;
    activeCustomers: number;
    lowStockCount: number;
    avgTicket: number;
  };
}

const Dashboard: React.FC = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState<DetailedStats | null>(null);
  const [aiBrief, setAiBrief] = useState("Initializing Multi-Year SQL Handshake...");
  const [drillDown, setDrillDown] = useState<{title: string, data: any, insight: string} | null>(null);
  
  const targetYear = 2026;

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

    // Stage 1: Check for 2026 Data Presence
    const check2026Sql = `SELECT COUNT(*) as cnt FROM dbo.AUDIT WHERE YEAR(TransactionDate) = 2026`;
    const checkRes = await runQuery(check2026Sql);
    const has2026Data = checkRes?.[0]?.cnt > 5; // Minimum threshold for a "live" year
    
    const operationalYear = has2026Data ? 2026 : 2025;
    const comparisonYear = operationalYear - 1;

    // 1. YoY Daily Sales: Optimized for 100% server accuracy
    const yoySql = `
      SELECT 
        DAY(TransactionDate) as day,
        SUM(CASE WHEN YEAR(TransactionDate) = ${operationalYear} THEN (Qty * RetailPriceExcl) ELSE 0 END) as currentYear,
        SUM(CASE WHEN YEAR(TransactionDate) = ${comparisonYear} THEN (Qty * RetailPriceExcl) ELSE 0 END) as lastYear
      FROM dbo.AUDIT 
      WHERE MONTH(TransactionDate) = MONTH(GETDATE())
      AND YEAR(TransactionDate) IN (${comparisonYear}, ${operationalYear})
      GROUP BY DAY(TransactionDate)
      ORDER BY day`;

    // 2. Cumulative Revenue: Tracking growth curves
    const cumulativeSql = `
      SELECT 
        DAY(TransactionDate) as day,
        SUM(SUM(Qty * RetailPriceExcl)) OVER (ORDER BY DAY(TransactionDate)) as cumulative
      FROM dbo.AUDIT
      WHERE MONTH(TransactionDate) = MONTH(GETDATE()) AND YEAR(TransactionDate) = ${operationalYear}
      GROUP BY DAY(TransactionDate)
      ORDER BY day`;

    // 3. Product Performance: Top SKUs
    const topProdSql = `
      SELECT TOP 10 
        S.Description, 
        SUM(A.Qty) as sold, 
        MAX(S.OnHand) as stock, 
        AVG(A.RetailPriceExcl) as avgPrice
      FROM dbo.AUDIT A 
      JOIN dbo.STOCK S ON A.PLUCode = S.Barcode
      WHERE A.TransactionDate >= DATEADD(day, -30, GETDATE())
      GROUP BY S.Description 
      ORDER BY sold DESC`;

    // 4. Operator Performance: FIXED labels using TYPES join
    const operatorSql = `
      SELECT TOP 6
        Operator as label,
        SUM(Qty * RetailPriceExcl) as value
      FROM dbo.AUDIT
      WHERE TransactionDate >= DATEADD(day, -30, GETDATE())
      AND Operator IS NOT NULL AND Operator <> ''
      GROUP BY Operator
      ORDER BY value DESC`;

    // 5. Transaction Distribution: FIXED labels from TYPES table
    const compSql = `
      SELECT 
        ISNULL(T.TYPE_DESCRIPTION, 'System Unmapped') as label, 
        COUNT(*) as value
      FROM dbo.AUDIT A 
      LEFT JOIN dbo.TYPES T ON A.TransactionType = CAST(T.TYPE_ID AS INT)
      AND T.TABLE_NAME = 'AUDIT' AND T.TYPE_NAME = 'TRANSACTIONTYPE'
      WHERE A.TransactionDate >= DATEADD(day, -30, GETDATE()) 
      GROUP BY T.TYPE_DESCRIPTION`;

    // 6. KPIs
    const kpiSql = `
      SELECT 
        (SELECT ISNULL(SUM(Qty * RetailPriceExcl),0) FROM dbo.AUDIT WHERE YEAR(TransactionDate) = ${operationalYear} AND MONTH(TransactionDate) = MONTH(GETDATE())) as monthRev,
        (SELECT COUNT(DISTINCT DebtorOrCreditorNumber) FROM dbo.AUDIT WHERE TransactionDate >= DATEADD(day, -30, GETDATE())) as activeCust,
        (SELECT COUNT(*) FROM dbo.STOCK WHERE OnHand <= 5) as lowStock,
        (SELECT ISNULL(AVG(RetailPriceExcl * Qty),0) FROM dbo.AUDIT WHERE TransactionDate >= DATEADD(day, -30, GETDATE())) as ticket`;

    try {
      const [yoy, cum, prod, op, comp, kpi] = await Promise.all([
        runQuery(yoySql), 
        runQuery(cumulativeSql),
        runQuery(topProdSql),
        runQuery(operatorSql),
        runQuery(compSql), 
        runQuery(kpiSql)
      ]);

      const newStats = {
        salesYoY: yoy, 
        cumulativeRevenue: cum,
        topProducts: prod,
        operatorSales: op,
        composition: comp,
        volumeTrend: [], // Placeholder
        hourlySales: [], // Placeholder
        activeYear: operationalYear,
        isFallback: !has2026Data,
        kpis: {
          totalRevenue: kpi[0]?.monthRev || 0,
          activeCustomers: kpi[0]?.activeCust || 0,
          lowStockCount: kpi[0]?.lowStock || 0,
          avgTicket: kpi[0]?.ticket || 0
        }
      };

      setStats(newStats);
      const brief = await generateStrategicBrief(newStats);
      setAiBrief(brief);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { 
    fetchBIData(); 
  }, [fetchBIData]);

  const handleBarClick = async (data: any) => {
    setDrillDown({ title: data.Description, data: data, insight: "Connecting to AI Analysis Hub..." });
    const insight = await getDrilldownAnalysis(data);
    setDrillDown({ title: data.Description, data: data, insight });
  };

  if (!stats) return (
    <div className="flex flex-col items-center justify-center h-full space-y-4">
      <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Querying Server Multi-Year Clusters...</p>
    </div>
  );

  return (
    <div className="p-4 md:p-10 max-w-[1600px] mx-auto space-y-8 overflow-y-auto h-full pb-32 custom-scrollbar print:p-0">
      {/* Executive Header with Fallback Status */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-3 h-3 rounded-full ${stats.isFallback ? 'bg-amber-500 shadow-[0_0_15px_#f59e0b]' : 'bg-emerald-500 shadow-[0_0_15px_#10b981]'}`}></span>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase leading-none">
              BI <span className="text-emerald-500">Suite</span>
            </h1>
          </div>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em]">
            Mode: <span className={stats.isFallback ? 'text-amber-500' : 'text-emerald-500'}>
              {stats.isFallback ? `Fiscal ${stats.activeYear} Retrospective` : `Fiscal ${stats.activeYear} Real-Time`}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => window.print()} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-slate-700">📂 Print Detailed PDF</button>
          <button onClick={fetchBIData} disabled={isRefreshing} className={`p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-500 transition-all ${isRefreshing ? 'opacity-50 animate-spin' : 'hover:bg-emerald-500 hover:text-white'}`}>🔄</button>
        </div>
      </header>

      {/* Primary KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 print:grid-cols-4">
        {[
          { label: "Month-to-Date Net", val: `R${stats.kpis.totalRevenue.toLocaleString()}`, icon: '💰', color: 'text-emerald-400' },
          { label: "Active 30D Debtors", val: stats.kpis.activeCustomers, icon: '👥', color: 'text-blue-400' },
          { label: "Low Stock Critical", val: stats.kpis.lowStockCount, icon: '⚠️', color: 'text-rose-400' },
          { label: "Average Basket", val: `R${Math.round(stats.kpis.avgTicket)}`, icon: '🛒', color: 'text-amber-400' }
        ].map((kpi, i) => (
          <div key={i} className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 p-6 rounded-[2rem] hover:border-emerald-500/30 transition-all group shadow-lg">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">{kpi.label}</span>
            <div className="flex items-center justify-between">
              <h3 className={`text-2xl md:text-3xl font-black ${kpi.color}`}>{kpi.val}</h3>
              <span className="text-xl opacity-20 group-hover:opacity-100 transition-all transform group-hover:scale-110">{kpi.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Automated Briefing Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-8 md:p-10 shadow-2xl flex flex-col xl:flex-row gap-10 items-center overflow-hidden relative border-l-8 border-l-emerald-600">
        <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none text-9xl">🧠</div>
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20">
              <span className="text-emerald-500 text-sm">🧠</span>
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-tighter leading-none">Intelligence Protocol {stats.activeYear}</h2>
          </div>
          <p className="text-slate-200 text-lg md:text-2xl font-medium italic leading-relaxed py-2">
            "{aiBrief}"
          </p>
        </div>
      </div>

      {/* Major Visualizations Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* YoY Sales Delta */}
        <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-8 md:p-10 shadow-2xl">
          <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-8">Sales Velocity <span className="text-emerald-500">{stats.activeYear} vs {stats.activeYear - 1}</span></h2>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.salesYoY}>
                <defs>
                  <linearGradient id="curr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                  <linearGradient id="prev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="day" stroke="#475569" fontSize={9} axisLine={false} tickLine={false} />
                <YAxis stroke="#475569" fontSize={9} axisLine={false} tickLine={false} tickFormatter={(v) => `R${v/1000}k`} />
                <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '20px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 900, paddingTop: '30px', textTransform: 'uppercase' }} />
                <Area name={`Current Month (${stats.activeYear})`} type="monotone" dataKey="currentYear" stroke="#10b981" fill="url(#curr)" strokeWidth={4} />
                <Area name={`Prior Year (${stats.activeYear - 1})`} type="monotone" dataKey="lastYear" stroke="#3b82f6" fill="url(#prev)" strokeWidth={2} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Growth Path (Cumulative) */}
        <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-8 md:p-10 shadow-2xl">
          <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-8">Cumulative Revenue Path <span className="text-blue-500">M-O-M Growth</span></h2>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.cumulativeRevenue}>
                <defs>
                  <linearGradient id="cumG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="day" stroke="#475569" fontSize={9} axisLine={false} tickLine={false} />
                <YAxis stroke="#475569" fontSize={9} axisLine={false} tickLine={false} tickFormatter={(v) => `R${v/1000}k`} />
                <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '20px' }} />
                <Area name="MTD Cumulative Revenue" type="stepAfter" dataKey="cumulative" stroke="#3b82f6" fill="url(#cumG)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Operational Efficiency Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Fixed Transaction Composition Pie */}
        <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-8 md:p-10 shadow-2xl flex flex-col">
          <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-4">Transaction Mix</h2>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.composition}
                  dataKey="value"
                  nameKey="label"
                  cx="50%" cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={8}
                >
                  {stats.composition.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={MOCK_CHART_COLORS[index % MOCK_CHART_COLORS.length]} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '20px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* SKU Risk Distribution */}
        <div className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-[3rem] p-8 md:p-10 shadow-2xl">
          <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-8">Inventory Risk Analysis: Top Performing SKUs</h2>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={stats.topProducts} 
                onClick={(e: any) => e && e.activePayload && handleBarClick(e.activePayload[0].payload)}
                margin={{ left: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="Description" stroke="#475569" fontSize={8} interval={0} angle={-15} textAnchor="end" height={60} axisLine={false} tickLine={false} />
                <YAxis stroke="#475569" fontSize={9} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '20px' }} />
                <Legend verticalAlign="top" align="right" iconType="rect" wrapperStyle={{ fontSize: '9px', fontWeight: 900 }} />
                <Bar name="Velocity (Qty Sold)" dataKey="sold" fill="#10b981" radius={[6, 6, 0, 0]} barSize={20} />
                <Bar name="Stock Balance" dataKey="stock" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-center text-[9px] font-black text-slate-600 uppercase mt-4 tracking-widest italic animate-pulse">Select bar for AI context</p>
        </div>
      </div>

      {/* Drill-down Intelligence Modal */}
      {drillDown && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-emerald-500/30 w-full max-w-3xl rounded-[3rem] p-12 relative shadow-2xl">
            <button onClick={() => setDrillDown(null)} className="absolute top-10 right-10 text-slate-500 hover:text-white text-3xl font-black transition-all transform hover:rotate-90">✕</button>
            <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">Live SKU Pulse</h3>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-8 leading-none">{drillDown.title}</h2>
            
            <div className="grid grid-cols-3 gap-8 mb-12">
              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 text-center">
                <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Stock Position</p>
                <p className="text-4xl font-black text-white">{drillDown.data.stock}</p>
              </div>
              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 text-center">
                <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Monthly Velocity</p>
                <p className="text-4xl font-black text-emerald-400">{drillDown.data.sold}</p>
              </div>
              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 text-center">
                <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Unit Value</p>
                <p className="text-4xl font-black text-blue-400">R{Math.round(drillDown.data.avgPrice)}</p>
              </div>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 p-10 rounded-[2.5rem]">
              <p className="text-[11px] font-black text-emerald-500 uppercase tracking-widest mb-4">Strategic Product Outcome</p>
              <p className="text-slate-100 text-xl leading-relaxed italic font-medium">
                {drillDown.insight}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
