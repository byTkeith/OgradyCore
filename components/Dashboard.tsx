
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, Legend, PieChart, Pie
} from 'recharts';
import { DEFAULT_BRIDGE_URL, MOCK_CHART_COLORS, SALES_TRANSACTION_TYPES } from '../constants';
import { DOMAIN_MAPPINGS } from '../metadata_mappings';
import { generateStrategicBrief } from '../services/geminiService';

interface DetailedStats {
  salesYoY: any[];
  topAccounts: any[];
  enamelTrend: any[];
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
  const [aiBrief, setAiBrief] = useState("Synchronizing production data streams...");
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
      // 1. Get Base Reference Date
      const latestDateRes = await runQuery(`SELECT MAX(TransactionDate) as lastDate FROM dbo.AUDIT`);
      const lastDateStr = latestDateRes?.[0]?.lastDate;
      
      let refDate = lastDateStr ? new Date(lastDateStr) : new Date();
      if (isNaN(refDate.getTime())) refDate = new Date();
      const refDateIso = refDate.toISOString().split('T')[0];

      // Prepare safe string for SQL IN clause using the Expanded Sales Definition
      const salesTypesSql = `'${SALES_TRANSACTION_TYPES.join("','")}'`;

      // 2. Enamel Trends - The "Golden Path" Query
      // Uses correct column: D.Surname (not Name)
      const enamelTrendSql = `
        WITH RawEnamelData AS (
            SELECT 
                A.DebtorOrCreditorNumber,
                YEAR(A.TransactionDate) AS [SaleYear],
                ROUND(A.RetailPriceExcl * (1 - ISNULL(A.LineDiscountPerc, 0) / 100.0) * A.Qty, 2) AS [LineRevenue]
            FROM dbo.AUDIT A
            WHERE A.TransactionType IN (${salesTypesSql})
              AND A.TransactionDate >= DATEADD(year, -5, '${refDateIso}')
              AND A.DebtorOrCreditorNumber <> '0'
              AND (
                  UPPER(A.Description) LIKE '%ENAMEL%' 
                  OR UPPER(A.Description) LIKE '%GLOSS%' 
                  OR UPPER(A.Description) LIKE '%EGGSHELL%' 
                  OR UPPER(A.Description) LIKE '%QD%'
              )
        ),
        Top20BuyerIDs AS (
            SELECT TOP 20 
                DebtorOrCreditorNumber, 
                SUM(LineRevenue) AS [Total5YearSpend]
            FROM RawEnamelData
            GROUP BY DebtorOrCreditorNumber
            ORDER BY [Total5YearSpend] DESC
        )
        SELECT 
            ISNULL(D.Surname, 'Account: ' + R.DebtorOrCreditorNumber) AS [Customer],
            R.[SaleYear] AS [Year],
            SUM(R.LineRevenue) AS [Revenue],
            T.Total5YearSpend AS [TotalRev]
        FROM RawEnamelData R
        JOIN Top20BuyerIDs T ON R.DebtorOrCreditorNumber = T.DebtorOrCreditorNumber
        LEFT JOIN dbo.DEBTOR D ON R.DebtorOrCreditorNumber = D.Number
        GROUP BY 
            D.Surname, 
            R.DebtorOrCreditorNumber, 
            R.[SaleYear],
            T.Total5YearSpend
        ORDER BY 
            T.Total5YearSpend DESC, 
            [Customer] ASC, 
            [Year] DESC;
      `;

      // 3. YoY Growth (Trailing 30 Days)
      const yoySql = `
        SELECT DAY(TransactionDate) as day, 
        SUM(CASE WHEN TransactionDate >= DATEADD(day, -30, '${refDateIso}') THEN (Qty * RetailPriceExcl) ELSE 0 END) as currentYear, 
        SUM(CASE WHEN TransactionDate >= DATEADD(year, -1, DATEADD(day, -30, '${refDateIso}')) AND TransactionDate <= DATEADD(year, -1, '${refDateIso}') THEN (Qty * RetailPriceExcl) ELSE 0 END) as lastYear 
        FROM dbo.AUDIT 
        WHERE TransactionDate >= DATEADD(year, -1, DATEADD(day, -30, '${refDateIso}'))
        AND TransactionType IN (${salesTypesSql})
        GROUP BY DAY(TransactionDate)`;

      // 4. Sales Composition (Pie Chart) - Joining TYPES table for correct labels
      const compSql = `
        SELECT TOP 5 
            ISNULL(T.TYPE_DESCRIPTION, 'Type ' + CAST(A.TransactionType AS VARCHAR)) as label,
            COUNT(*) as value 
        FROM dbo.AUDIT A
        LEFT JOIN dbo.TYPES T ON T.TABLE_ID = 3 AND T.TYPE_NAME_ID = 4 AND T.TYPE_ID = CAST(A.TransactionType AS VARCHAR)
        WHERE A.TransactionDate >= DATEADD(day, -30, '${refDateIso}') 
        AND A.TransactionType IN (${salesTypesSql})
        GROUP BY T.TYPE_DESCRIPTION, A.TransactionType`;

