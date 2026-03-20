
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import { AppSection } from './types';
import { DEFAULT_BRIDGE_URL } from './constants';
import { DOMAIN_MAPPINGS } from './metadata_mappings';
import { initSchema } from './services/geminiService';

export type ConnStatus = 'testing' | 'online' | 'db_error' | 'offline';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem('og_auth') === 'true');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState(false);
  const [activeSection, setActiveSection] = useState<AppSection>(AppSection.DASHBOARD);
  const [connStatus, setConnStatus] = useState<ConnStatus>('testing');
  const [lastError, setLastError] = useState<string | null>(null);
  const [bridgeUrl, setBridgeUrl] = useState(localStorage.getItem('og_bridge_url') || DEFAULT_BRIDGE_URL);
  const [detectedSchema, setDetectedSchema] = useState<Record<string, string[]>>({});
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const checkConnection = useCallback(async (urlOverride?: string) => {
    // Logic: if urlOverride/bridgeUrl is empty, use relative path '/api'.
    const baseUrl = (urlOverride || bridgeUrl || "").replace(/\/$/, "");
    const pingUrl = baseUrl ? `${baseUrl}/api/ping` : '/api/ping';
    const healthUrl = baseUrl ? `${baseUrl}/api/health` : '/api/health';
    
    setConnStatus('testing');
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); 

      const pingRes = await fetch(pingUrl, { 
        headers: { 'ngrok-skip-browser-warning': '69420' },
        signal: controller.signal
      }).catch(() => null);

      clearTimeout(timeoutId);

      if (!pingRes || !pingRes.ok) {
        setConnStatus('offline');
        setLastError("Bridge link timeout. Verify endpoint.");
        return;
      }

      const healthRes = await fetch(healthUrl, { 
          headers: { 'ngrok-skip-browser-warning': '69420' } 
      });
      const healthData = await healthRes.json();
      
      if (healthData.db_connected) {
        setConnStatus('online');
        // Only save if user explicitly typed a URL. If empty (default), keep it empty.
        if (urlOverride) localStorage.setItem('og_bridge_url', baseUrl);
        
        setLastError(null);
        
        initSchema(baseUrl).then(schemaResult => {
          if (schemaResult.data && typeof schemaResult.data === 'object') {
            setDetectedSchema(schemaResult.data);
          }
          if (schemaResult.error) setLastError(schemaResult.error);
        });
      } else {
        setConnStatus('db_error');
        setLastError(`SQL link failure: ${healthData.error}`);
      }
    } catch (err: any) {
      setConnStatus('offline');
      setLastError("Hybrid link interference detected.");
    }
  }, [bridgeUrl]);

  useEffect(() => { checkConnection(); }, [checkConnection]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'UltiSales2024') {
      setIsAuthenticated(true);
      localStorage.setItem('og_auth', 'true');
      setAuthError(false);
    } else {
      setAuthError(true);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 font-sans p-6">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-10 rounded-[3rem] shadow-2xl space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 mx-auto mb-4">
              <span className="text-2xl">🛡️</span>
            </div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Secure Access</h2>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] italic">OgradyCore Intelligence Node</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Access Key</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full bg-black/40 border ${authError ? 'border-rose-500/50' : 'border-slate-700'} rounded-2xl px-6 py-4 text-sm font-mono text-emerald-400 focus:outline-none focus:border-emerald-500/50 transition-all`}
                autoFocus
              />
              {authError && <p className="text-[9px] text-rose-500 font-bold uppercase tracking-widest ml-1 animate-pulse">Invalid Access Key. Access Denied.</p>}
            </div>
            <button type="submit" className="w-full py-5 bg-emerald-600 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-900/20">Initialize Session</button>
          </form>
          
          <p className="text-center text-[8px] text-slate-600 font-bold uppercase tracking-widest">Authorized Personnel Only</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeSection) {
      case AppSection.DASHBOARD: return <Dashboard bridgeUrl={bridgeUrl} isOnline={connStatus === 'online'} />;
      case AppSection.ANALYST_CHAT: return <ChatInterface />;
      case AppSection.DATA_EXPLORER:
        return (
          <div className="p-8 md:p-16 max-w-6xl mx-auto space-y-16 overflow-y-auto h-full pb-32 custom-scrollbar">
            <div className="text-center">
              <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Diagnostic Core</h2>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2 italic">Hybrid Analysis v4.4</p>
            </div>

            <div className="grid md:grid-cols-1 gap-8 max-w-2xl mx-auto">
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-emerald-500 uppercase tracking-widest">Active Endpoint</h3>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => {
                          const baseUrl = (bridgeUrl || "").replace(/\/$/, "");
                          const endpoint = baseUrl ? `${baseUrl}/api/refresh_schema` : '/api/refresh_schema';
                          fetch(endpoint, { method: 'POST', headers: { 'ngrok-skip-browser-warning': 'true' } })
                            .then(() => checkConnection(bridgeUrl));
                        }}
                        className="text-[8px] font-black text-emerald-500 hover:text-emerald-400 uppercase border border-emerald-500/20 px-2 py-0.5 rounded transition-colors bg-emerald-500/5"
                      >
                        🔄 Refresh Schema
                      </button>
                      {connStatus === 'offline' && (
                        <a 
                          href={bridgeUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[8px] font-black text-slate-500 hover:text-emerald-400 uppercase border border-slate-800 px-2 py-0.5 rounded transition-colors"
                        >
                          Open Debug Link ↗
                        </a>
                      )}
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                        connStatus === 'online' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'
                      }`}>
                        {connStatus}
                      </span>
                    </div>
                  </div>
                  <input 
                    type="text" 
                    value={bridgeUrl} 
                    placeholder="Leave empty for local automatic mode"
                    onChange={(e) => setBridgeUrl(e.target.value)} 
                    className="w-full bg-black/40 border border-slate-700 rounded-xl px-5 py-4 text-sm font-mono text-emerald-400 focus:outline-none focus:border-emerald-500/50" 
                  />
                  <button onClick={() => checkConnection(bridgeUrl)} className="w-full py-4 bg-emerald-600 text-white font-black uppercase text-[10px] rounded-xl hover:bg-emerald-500 transition-all">Verify Connection</button>
                </div>

              {lastError && (
                <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-2xl animate-in fade-in">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-2">Alert Buffer</h4>
                  <p className="text-xs font-mono text-rose-400/80 leading-relaxed">{lastError}</p>
                </div>
              )}
            </div>

            {/* SQL Deployment Section */}
            <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] shadow-2xl space-y-8">
               <div className="flex items-center justify-between">
                 <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">🛠️ SQL Foundation Fix (V4)</h3>
                 <span className="px-3 py-1 bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase rounded-full border border-amber-500/20">Architect Override Required</span>
               </div>

               <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl">
                 <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">⚠️ Critical Fix for "Invalid Column Name" Errors</p>
                 <p className="text-rose-400 text-[10px] leading-relaxed">
                   If you see errors like <code className="bg-rose-500/20 px-1 rounded">Invalid column name 'PrevYearRev'</code>, it means your database views are out of sync. 
                   Please <strong>re-run all scripts below</strong> in your SQL Server Management Studio (SSMS) to ensure the latest CEO Semantic Layer is active.
                 </p>
               </div>
               
               <p className="text-xs text-slate-400 leading-relaxed">
                 To resolve the <b>42S22 projection gap</b> and enable Five-Nines accuracy, the foundation views must be re-deployed with exposed time columns.
               </p>

               <div className="bg-slate-950 p-6 rounded-[2rem] border border-slate-800 font-mono text-[10px] space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
                 <div className="space-y-2">
                   <p className="text-emerald-500 font-bold">-- 1. THE CORE ENGINE: v_AI_Sales_Truth</p>
                   <pre className="text-slate-500 whitespace-pre-wrap">
{`CREATE OR ALTER VIEW dbo.v_AI_Sales_Truth AS
WITH LineCalculations AS (
    SELECT 
        A.ANUMBER AS SiteID,
        A.TRANSACTIONDATE AS TranDate,
        CASE WHEN MONTH(A.TRANSACTIONDATE) < 3 THEN YEAR(A.TRANSACTIONDATE) - 1 ELSE YEAR(A.TRANSACTIONDATE) END AS FiscalYear,
        YEAR(A.TRANSACTIONDATE) AS CalYear,
        MONTH(A.TRANSACTIONDATE) AS CalMonth,
        A.TransactionNumber AS InvoiceNumber,
        A.PLUCode,
        A.Description AS ProductName,
        A.Description2 AS PackSize,
        LTRIM(RTRIM(A.DebtorOrCreditorNumber)) AS AccountCode,
        A.TransactionType,
        CAST(A.QTY AS DECIMAL(38,4)) AS QTY,
        CAST(A.COSTPRICEEXCL AS DECIMAL(38,4)) AS COSTPRICEEXCL,
        FLOOR((CAST(A.RETAILPRICEEXCL AS DECIMAL(38,4)) * 100) + 0.501) / 100.0 AS _RoundedPrice,
        (1 - CAST(ISNULL(A.LINEDISCOUNTPERC,0) AS DECIMAL(38,4))/100.0) AS _LineMult,
        (1 - (CASE WHEN A.TAXVALUE < 0 THEN 0 ELSE CAST(ISNULL(A.HEADDISCOUNTPERC,0) AS DECIMAL(38,4)) END)/100.0) AS _HeadMult,
        CAST(ISNULL(A.ROUNDVALUE, 0) AS DECIMAL(38,4)) / 100.0 AS _RoundAdj,
        CASE WHEN A.TransactionType IN ('57','66','67','68','70') THEN 1 
             WHEN A.TransactionType IN ('81','89','97','98') THEN -1 ELSE 0 END AS Multiplier
    FROM dbo.AUDIT A
)
SELECT 
    B.SiteID,
    B.TranDate,
    B.FiscalYear,
    B.CalYear,
    B.CalMonth,
    (B.CalYear * 100) + B.CalMonth AS TimeKey,
    B.InvoiceNumber,
    B.PLUCode,
    B.ProductName,
    B.PackSize,
    B.AccountCode,
    ISNULL(D.Surname, 'Cash Sale') AS BranchName,
    ISNULL(T_Rep.TYPE_DESCRIPTION, 'No Rep Assigned') AS SalesRepName,
    (B.QTY * B.Multiplier) AS NetQty,
    CAST(ROUND((((B._RoundedPrice * B._LineMult * B._HeadMult * B.QTY) - B._RoundAdj) * B.Multiplier), 2) AS DECIMAL(38,2)) AS Revenue,
    CAST(ROUND((B.COSTPRICEEXCL * B.QTY * B.Multiplier), 2) AS DECIMAL(38,2)) AS NetCost
