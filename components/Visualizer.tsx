
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, ScatterChart, Scatter
} from 'recharts';
import { QueryResult } from '../types';
import { MOCK_CHART_COLORS } from '../constants';

interface VisualizerProps {
  result: QueryResult;
}

const Visualizer: React.FC<VisualizerProps> = ({ result }) => {
  const { data, visualizationType, xAxis, yAxis } = result;

  const renderChart = () => {
    switch (visualizationType) {
      case 'bar':
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey={xAxis} stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#f8fafc' }}
              itemStyle={{ color: '#10b981' }}
            />
            <Bar dataKey={yAxis} fill="#10b981" radius={[6, 6, 0, 0]} />
          </BarChart>
        );
      case 'line':
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey={xAxis} stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
            />
            <Line type="monotone" dataKey={yAxis} stroke="#10b981" strokeWidth={4} dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, strokeWidth: 0 }} />
          </LineChart>
        );
      case 'area':
        return (
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorGreen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey={xAxis} stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }} />
            <Area type="monotone" dataKey={yAxis} stroke="#10b981" fillOpacity={1} fill="url(#colorGreen)" strokeWidth={3} />
          </AreaChart>
        );
      case 'pie':
        return (
          <PieChart>
            <Pie
              data={data}
              dataKey={yAxis}
              nameKey={xAxis}
              cx="50%"
              cy="50%"
              outerRadius={80}
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={MOCK_CHART_COLORS[index % MOCK_CHART_COLORS.length]} stroke="rgba(0,0,0,0.1)" />
              ))}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }} />
          </PieChart>
        );
      default:
        return <div className="text-slate-500 italic text-sm">Visualizing data...</div>;
    }
  };

  return (
    <div className="w-full bg-slate-950/40 rounded-2xl p-6 border border-slate-800/50 backdrop-blur-sm shadow-inner">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Statistical Projection</h3>
          <p className="text-sm font-bold text-slate-200 mt-1">{yAxis} distribution by {xAxis}</p>
        </div>
        <div className="flex gap-2">
           <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20 font-black tracking-tighter uppercase">
            Live Feed
          </span>
        </div>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Visualizer;