      // 5. KPIs
      const kpiSql = `
        SELECT 
        (SELECT ISNULL(SUM(ROUND(Qty * RetailPriceExcl, 2)),0) FROM dbo.AUDIT WHERE TransactionDate >= DATEADD(day, -30, '${refDateIso}') AND TransactionType IN (${salesTypesSql})) as mRev, 
        (SELECT ISNULL(SUM(ROUND(Qty * RetailPriceExcl, 2)),0) FROM dbo.AUDIT WHERE TransactionDate >= DATEADD(year, -1, DATEADD(day, -30, '${refDateIso}')) AND TransactionDate <= DATEADD(year, -1, '${refDateIso}') AND TransactionType IN (${salesTypesSql})) as pRev, 
        (SELECT COUNT(DISTINCT ISNULL(DebtorOrCreditorNumber, '0')) FROM dbo.AUDIT WHERE TransactionDate >= DATEADD(day, -30, '${refDateIso}')) as activeCust, 
        (SELECT COUNT(*) FROM dbo.STOCK WHERE OnHand <= 5) as lowStock, 
        (SELECT ISNULL(AVG(RetailPriceExcl * Qty),0) FROM dbo.AUDIT WHERE TransactionDate >= DATEADD(day, -30, '${refDateIso}') AND TransactionType IN (${salesTypesSql})) as ticket`;

      const [yoy, enamels, compRaw, kpi] = await Promise.all([
        runQuery(yoySql), runQuery(enamelTrendSql), runQuery(compSql), runQuery(kpiSql)
      ]);

      // Process Composition Data
      const composition = Array.isArray(compRaw) ? compRaw.map((item: any) => ({
        label: item.label,
        value: item.value
      })) : [];

      const mRev = kpi[0]?.mRev || 0;
      const pRev = kpi[0]?.pRev || 1;
      const growth = ((mRev - pRev) / pRev) * 100;

