
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
  const [aiBrief, setAiBrief] = useState("Analyzing market conditions...");
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

    const yoySql = `
      SELECT DAY(TransactionDate) as day,
             SUM(CASE WHEN YEAR(TransactionDate) = YEAR(GETDATE()) THEN (Qty * RetailPriceExcl) ELSE 0 END) as currentYear,
             SUM(CASE WHEN YEAR(TransactionDate) = YEAR(GETDATE()) - 1 THEN (Qty * RetailPriceExcl) ELSE 0 END) as lastYear
      FROM dbo.AUDIT WHERE MONTH(TransactionDate) = MONTH(GETDATE()) GROUP BY DAY(TransactionDate) ORDER BY day`;

    const topProdSql = `
      SELECT TOP 8 S.Description, SUM(A.Qty) as sold, MAX(S.OnHand) as stock, AVG(A.RetailPriceExcl) as avgPrice
      FROM dbo.AUDIT A JOIN dbo.STOCK S ON A.PLUCode = S.Barcode
      WHERE A.TransactionDate >= DATEADD(day, -30, GETDATE())
      GROUP BY S.Description ORDER BY sold DESC`;

    const compSql = `
      SELECT T.TYPE_DESCRIPTION as label, COUNT(*) as value
      FROM dbo.AUDIT A JOIN dbo.TYPES T ON A.TransactionType = CAST(T.TYPE_ID AS INT)
      WHERE T.TABLE_NAME = 'AUDIT' AND T.TYPE_NAME = 'TRANSACTIONTYPE'
      AND A.TransactionDate >= DATEADD(day, -7, GETDATE()) GROUP BY T.TYPE_DESCRIPTION`;

    const kpiSql = `
      SELECT (SELECT SUM(Qty * RetailPriceExcl) FROM dbo.AUDIT WHERE TransactionDate >= CAST(GETDATE() AS DATE)) as todayRev,
             (SELECT COUNT(DISTINCT DebtorOrCreditorNumber) FROM dbo.AUDIT WHERE TransactionDate >= DATEADD(day, -30, GETDATE())) as activeCust,
             (SELECT COUNT(*) FROM dbo.STOCK WHERE OnHand <= 5) as lowStock,
             (SELECT AVG(RetailPriceExcl * Qty) FROM dbo.AUDIT WHERE TransactionDate >= DATEADD(day, -30, GETDATE())) as ticket`;

    try {
      const [yoy, prod, comp, kpi] = await Promise.all([runQuery(yoySql), runQuery(topProdSql), runQuery(compSql), runQuery(kpiSql)]);
      const newStats = {
        salesYoY: yoy, topProducts: prod, composition: comp,
        kpis: {
          totalRevenue: kpi[0]?.todayRev || 0,
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

  useEffect(() => { fetchBIData(); }, [fetchBIData]);

  const handleBarClick = async (data: any) => {
    setDrillDown({ title: data.Description, data: data, insight: "Generating AI Deep Dive..." });
    const insight = await getDrilldownAnalysis(data);
    setDrillDown({ title: data.Description, data: data, insight });
  };

  const handleExport = () => window.print();

  if (!stats) return (
    <div className="flex flex-col items-center justify-center h-full space-y-4">
      <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Server Sync Active...</p>
    </div>
  );

  return (
    <div className="p-4 md:p-10 max-w-[1600px] mx-auto space-y-8 overflow-y-auto h-full pb-32 custom-scrollbar print:p-0">
      {/* Executive Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_12px_#10b981]"></span>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase leading-none">BI <span className="text-emerald-500">Master</span></h1>
          </div>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.4em]">Ultisales Intelligent Telemetry • Real-Time</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExport} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-slate-700">📂 Print Report</button>
          <button onClick={fetchBIData} disabled={isRefreshing} className={`p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-500 transition-all ${isRefreshing ? 'opacity-50 animate-spin' : 'hover:bg-emerald-500 hover:text-white'}`}>🔄</button>
        </div>
      </header>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[
          { label: "Today's Revenue", val: `R${stats.kpis.totalRevenue.toLocaleString()}`, icon: '💰', color: 'text-emerald-400' },
          { label: "30D Customers", val: stats.kpis.activeCustomers, icon: '👥', color: 'text-blue-400' },
          { label: "Stock Warnings", val: stats.kpis.lowStockCount, icon: '⚠️', color: 'text-rose-400' },
          { label: "Basket Average", val: `R${Math.round(stats.kpis.avgTicket)}`, icon: '🛒', color: 'text-amber-400' }
        ].map((kpi, i) => (
          <div key={i} className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/80 p-6 rounded-[2rem] hover:border-emerald-500/30 transition-all">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">{kpi.label}</span>
            <div className="flex items-center justify-between">
              <h3 className={`text-2xl md:text-3xl font-black ${kpi.color}`}>{kpi.val}</h3>
              <span className="text-xl opacity-50">{kpi.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Intelligence Row */}
      <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-8 md:p-10 shadow-2xl flex flex-col xl:flex-row gap-10 items-center overflow-hidden">
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20">
              <span className="text-emerald-500 text-sm">🧠</span>
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-tighter">Strategic Intelligence Briefing</h2>
          </div>
          <p className="text-slate-300 text-lg md:text-xl font-medium italic border-l-4 border-emerald-500 pl-6 py-1 leading-relaxed">
            "{aiBrief}"
          </p>
        </div>
        <div className="hidden xl:block h-24 w-px bg-slate-800"></div>
        <div className="flex gap-10">
          <div className="text-center">
            <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Growth Forecast</p>
            <p className="text-3xl font-black text-emerald-400">+12.4%</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Stock Health</p>
            <p className="text-3xl font-black text-blue-400">92%</p>
          </div>
        </div>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-8 md:p-10 shadow-2xl">
          <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter mb-8">Sales Velocity <span className="text-emerald-500">YoY Comparison</span></h2>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.salesYoY}>
                <defs>
                  <linearGradient id="curr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="day" stroke="#475569" fontSize={9} />
                <YAxis stroke="#475569" fontSize={9} tickFormatter={(v) => `R${v/1000}k`} />
                <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '16px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 900, paddingTop: '20px' }} />
                <Area name="Current Month" type="monotone" dataKey="currentYear" stroke="#10b981" fill="url(#curr)" strokeWidth={3} />
                <Area name="Prior Year" type="monotone" dataKey="lastYear" stroke="#475569" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-8 md:p-10 shadow-2xl">
          <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter mb-8">Inventory Risk <span className="text-blue-500">Direct Map</span></h2>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              {/* Fixed: Cast event parameter to any to resolve TypeScript property missing error on activePayload */}
              <BarChart data={stats.topProducts} onClick={(e: any) => e && e.activePayload && handleBarClick(e.activePayload[0].payload)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="Description" hide />
                <YAxis stroke="#475569" fontSize={9} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '16px' }} />
                <Legend iconType="rect" wrapperStyle={{ fontSize: '9px', fontWeight: 900 }} />
                <Bar name="Qty Sold (30D)" dataKey="sold" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar name="Stock On Hand" dataKey="stock" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-center text-[8px] text-slate-600 font-black uppercase mt-4">Tip: Click any bar to generate a SKU deep-dive report</p>
        </div>
      </div>

      {/* Drill-down Modal/Panel */}
      {drillDown && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-emerald-500/20 w-full max-w-2xl rounded-[3rem] p-10 relative shadow-[0_0_50px_rgba(16,185,129,0.1)]">
            <button onClick={() => setDrillDown(null)} className="absolute top-8 right-8 text-slate-500 hover:text-white text-2xl font-black transition-all">✕</button>
            <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">Live SKU Intelligence</h3>
            <h2 className="text-3xl font-black text-white tracking-tighter uppercase mb-6">{drillDown.title}</h2>
            
            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <p className="text-[9px] text-slate-500 font-black uppercase">OnHand</p>
                <p className="text-2xl font-black text-white">{drillDown.data.stock}</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <p className="text-[9px] text-slate-500 font-black uppercase">Sales Velocity</p>
                <p className="text-2xl font-black text-emerald-400">{(drillDown.data.sold/30).toFixed(1)}/day</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <p className="text-[9px] text-slate-500 font-black uppercase">Avg Price</p>
                <p className="text-2xl font-black text-blue-400">R{Math.round(drillDown.data.avgPrice)}</p>
              </div>
            </div>

            <div className="bg-emerald-500/5 border border-emerald-500/20 p-6 rounded-3xl">
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3">AI Contextual Analysis</p>
              <p className="text-slate-200 text-sm leading-relaxed italic">{drillDown.insight}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
