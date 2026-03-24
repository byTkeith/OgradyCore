
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis, Legend
} from 'recharts';
import { QueryResult } from '../types';
import { MOCK_CHART_COLORS } from '../constants';

interface VisualizerProps {
  result: QueryResult;
}

const Visualizer: React.FC<VisualizerProps> = ({ result }) => {
  const { data, visualizationType, xAxis, yAxis } = result;

  if (!data || data.length === 0) return null;

  // Key safety resolver for Recharts
  const resolveKeys = () => {
    const firstRow = data[0];
    const allKeys = Object.keys(firstRow);
    const findKey = (t: string) => allKeys.find(k => k.toLowerCase() === t.toLowerCase()) || null;
    
    const xKey = findKey(xAxis) || allKeys[0];
    const yKey = findKey(yAxis) || allKeys[1] || allKeys[0];
    return { xKey, yKey };
  };

  const { xKey, yKey } = resolveKeys();

  const tooltipFormatter = (value: any, name: string) => {
    if (typeof value === 'number') {
      const n = name.toLowerCase();
      if (n.includes('timekey') || n.includes('year') || n.includes('month')) {
        return [value, name];
      }
      if (n.includes('qty') || n.includes('quantity') || n.includes('stock')) {
        return [value.toLocaleString(), name];
      }
      if (n.includes('percent') || n.includes('%') || n.includes('pct') || n.includes('margin') || n.includes('variance') || n.includes('rate')) {
        return [`${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`, name];
      }
      return [`R ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, name];
    }
    return [value, name];
  };

  const yAxisFormatter = (value: any) => {
    if (typeof value === 'number') {
      const n = yKey.toLowerCase();
      if (n.includes('timekey') || n.includes('year') || n.includes('month')) {
        return String(value);
      }
      if (n.includes('qty') || n.includes('quantity') || n.includes('stock')) {
        return value.toLocaleString(undefined, { notation: "compact", compactDisplay: "short" });
      }
      if (n.includes('percent') || n.includes('%') || n.includes('pct') || n.includes('margin') || n.includes('variance') || n.includes('rate')) {
        return `${value}%`;
      }
      return `R ${value.toLocaleString(undefined, { notation: "compact", compactDisplay: "short" })}`;
    }
    return value;
  };

  // Handle Top 10 / Bottom 10 logic for large datasets
  const isLargeDataset = data.length > 15;
  const sortedData = [...data].sort((a, b) => (Number(b[yKey]) || 0) - (Number(a[yKey]) || 0));
  const top10 = sortedData.slice(0, 10);
  const bottom10 = sortedData.slice(-10).reverse(); // Reverse so smallest is last or first depending on preference, let's keep it consistent

  const renderChart = (chartData: any[], title?: string) => {
    switch (visualizationType) {
      case 'bar':
        return (
          <div className="h-full w-full flex flex-col">
            {title && <p className="text-[9px] font-bold text-slate-500 uppercase mb-2 text-center">{title}</p>}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey={xKey} stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={yAxisFormatter} stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                <Tooltip 
                  formatter={tooltipFormatter}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px' }}
                />
                <Bar dataKey={yKey} radius={[4, 4, 0, 0]} animationDuration={1500}>
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={MOCK_CHART_COLORS[index % MOCK_CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      case 'line':
        return (
          <div className="h-full w-full flex flex-col">
            {title && <p className="text-[9px] font-bold text-slate-500 uppercase mb-2 text-center">{title}</p>}
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey={xKey} stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={yAxisFormatter} stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                <Tooltip formatter={tooltipFormatter} contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px' }} />
                <Line 
                  type="monotone" 
                  dataKey={yKey} 
                  stroke="#10b981" 
                  strokeWidth={2} 
                  dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} 
                  activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} 
                  animationDuration={1500}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      case 'pie':
        return (
          <div className="h-full w-full flex flex-col">
            {title && <p className="text-[9px] font-bold text-slate-500 uppercase mb-2 text-center">{title}</p>}
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey={yKey}
                  nameKey={xKey}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                  animationDuration={1500}
                  label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                >
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={MOCK_CHART_COLORS[index % MOCK_CHART_COLORS.length]} stroke="rgba(0,0,0,0.3)" />
                  ))}
                </Pie>
                <Tooltip formatter={tooltipFormatter} contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px' }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '9px', paddingTop: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );
      case 'area':
        return (
          <div className="h-full w-full flex flex-col">
            {title && <p className="text-[9px] font-bold text-slate-500 uppercase mb-2 text-center">{title}</p>}
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVis" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey={xKey} stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={yAxisFormatter} stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                <Tooltip formatter={tooltipFormatter} contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px' }} />
                <Area type="monotone" dataKey={yKey} stroke="#3b82f6" fill="url(#colorVis)" strokeWidth={2} animationDuration={1500} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );
      default:
        return <div className="text-slate-500 italic text-center py-10">Unsupported visualization type.</div>;
    }
  };

  return (
    <div className="w-full bg-slate-900/40 rounded-3xl p-5 md:p-8 border border-slate-800/50 backdrop-blur-sm shadow-2xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Business Intelligence Core</h3>
          <p className="text-sm md:text-lg font-black text-slate-100 mt-1 capitalize tracking-tight leading-none">
            {visualizationType} Analysis: <span className="text-slate-400 font-medium italic">{yKey} by {xKey}</span>
          </p>
        </div>
      </div>

      {isLargeDataset ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="h-[300px] w-full bg-black/20 p-4 rounded-2xl border border-slate-800/50">
            {renderChart(top10, "Top 10 Performance")}
          </div>
          <div className="h-[300px] w-full bg-black/20 p-4 rounded-2xl border border-slate-800/50">
            {renderChart(bottom10, "Bottom 10 Performance")}
          </div>
        </div>
      ) : (
        <div className="h-[300px] md:h-[400px] w-full">
          {renderChart(data)}
        </div>
      )}
    </div>
  );
};

export default Visualizer;