FROM LineCalculations B
LEFT JOIN dbo.DEBTOR D ON B.AccountCode = LTRIM(RTRIM(D.Number)) AND B.SiteID = D.ANUMBER
LEFT JOIN dbo.TYPES T_Rep ON CAST(D.SalesRep AS VARCHAR) = T_Rep.TYPE_ID 
    AND T_Rep.TABLE_NAME = 'DEBTOR' AND T_Rep.TYPE_NAME = 'SALESREP'
WHERE B.Multiplier <> 0;`}
                   </pre>
                 </div>

                 <div className="space-y-2 pt-4 border-t border-slate-800">
                   <p className="text-emerald-500 font-bold">-- 2. TREND & COMPARISON: v_AI_Omnibus_Comparison</p>
                   <pre className="text-slate-500 whitespace-pre-wrap">
{`CREATE OR ALTER VIEW dbo.v_AI_Omnibus_Comparison AS
WITH AnnualStats AS (
    SELECT 
        BranchName,
        SalesRepName,
        ProductName,
        FiscalYear,
        SUM(Revenue) AS AnnualRev,
        SUM(NetQty) AS AnnualQty
    FROM dbo.v_AI_Sales_Truth
    GROUP BY BranchName, SalesRepName, ProductName, FiscalYear
)
SELECT 
    C.BranchName,
    C.SalesRepName,
    C.ProductName,
    C.FiscalYear,
    C.AnnualRev,
    C.AnnualQty,
    P.AnnualRev AS PrevYearRev,
    P.AnnualQty AS PrevYearQty,
    (C.AnnualRev - ISNULL(P.AnnualRev, 0)) AS RevenueVariance,
    CASE WHEN ISNULL(P.AnnualRev, 0) = 0 THEN 100 ELSE ((C.AnnualRev - P.AnnualRev) / P.AnnualRev) * 100 END AS GrowthPercentage
