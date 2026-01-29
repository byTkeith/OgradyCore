
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
  const [aiBrief, setAiBrief] = useState("Analyzing server telemetry...");
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

    // Advanced YoY Query: Daily comparison for current month vs previous year same month
    const yoySql = `
      SELECT 
        DAY(TransactionDate) as day,
        SUM(CASE WHEN YEAR(TransactionDate) = YEAR(GETDATE()) THEN (Qty * RetailPriceExcl) ELSE 0 END) as currentYear,
        SUM(CASE WHEN YEAR(TransactionDate) = YEAR(GETDATE()) - 1 THEN (Qty * RetailPriceExcl) ELSE 0 END) as lastYear
      FROM dbo.AUDIT 
      WHERE MONTH(TransactionDate) = MONTH(GETDATE())
      AND YEAR(TransactionDate) IN (YEAR(GETDATE()), YEAR(GETDATE()) - 1)
      GROUP BY DAY(TransactionDate)
      ORDER BY day`;

    // Inventory Velocity vs Health: Top products sold vs their actual current stock levels
    const topProdSql = `
      SELECT TOP 8 
        S.Description, 
        SUM(A.Qty) as sold, 
        MAX(S.OnHand) as stock, 
        AVG(A.RetailPriceExcl) as avgPrice
      FROM dbo.AUDIT A 
      JOIN dbo.STOCK S ON A.PLUCode = S.Barcode
      WHERE A.TransactionDate >= DATEADD(day, -30, GETDATE())
      GROUP BY S.Description 
      ORDER BY sold DESC`;

    // Transaction Mix based on documentation TYPE mappings
    const compSql = `
      SELECT 
        T.TYPE_DESCRIPTION as label, 
        COUNT(*) as value
      FROM dbo.AUDIT A 
      JOIN dbo.TYPES T ON A.TransactionType = CAST(T.TYPE_ID AS INT)
      WHERE T.TABLE_NAME = 'AUDIT' AND T.TYPE_NAME = 'TRANSACTIONTYPE'
      AND A.TransactionDate >= DATEADD(day, -14, GETDATE()) 
      GROUP BY T.TYPE_DESCRIPTION`;

    // Real-time KPI aggregation
    const kpiSql = `
      SELECT 
        (SELECT SUM(Qty * RetailPriceExcl) FROM dbo.AUDIT WHERE TransactionDate >= CAST(GETDATE() AS DATE)) as todayRev,
        (SELECT COUNT(DISTINCT DebtorOrCreditorNumber) FROM dbo.AUDIT WHERE TransactionDate >= DATEADD(day, -30, GETDATE())) as activeCust,
        (SELECT COUNT(*) FROM dbo.STOCK WHERE OnHand <= 5) as lowStock,
        (SELECT AVG(RetailPriceExcl * Qty) FROM dbo.AUDIT WHERE TransactionDate >= DATEADD(day, -30, GETDATE())) as ticket`;

    try {
      const [yoy, prod, comp, kpi] = await Promise.all([
        runQuery(yoySql), 
        runQuery(topProdSql), 
        runQuery(compSql), 
        runQuery(kpiSql)
      ]);

      const newStats = {
        salesYoY: yoy, 
        topProducts: prod, 
        composition: comp,
        kpis: {
          totalRevenue: kpi[0]?.todayRev || 0,
          activeCustomers: kpi[0]?.activeCust || 0,
          lowStockCount: kpi[0]?.lowStock || 0,
          avgTicket: kpi[0]?.ticket || 0
        }
      };

      setStats(newStats);
      
      // Use AI to generate an immediate strategic brief of the current data
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
    setDrillDown({ title: data.Description, data: data, insight: "Connecting to AI Analyst for product deep-dive..." });
    const insight = await getDrilldownAnalysis(data);
    setDrillDown({ title: data.Description, data: data, insight });
  };

  const handleExport = () => window.print();

  if (!stats) return (
    <div className="flex flex-col items-center justify-center h-full space-y-4">
      <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Establishing Secure SQL Handshake...</p>
    </div>
  );

  return (
    <div className="p-4 md:p-10 max-w-[1600px] mx-auto space-y-8 overflow-y-auto h-full pb-32 custom-scrollbar print:p-0">
      {/* Dashboard Executive Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_12px_#10b981]"></span>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase leading-none">Management <span className="text-emerald-500">Command</span></h1>
          </div>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em]">Ultisales Real-Time BI Suite • Automated Insight v2.5</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExport} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-xl">📂 Export Full PDF Report</button>
          <button onClick={fetchBIData} disabled={isRefreshing} className={`p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-500 transition-all ${isRefreshing ? 'opacity-50 animate-spin' : 'hover:bg-emerald-500 hover:text-white'}`}>🔄</button>
        </div>
      </header>

      {/* Primary KPIs - Accurate Server Representations */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 print:grid-cols-4">
        {[
          { label: "Today's Revenue", val: `R${stats.kpis.totalRevenue.toLocaleString()}`, icon: '💰', color: 'text-emerald-400' },
          { label: "Active 30D Debtors", val: stats.kpis.activeCustomers, icon: '👥', color: 'text-blue-400' },
          { label: "Critical Stock Risk", val: stats.kpis.lowStockCount, icon: '⚠️', color: 'text-rose-400' },
          { label: "Average Basket", val: `R${Math.round(stats.kpis.avgTicket)}`, icon: '🛒', color: 'text-amber-400' }
        ].map((kpi, i) => (
          <div key={i} className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 p-6 rounded-[2rem] hover:border-emerald-500/30 transition-all group">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2 group-hover:text-emerald-500 transition-colors">{kpi.label}</span>
            <div className="flex items-center justify-between">
              <h3 className={`text-2xl md:text-3xl font-black ${kpi.color}`}>{kpi.val}</h3>
              <span className="text-xl opacity-30 group-hover:opacity-100 transition-all transform group-hover:scale-110">{kpi.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Intelligent Insights Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-8 md:p-10 shadow-2xl flex flex-col xl:flex-row gap-10 items-center overflow-hidden relative">
        <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none text-9xl">🧠</div>
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <span className="text-emerald-500 text-xl">💡</span>
            </div>
            <div>
               <h2 className="text-xl font-black text-white uppercase tracking-tighter leading-none">Executive Data Briefing</h2>
               <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest mt-1 italic">Generated from Live Server Telemetry</p>
            </div>
          </div>
          <p className="text-slate-200 text-lg md:text-2xl font-medium italic border-l-8 border-emerald-500 pl-8 py-2 leading-relaxed bg-white/5 rounded-r-3xl">
            "{aiBrief}"
          </p>
        </div>
      </div>

      {/* Visual Presentation Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        
        {/* YoY Performance Presentation */}
        <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-8 md:p-10 shadow-2xl group relative overflow-hidden">
          <div className="flex justify-between items-start mb-10">
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter">Sales Evolution <span className="text-emerald-500 italic">YoY Comparison</span></h2>
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1">Real-time Daily Performance Tracking</p>
            </div>
          </div>
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
                <Tooltip 
                   cursor={{ stroke: '#10b981', strokeWidth: 1 }}
                   contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '20px', fontSize: '11px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} 
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 900, paddingTop: '30px', textTransform: 'uppercase' }} />
                <Area name="Current Period (2025)" type="monotone" dataKey="currentYear" stroke="#10b981" fill="url(#curr)" strokeWidth={4} animationDuration={2000} />
                <Area name="Prior Period (2024)" type="monotone" dataKey="lastYear" stroke="#3b82f6" fill="url(#prev)" strokeWidth={2} strokeDasharray="5 5" animationDuration={2000} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Inventory Risk & Velocity Map */}
        <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-8 md:p-10 shadow-2xl relative">
          <div className="flex justify-between items-start mb-10">
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter">Inventory Risk <span className="text-rose-500">Heatmap</span></h2>
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1">Velocity (Last 30D) vs. Current OnHand</p>
            </div>
            <span className="text-[8px] bg-rose-500/10 text-rose-500 px-3 py-1.5 rounded-full font-black uppercase tracking-widest border border-rose-500/20">Action Required</span>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={stats.topProducts} 
                onClick={(e: any) => e && e.activePayload && handleBarClick(e.activePayload[0].payload)}
                margin={{ bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="Description" stroke="#475569" fontSize={8} interval={0} angle={-15} textAnchor="end" height={60} axisLine={false} tickLine={false} />
                <YAxis stroke="#475569" fontSize={9} axisLine={false} tickLine={false} />
                <Tooltip 
                   cursor={{ fill: 'rgba(255,255,255,0.03)' }} 
                   contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '20px' }} 
                />
                <Legend verticalAlign="top" align="right" iconType="rect" wrapperStyle={{ fontSize: '9px', fontWeight: 900, paddingBottom: '20px' }} />
                <Bar name="Velocity (Qty Sold)" dataKey="sold" fill="#10b981" radius={[6, 6, 0, 0]} barSize={25} animationDuration={2000} />
                <Bar name="Stock Balance" dataKey="stock" fill="#ef4444" radius={[6, 6, 0, 0]} barSize={25} animationDuration={2000} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="absolute bottom-10 left-0 right-0 text-center pointer-events-none">
             <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic animate-pulse">Click any product bar for AI-driven drill-down analysis</p>
          </div>
        </div>
      </div>

      {/* Drill-down Intelligence Modal */}
      {drillDown && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-emerald-500/30 w-full max-w-3xl rounded-[3rem] p-12 relative shadow-[0_0_100px_rgba(16,185,129,0.2)]">
            <button onClick={() => setDrillDown(null)} className="absolute top-10 right-10 text-slate-500 hover:text-white text-3xl font-black transition-all transform hover:rotate-90">✕</button>
            <div className="flex items-center gap-4 mb-4">
               <span className="px-4 py-2 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">SKU Intelligence Probe</span>
            </div>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase mb-8 leading-none">{drillDown.title}</h2>
            
            <div className="grid grid-cols-3 gap-8 mb-12">
              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 flex flex-col items-center justify-center">
                <p className="text-[10px] text-slate-500 font-black uppercase mb-2">Current Stock</p>
                <p className="text-4xl font-black text-white">{drillDown.data.stock}</p>
              </div>
              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 flex flex-col items-center justify-center">
                <p className="text-[10px] text-slate-500 font-black uppercase mb-2">30D Velocity</p>
                <p className="text-4xl font-black text-emerald-400">{drillDown.data.sold}</p>
              </div>
              <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 flex flex-col items-center justify-center">
                <p className="text-[10px] text-slate-500 font-black uppercase mb-2">Unit Value</p>
                <p className="text-4xl font-black text-blue-400">R{Math.round(drillDown.data.avgPrice)}</p>
              </div>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 p-10 rounded-[2.5rem] relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-10 text-6xl group-hover:rotate-12 transition-transform">🤖</div>
              <p className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.3em] mb-4">Analyst Strategic Deep-Dive</p>
              <p className="text-slate-100 text-xl leading-relaxed italic font-medium">
                {drillDown.insight}
              </p>
              <div className="mt-8 pt-8 border-t border-emerald-500/10 flex justify-between items-center">
                 <p className="text-[10px] text-slate-500 font-bold uppercase italic">Linked Data: dbo.STOCK, dbo.AUDIT_LOG</p>
                 <button className="text-emerald-500 text-[10px] font-black uppercase tracking-widest hover:underline">View Transaction Log →</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
