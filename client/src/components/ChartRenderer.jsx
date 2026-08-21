import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { BarChart3, LineChart as LineIcon, PieChart as PieIcon } from 'lucide-react';

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', 
  '#06b6d4', '#84cc16', '#f97316', '#a855f7', '#6366f1'
];

export default function ChartRenderer({ config, chartType, data = [] }) {
  const [selectedType, setSelectedType] = useState('bar');

  useEffect(() => {
    const rawType = chartType || config?.chartType || 'bar';
    const cleanType = rawType.toLowerCase().replace(/ chart$/, '').trim();
    if (['bar', 'line', 'pie'].includes(cleanType)) {
      setSelectedType(cleanType);
    } else {
      setSelectedType('bar');
    }
  }, [chartType, config]);

  const targetRawData = config?.aggregatedData || data;

  if (!targetRawData || targetRawData.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm italic">
        No chartable data rows available.
      </div>
    );
  }

  // Convert numerical string values to Numbers for Recharts
  const formattedData = targetRawData.map(row => {
    const cleanRow = {};
    Object.keys(row).forEach(key => {
      const val = row[key];
      if (val !== null && val !== undefined && !isNaN(Number(val)) && typeof val !== 'boolean' && String(val).trim() !== '') {
        cleanRow[key] = Number(val);
      } else {
        cleanRow[key] = val;
      }
    });
    return cleanRow;
  });

  const sampleRow = formattedData[0] || {};
  const allKeys = Object.keys(sampleRow);

  // Identify numeric columns (excluding ID columns if other metrics exist)
  let numericKeys = allKeys.filter(k => {
    return formattedData.some(row => typeof row[k] === 'number' && !isNaN(row[k]) && !k.toLowerCase().endsWith('_id') && k.toLowerCase() !== 'id');
  });

  if (numericKeys.length === 0) {
    const anyNumeric = allKeys.filter(k => formattedData.some(row => typeof row[k] === 'number' && !isNaN(row[k])));
    if (anyNumeric.length > 0) numericKeys = anyNumeric;
  }

  let chartData = [];
  let xAxisKey = '';
  let yAxisKeys = [];
  let chartTitle = '';

  if (numericKeys.length > 0) {
    // 1. Dataset has Numeric metrics (e.g. GPA, Age, Salary, Amount, Count)
    chartData = formattedData;
    xAxisKey = config?.xAxisKey || allKeys.find(k => !numericKeys.includes(k)) || allKeys[0];
    yAxisKeys = numericKeys;
    const cleanMetricName = numericKeys.join(', ').replace(/_/g, ' ').toUpperCase();
    const cleanXName = xAxisKey.replace(/_/g, ' ').toUpperCase();
    chartTitle = config?.title || `${cleanMetricName} BY ${cleanXName}`;
  } else {
    // 2. Text-Only / Categorical Dataset (e.g. name + city, department + status, etc.)
    // Smart Categorical Grouping: Pick the text column with fewest unique values as the Category/Group Key (e.g. City over Name)
    let bestCategoryKey = allKeys[0];
    let minUniqueCount = Infinity;

    allKeys.forEach(key => {
      const uniqueVals = new Set(formattedData.map(r => String(r[key] || '').trim()));
      if (uniqueVals.size > 1 && uniqueVals.size < minUniqueCount) {
        minUniqueCount = uniqueVals.size;
        bestCategoryKey = key;
      }
    });

    // Frequency aggregation for the category key (e.g. City -> Student Count)
    const countsMap = {};
    formattedData.forEach(row => {
      const catVal = String(row[bestCategoryKey] || 'Unknown').trim();
      countsMap[catVal] = (countsMap[catVal] || 0) + 1;
    });

    const metricName = allKeys.length > 1 ? 'Student Count' : 'Count';
    chartData = Object.keys(countsMap).map(cat => ({
      [bestCategoryKey]: cat,
      [metricName]: countsMap[cat]
    }));

    xAxisKey = bestCategoryKey;
    yAxisKeys = [metricName];
    const categoryNameClean = bestCategoryKey.replace(/_/g, ' ').toUpperCase();
    chartTitle = `STUDENT COUNT BY ${categoryNameClean}`;
  }

  // Sort and limit data for clean presentation
  const sortedChartData = [...chartData].sort((a, b) => {
    const valA = Number(a[yAxisKeys[0]]) || 0;
    const valB = Number(b[yAxisKeys[0]]) || 0;
    return valB - valA;
  });

  const displayData = sortedChartData.slice(0, 15);
  const mainDataKey = yAxisKeys[0];

  // Pie Chart Slice Calculation
  let pieChartData = [];
  if (selectedType === 'pie') {
    if (sortedChartData.length > 8) {
      const topSlices = sortedChartData.slice(0, 7);
      const remaining = sortedChartData.slice(7);
      const otherSum = remaining.reduce((acc, curr) => acc + (Number(curr[mainDataKey]) || 0), 0);
      pieChartData = [
        ...topSlices,
        { [xAxisKey]: 'Others', [mainDataKey]: Number(otherSum.toFixed(2)) }
      ];
    } else {
      pieChartData = sortedChartData;
    }
  }

  return (
    <div className="bg-[#14161c] border border-slate-800/90 rounded-2xl p-6 shadow-xl">
      {/* Header & Chart Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            <span>{chartTitle}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Visual analysis of {xAxisKey.replace(/_/g, ' ')} distribution across query results
          </p>
        </div>

        {/* Chart Type Toggle Pills */}
        <div className="flex items-center space-x-1.5 bg-[#181a20] p-1.5 rounded-xl border border-slate-800 shadow-inner">
          <button
            type="button"
            onClick={() => setSelectedType('bar')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center space-x-2 ${
              selectedType === 'bar'
                ? 'bg-white text-black shadow-md font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Bar Chart</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedType('line')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center space-x-2 ${
              selectedType === 'line'
                ? 'bg-white text-black shadow-md font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LineIcon className="w-4 h-4" />
            <span>Line</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedType('pie')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center space-x-2 ${
              selectedType === 'pie'
                ? 'bg-white text-black shadow-md font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <PieIcon className="w-4 h-4" />
            <span>Pie</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full font-sans text-xs" style={{ height: '360px' }}>
        <ResponsiveContainer width="100%" height="100%">
          {selectedType === 'line' ? (
            <LineChart data={displayData} margin={{ top: 15, right: 30, left: 10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#232630" />
              <XAxis
                dataKey={xAxisKey}
                stroke="#64748b"
                tick={{ fill: '#cbd5e1', fontSize: 12, fontWeight: 600 }}
                interval={0}
                angle={-15}
                textAnchor="end"
              />
              <YAxis stroke="#64748b" tick={{ fill: '#cbd5e1', fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: '#181a20', borderColor: '#334155', color: '#f8fafc', borderRadius: '12px', fontWeight: 600 }} />
              <Legend wrapperStyle={{ paddingTop: '16px' }} />
              {yAxisKeys.map((key, i) => (
                <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} strokeWidth={3} dot={{ r: 6, fill: COLORS[i % COLORS.length] }} />
              ))}
            </LineChart>
          ) : selectedType === 'pie' ? (
            <PieChart margin={{ top: 15, right: 30, left: 10, bottom: 10 }}>
              <Pie
                data={pieChartData}
                dataKey={mainDataKey}
                nameKey={xAxisKey}
                cx="50%"
                cy="45%"
                outerRadius={110}
                innerRadius={40}
                paddingAngle={4}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              >
                {pieChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#181a20', borderColor: '#334155', color: '#f8fafc', borderRadius: '12px', fontWeight: 600 }} />
              <Legend wrapperStyle={{ paddingTop: '16px' }} />
            </PieChart>
          ) : (
            /* Bar Chart */
            <BarChart data={displayData} margin={{ top: 15, right: 30, left: 10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#232630" />
              <XAxis
                dataKey={xAxisKey}
                stroke="#64748b"
                tick={{ fill: '#cbd5e1', fontSize: 12, fontWeight: 600 }}
                interval={0}
                angle={-15}
                textAnchor="end"
              />
              <YAxis stroke="#64748b" tick={{ fill: '#cbd5e1', fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: '#181a20', borderColor: '#334155', color: '#f8fafc', borderRadius: '12px', fontWeight: 600 }} />
              <Legend wrapperStyle={{ paddingTop: '16px' }} />
              {yAxisKeys.map((key, i) => (
                <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[8, 8, 0, 0]} barSize={40} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