FROM AnnualStats C
LEFT JOIN AnnualStats P ON C.BranchName = P.BranchName AND C.SalesRepName = P.SalesRepName AND C.ProductName = P.ProductName AND C.FiscalYear = P.FiscalYear + 1;`}
                   </pre>
                 </div>

                 <div className="space-y-2 pt-4 border-t border-slate-800">
                   <p className="text-emerald-500 font-bold">-- 3. FORECASTING ENGINE: v_AI_Omnibus_Forecast_Master</p>
                   <pre className="text-slate-500 whitespace-pre-wrap">
{`CREATE OR ALTER VIEW dbo.v_AI_Omnibus_Forecast_Master AS
WITH MonthlyContext AS (
    SELECT 
        BranchName,
        SalesRepName,
        ProductName,
        TimeKey,
        SUM(Revenue) AS MonthlyRevenue,
        SUM(NetQty) AS MonthlyQty,
        LAG(SUM(Revenue), 1) OVER (PARTITION BY BranchName, SalesRepName, ProductName ORDER BY TimeKey) AS PrevMonthRev,
        LAG(SUM(Revenue), 12) OVER (PARTITION BY BranchName, SalesRepName, ProductName ORDER BY TimeKey) AS LastYearRevenue,
        AVG(SUM(Revenue)) OVER (PARTITION BY BranchName, SalesRepName, ProductName ORDER BY TimeKey ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS ProjectedRunRate
    FROM dbo.v_AI_Sales_Truth
    GROUP BY BranchName, SalesRepName, ProductName, TimeKey
)
SELECT 
    BranchName,
    SalesRepName,
    ProductName,
    TimeKey,
    MonthlyRevenue,
    MonthlyQty,
    PrevMonthRev,
    LastYearRevenue,
    ProjectedRunRate,
    CASE 
        WHEN LastYearRevenue IS NULL THEN 'NEW'
        WHEN MonthlyRevenue < LastYearRevenue THEN 'BELOW_SEASONAL_AVG'
        WHEN MonthlyRevenue > LastYearRevenue THEN 'EXCEEDING_SEASONAL_AVG'
        ELSE 'STABLE'
    END AS PerformanceStatus,
    CASE 
        WHEN MonthlyRevenue < PrevMonthRev THEN 'DECLINING'
        ELSE 'GROWING'
    END AS Momentum
FROM MonthlyContext;`}
                   </pre>
                 </div>

                 <div className="space-y-2 pt-4 border-t border-slate-800">
                   <p className="text-emerald-500 font-bold">-- 4. GRANT PERMISSIONS (42000 FIX)</p>
                   <pre className="text-slate-500 whitespace-pre-wrap">
{`GRANT SELECT ON dbo.v_AI_Sales_Truth TO [YourUser];
GRANT SELECT ON dbo.v_AI_Omnibus_Comparison TO [YourUser];
GRANT SELECT ON dbo.v_AI_Omnibus_Forecast_Master TO [YourUser];
-- Replace [YourUser] with the actual database user used by the OgradyBridge.`}
                   </pre>
                 </div>
               </div>

               <div className="bg-amber-500/5 border border-amber-500/20 p-6 rounded-2xl">
                 <p className="text-[10px] text-amber-500 font-black uppercase tracking-widest mb-2">Manual Execution Required</p>
                 <p className="text-xs text-slate-400/80 leading-relaxed">
                   Copy the SQL above and execute it in your <b>SQL Server Management Studio (SSMS)</b>. This will resolve the <b>42000 SELECT permission denied</b> error by granting the necessary access to the new views.
                 </p>
               </div>
            </div>

            {/* Service Management Section */}
            <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] shadow-2xl space-y-8">
               <div className="flex items-center justify-between">
                 <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">⚙️ Service Management (Headless Mode)</h3>
                 <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase rounded-full border border-emerald-500/20">Efficiency Protocol v1.0</span>
               </div>
               
               <div className="grid md:grid-cols-2 gap-8">
                 <div className="bg-black/40 p-8 rounded-[2rem] border border-slate-800/50 space-y-4">
                   <h4 className="text-xs font-black text-emerald-500 uppercase tracking-widest">Background Service (Windows)</h4>
                   <p className="text-[10px] text-slate-400 leading-relaxed font-medium">Run the bridge as a native Windows Service. No CMD windows, no manual starts. It starts automatically with your PC.</p>
                   <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[9px] text-slate-500">
                     <p className="text-rose-400 mb-2"># IMPORTANT: Right-click PowerShell and "Run as Administrator"</p>
                     <p className="text-emerald-400 mb-2"># Then run this command:</p>
                     <p>powershell -ExecutionPolicy Bypass -File setup_service.ps1</p>
                   </div>
                   <p className="text-[9px] text-slate-500 italic">Uses NSSM for high-reliability service management.</p>
                 </div>

                 <div className="bg-black/40 p-8 rounded-[2rem] border border-slate-800/50 space-y-4">
                   <h4 className="text-xs font-black text-emerald-500 uppercase tracking-widest">Cloud Connectivity (Ngrok)</h4>
                   <p className="text-[10px] text-slate-400 leading-relaxed font-medium">If you are accessing this app via the cloud, you need a tunnel to your local machine. The background task now supports Ngrok automatically.</p>
                   <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[9px] text-slate-500">
                     <p className="text-emerald-400 mb-2"># 1. Get your token from dashboard.ngrok.com</p>
                     <p className="text-emerald-400 mb-2"># 2. Run this in your bridge folder:</p>
                     <p className="text-white">echo YOUR_TOKEN_HERE {'>'} ngrok_config.txt</p>
                     <p className="text-emerald-400 mt-2"># 3. (Optional) For a static domain:</p>
                     <p className="text-white">echo unpanoplied-marianne-ciliately.ngrok-free.dev {'>'} ngrok_domain.txt</p>
                     <p className="text-emerald-400 mt-2"># 4. Restart the background task via Task Scheduler</p>
                   </div>
                   <p className="text-[9px] text-slate-500 italic">This ensures the cloud app can "see" your local SQL data.</p>
                 </div>
               </div>

               <div className="bg-emerald-500/5 border border-emerald-500/20 p-6 rounded-2xl">
                 <div className="flex items-center gap-3 mb-2">
                   <span className="text-lg">🚀</span>
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Seamless Integration Active</h4>
                 </div>
                 <p className="text-xs text-slate-400/80 leading-relaxed">The OgradyCore Intelligence Node is designed for "Zero-Touch" operation. Once the service is installed, the web app will automatically detect and connect to your SQL bridge whenever it's available.</p>
               </div>
            </div>

            {/* Knowledge Base Section */}
            <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] shadow-2xl space-y-8">
               <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">🧠 Knowledge Base (Mappings)</h3>
               <div className="grid md:grid-cols-2 gap-6">
                 {Object.entries(DOMAIN_MAPPINGS).map(([table, mappings]) => (
                   <div key={table} className="bg-black/40 p-6 rounded-2xl border border-slate-800/50">
                     <p className="text-xs font-black text-emerald-500 uppercase mb-4 tracking-widest border-b border-emerald-500/20 pb-2">{table} TABLE MAPPINGS</p>
                     <div className="space-y-4">
                       {Object.entries(mappings).map(([field, values]) => (
                         <div key={field}>
                           <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">{field}:</p>
                           <div className="flex flex-wrap gap-2">
                             {Object.entries(values as any).map(([id, desc]) => (
                               <span key={id} className="text-[9px] font-mono bg-slate-800/80 px-2 py-1 rounded text-slate-300 border border-slate-700">
                                 <b className="text-emerald-400">{id}</b>: {desc as string}
                               </span>
                             ))}
                           </div>
                         </div>
                       ))}
                     </div>
                   </div>
                 ))}
               </div>
            </div>

            {Object.keys(detectedSchema).length > 0 && (
              <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3rem] shadow-2xl space-y-6">
                 <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">📊 Production Schema Inventory</h3>
                 <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {Object.entries(detectedSchema).map(([table, cols]) => (
                     <div key={table} className="bg-black/40 p-5 rounded-2xl border border-slate-800">
                        <p className="text-[10px] font-black text-emerald-500 uppercase mb-3">{table}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {Array.isArray(cols) ? cols.map(c => (
                            <span key={c} className="text-[8px] font-mono bg-slate-800/50 px-1.5 py-0.5 rounded text-slate-400 border border-slate-700/30">{c}</span>
                          )) : <span className="text-[8px] text-rose-500 italic">Unreadable</span>}
                        </div>
                     </div>
                   ))}
                 </div>
              </div>
            )}
          </div>
        );
      default: return <Dashboard bridgeUrl={bridgeUrl} isOnline={connStatus === 'online'} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} connStatus={connStatus} />
      <main className="flex-1 overflow-hidden flex flex-col relative">
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 md:px-10 bg-slate-950/80 backdrop-blur-xl z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 text-slate-400">☰</button>
            <div className="flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full ${connStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'}`}></span>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">{connStatus === 'online' ? 'Hybrid Protocol Active' : 'Link Offline'}</span>
            </div>
          </div>
          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">OgradyCore v4.4</span>
        </header>
        <div className="flex-1 overflow-hidden relative">{renderContent()}</div>
      </main>
    </div>
  );
};

export default App;
