
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

  const renderChart = () => {
    switch (visualizationType) {
      case 'bar':
        return (
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey={xKey} stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip 
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '11px' }}
            />
            <Bar dataKey={yKey} radius={[4, 4, 0, 0]} animationDuration={1500}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={MOCK_CHART_COLORS[index % MOCK_CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        );
      case 'line':
        return (
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey={xKey} stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '11px' }} />
            <Line 
              type="monotone" 
              dataKey={yKey} 
              stroke="#10b981" 
              strokeWidth={3} 
              dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} 
              activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }} 
              animationDuration={1500}
            />
          </LineChart>
        );
      case 'pie':
        return (
          <PieChart>
            <Pie
              data={data}
              dataKey={yKey}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              innerRadius={window.innerWidth < 768 ? 40 : 60}
              outerRadius={window.innerWidth < 768 ? 80 : 100}
              paddingAngle={5}
              animationDuration={1500}
              label={({ name, percent }) => window.innerWidth > 768 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={MOCK_CHART_COLORS[index % MOCK_CHART_COLORS.length]} stroke="rgba(0,0,0,0.3)" />
              ))}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '11px' }} />
            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
          </PieChart>
        );
      case 'area':
        return (
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorVis" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey={xKey} stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '11px' }} />
            <Area type="monotone" dataKey={yKey} stroke="#3b82f6" fill="url(#colorVis)" strokeWidth={3} animationDuration={1500} />
          </AreaChart>
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
            {visualizationType} Distribution: <span className="text-slate-400 font-medium italic">{yKey} vs {xKey}</span>
          </p>
        </div>
      </div>
      <div className="h-[280px] md:h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Visualizer;