      const newStats: DetailedStats = {
        salesYoY: Array.isArray(yoy) ? yoy.sort((a: any, b: any) => a.day - b.day) : [],
        topAccounts: [], 
        enamelTrend: Array.isArray(enamels) ? enamels : [],
        composition,
        activeDate: refDateIso,
        engine: 'SQL_MASTER_v7.2',
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
      <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
      <div className="text-center">
        <p className="text-xs font-black text-white uppercase tracking-widest">Bridging Ultisales MSSQL</p>
        <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-widest italic">v7.2 Intelligence Engine</p>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-10 max-w-[1600px] mx-auto space-y-10 overflow-y-auto h-full pb-32 custom-scrollbar">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-800 pb-10">
        <div>
          <div className="flex items-center gap-4 mb-2">
             <h1 className="text-4xl md:text-7xl font-black text-white uppercase tracking-tighter leading-none">Executive <span className="text-emerald-500 drop-shadow-[0_0_20px_rgba(16,185,129,0.4)]">BI Suite</span></h1>
             <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-[10px] font-black text-emerald-500 uppercase tracking-widest">v7.2 LIVE</span>
          </div>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.5em] mt-3">
            Active Pulse: <span className="text-emerald-400">{stats.activeDate}</span>
          </p>
        </div>
        <button onClick={fetchBIData} className="flex items-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95 group">
           {isRefreshing ? "Calculating Trends..." : "Refresh Engine"} <span className="group-hover:rotate-180 transition-transform duration-500">🔄</span>
        </button>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
        {[
          { label: "Trailing 30D Revenue", val: `R${stats.kpis.totalRevenue.toLocaleString()}`, icon: '💰', color: 'from-emerald-600/30 to-slate-900', text: 'text-emerald-400' },
          { label: "Growth Velocity", val: `${stats.kpis.growthRate > 0 ? '+' : ''}${stats.kpis.growthRate.toFixed(1)}%`, icon: '📈', color: 'from-blue-600/30 to-slate-900', text: 'text-blue-400' },
          { label: "Stock Alarms", val: stats.kpis.lowStockCount, icon: '⚠️', color: 'from-rose-600/30 to-slate-900', text: 'text-rose-400' },
          { label: "Avg Sale Value", val: `R${Math.round(stats.kpis.avgTicket)}`, icon: '🛒', color: 'from-amber-600/30 to-slate-900', text: 'text-amber-400' }
        ].map((kpi, i) => (
          <div key={i} className={`bg-slate-900/60 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group hover:border-emerald-500/50 transition-all backdrop-blur-md`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${kpi.color} opacity-20`}></div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-4 relative z-10">{kpi.label}</span>
            <div className="flex items-center justify-between relative z-10">
              <h3 className={`text-2xl md:text-4xl font-black ${kpi.text}`}>{kpi.val}</h3>
              <span className="text-4xl opacity-30 group-hover:opacity-100 transition-opacity transform group-hover:scale-110 duration-300">{kpi.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-[3.5rem] p-12 shadow-[0_0_80px_rgba(0,0,0,0.5)] relative overflow-hidden border-l-[12px] border-l-emerald-600">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none text-[15rem] font-black">AI</div>
        <div className="flex-1 space-y-6 relative z-10">
          <h2 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.6em]">Executive Analyst Brief</h2>
          <p className="text-slate-100 text-xl md:text-4xl font-bold italic leading-tight max-w-5xl tracking-tight drop-shadow-lg">"{aiBrief}"</p>
        </div>
      </div>

      {/* Strategic Enamel Insight Table - Enhanced v7.2 */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-[4rem] p-12 shadow-2xl backdrop-blur-2xl overflow-hidden">
         <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter border-l-6 border-blue-500 pl-8">Top 20 Enamel Buyers (5 Year Breakdown)</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2 ml-8 italic">Verified keyword search: Gloss, Eggshell, QD Enamels</p>
            </div>
         </div>
         <div className="overflow-x-auto">
           <table className="w-full text-left">
             <thead>
               <tr className="border-b border-slate-800">
                 <th className="pb-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Customer Profile</th>
                 <th className="pb-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Fiscal Year</th>
                 <th className="pb-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Annual Value</th>
                 <th className="pb-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Total (5YR)</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-800/30">
               {stats.enamelTrend.map((row, i) => {
                 const isFirstRowOfCustomer = i === 0 || row.Customer !== stats.enamelTrend[i-1].Customer;
                 return (
                   <tr key={i} className={`group hover:bg-slate-800/40 transition-all ${isFirstRowOfCustomer ? 'border-t-2 border-slate-800/80' : ''}`}>
                     <td className={`py-5 text-sm font-bold ${isFirstRowOfCustomer ? 'text-blue-400' : 'text-slate-600/50 italic'}`}>
                       {isFirstRowOfCustomer ? row.Customer : '↳'}
                     </td>
                     <td className="py-5 text-xs font-mono text-slate-400">{row.Year}</td>
                     <td className="py-5 text-sm font-black text-emerald-400 text-right">R{row.Revenue?.toLocaleString()}</td>
                     <td className="py-5 text-xs font-black text-slate-500 text-right">
                        {isFirstRowOfCustomer ? `R${row.TotalRev?.toLocaleString()}` : ''}
                     </td>
                   </tr>
                 );
               })}
               {stats.enamelTrend.length === 0 && (
                 <tr><td colSpan={4} className="py-20 text-center text-slate-600 font-black uppercase text-xs tracking-widest italic opacity-40">Scanning Transaction History...</td></tr>
               )}
             </tbody>
           </table>
         </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
        <div className="bg-slate-900/80 border border-slate-800 rounded-[4rem] p-12 shadow-2xl backdrop-blur-2xl">
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-12 border-l-6 border-emerald-500 pl-8">30-Day Fiscal Trajectory</h2>
          <div className="h-[450px]">
            {stats.salesYoY.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.salesYoY}>
                  <defs>
                    <linearGradient id="gCurr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.7}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="day" stroke="#475569" fontSize={11} axisLine={false} tickLine={false} tickMargin={15} />
                  <YAxis stroke="#475569" fontSize={11} axisLine={false} tickLine={false} tickFormatter={(v) => `R${v}`} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '32px', padding: '20px' }} />
                  <Area name="Current" type="monotone" dataKey="currentYear" stroke="#10b981" fill="url(#gCurr)" strokeWidth={6} />
                  <Area name="Previous" type="monotone" dataKey="lastYear" stroke="#334155" fill="transparent" strokeWidth={3} strokeDasharray="12 12" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-800 rounded-[3rem]">
                <p className="text-slate-600 text-sm font-black uppercase tracking-[0.2em] italic text-center px-12">Calibrating signals...</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-[4rem] p-12 shadow-2xl backdrop-blur-2xl">
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-12 border-l-6 border-blue-500 pl-8">Transaction Segmentation</h2>
          <div className="w-full h-[450px]">
            {stats.composition.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.composition} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={120} outerRadius={170} paddingAngle={12} cornerRadius={12}>
                    {stats.composition.map((_, index) => (<Cell key={`cell-${index}`} fill={MOCK_CHART_COLORS[index % MOCK_CHART_COLORS.length]} strokeWidth={0} />))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '32px' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', color: '#94a3b8', paddingTop: '40px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-800 rounded-[3rem]">
                <p className="text-slate-600 text-sm font-black uppercase tracking-[0.2em] italic opacity-50">Mapping clusters...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
