import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  BarChart3, LineChart as LineIcon, PieChart as PieIcon,
  Table as TableIcon, Sparkles, Download, Filter, RotateCcw,
  Sun, Moon, Layers, Maximize2, Minimize2, CheckCircle2, ArrowUpRight, TrendingUp
} from 'lucide-react';
import PowerBIExportModal from './PowerBIExportModal';

const COLOR_PALETTE = [
  '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899',
  '#06b6d4', '#f97316', '#84cc16', '#a855f7', '#6366f1'
];

export default function PowerBIDashboard({
  data = [],
  fields = [],
  question = 'Automated Power BI Dashboard',
  sql = '',
  dataSourceId = null
}) {
  const [theme, setTheme] = useState('dark'); // 'dark' | 'light'
  const [activeFilterCategory, setActiveFilterCategory] = useState(null); // Cross-filter state
  const [searchFilter, setSearchFilter] = useState('');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Normalize raw table rows into numeric & string properties
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map(row => {
      const cleanRow = {};
      Object.keys(row).forEach(key => {
        const val = row[key];
        if (val !== null && val !== undefined && !isNaN(Number(val)) && typeof val !== 'boolean' && String(val).trim() !== '') {
          cleanRow[key] = Number(val);
        } else {
          cleanRow[key] = val !== null && val !== undefined ? String(val) : '';
        }
      });
      return cleanRow;
    });
  }, [data]);

  // Determine key metrics & dimension keys automatically
  const keysAnalysis = useMemo(() => {
    if (processedData.length === 0) return { dimensionKey: 'category', metricKeys: [], numericKey: null };

    const sample = processedData[0];
    const allKeys = fields && fields.length > 0
      ? fields.map(f => (typeof f === 'string' ? f : (f?.name || String(f))))
      : Object.keys(sample);

    const numericKeys = allKeys.filter(k => {
      return processedData.some(r => typeof r[k] === 'number' && !isNaN(r[k]) && !k.toLowerCase().endsWith('_id') && k.toLowerCase() !== 'id');
    });

    const nonNumericKeys = allKeys.filter(k => !numericKeys.includes(k));

    const dimensionKey = nonNumericKeys.length > 0 ? nonNumericKeys[0] : (allKeys[0] || 'category');
    const primaryMetricKey = numericKeys.length > 0 ? numericKeys[0] : null;

    return {
      allKeys,
      dimensionKey,
      metricKeys: numericKeys,
      primaryMetricKey
    };
  }, [processedData, fields]);

  const { dimensionKey, primaryMetricKey, metricKeys, allKeys } = keysAnalysis;

  // Filtered dataset according to active cross-filtering slice & search
  const filteredData = useMemo(() => {
    let result = [...processedData];

    if (activeFilterCategory) {
      result = result.filter(row => String(row[dimensionKey]) === String(activeFilterCategory));
    }

    if (searchFilter.trim()) {
      const term = searchFilter.toLowerCase().trim();
      result = result.filter(row => {
        return Object.values(row).some(v => String(v).toLowerCase().includes(term));
      });
    }

    return result;
  }, [processedData, activeFilterCategory, searchFilter, dimensionKey]);

  // Aggregate stats for KPI cards
  const kpiStats = useMemo(() => {
    const totalRows = filteredData.length;
    let metricSum = 0;
    let metricAvg = 0;
    let metricMax = 0;
    let metricMin = Infinity;

    if (primaryMetricKey && totalRows > 0) {
      const values = filteredData.map(r => Number(r[primaryMetricKey]) || 0);
      metricSum = values.reduce((a, b) => a + b, 0);
      metricAvg = metricSum / totalRows;
      metricMax = Math.max(...values);
      metricMin = Math.min(...values);
    }

    const uniqueCategories = new Set(filteredData.map(r => String(r[dimensionKey]))).size;

    return {
      totalRows,
      metricSum: metricSum % 1 === 0 ? metricSum : metricSum.toFixed(2),
      metricAvg: metricAvg.toFixed(2),
      metricMax: metricMax === -Infinity ? 0 : (metricMax % 1 === 0 ? metricMax : metricMax.toFixed(2)),
      metricMin: metricMin === Infinity ? 0 : (metricMin % 1 === 0 ? metricMin : metricMin.toFixed(2)),
      uniqueCategories
    };
  }, [filteredData, primaryMetricKey, dimensionKey]);

  // Chart data aggregation for Bar & Pie visuals
  const chartGroupedData = useMemo(() => {
    if (processedData.length === 0) return [];

    const map = {};
    processedData.forEach(row => {
      const cat = String(row[dimensionKey] || 'Other');
      const val = primaryMetricKey ? (Number(row[primaryMetricKey]) || 0) : 1;
      map[cat] = (map[cat] || 0) + val;
    });

    const sorted = Object.keys(map).map(cat => ({
      [dimensionKey]: cat,
      [primaryMetricKey || 'Count']: map[cat]
    })).sort((a, b) => (b[primaryMetricKey || 'Count'] - a[primaryMetricKey || 'Count']));

    return sorted;
  }, [processedData, dimensionKey, primaryMetricKey]);

  const topChartData = chartGroupedData.slice(0, 10);
  const metricLabel = (primaryMetricKey || 'Count').replace(/_/g, ' ').toUpperCase();
  const dimensionLabel = (dimensionKey || 'Category').replace(/_/g, ' ').toUpperCase();

  // Reset cross filter
  const handleResetFilter = () => {
    setActiveFilterCategory(null);
    setSearchFilter('');
  };

  const isDark = theme === 'dark';

  return (
    <div className={`rounded-3xl border transition-all duration-300 ${
      isDark ? 'bg-[#0f111a] border-amber-500/30 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
    } ${isFullScreen ? 'fixed inset-0 z-50 p-6 overflow-y-auto' : 'p-6 shadow-2xl'}`}>

      {/* Top Automated Power BI Navigation Bar */}
      <div className={`p-4 rounded-2xl border mb-6 flex flex-wrap items-center justify-between gap-4 ${
        isDark ? 'bg-[#181b29] border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-extrabold text-xl shadow-inner">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight">Automated Power BI Dashboard</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                Live Embed Engine
              </span>
            </div>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'} font-medium`}>
              Query: <span className="text-amber-400 font-semibold">{question}</span>
            </p>
          </div>
        </div>

        {/* Action Controls & Toolbar */}
        <div className="flex flex-wrap items-center space-x-2">
          {activeFilterCategory && (
            <button
              onClick={handleResetFilter}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 hover:bg-amber-500/30 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filter ({activeFilterCategory})</span>
            </button>
          )}

          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`p-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
              isDark ? 'bg-[#222638] border-slate-700 text-amber-400 hover:bg-slate-800' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
            }`}
            title="Toggle Dashboard Theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className={`p-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
              isDark ? 'bg-[#222638] border-slate-700 text-slate-300 hover:bg-slate-800' : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
            }`}
            title="Toggle Fullscreen"
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setIsExportModalOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs rounded-xl flex items-center space-x-2 transition cursor-pointer shadow-md"
          >
            <Sparkles className="w-4 h-4" />
            <span>Power BI Export & Sync</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-[#181b29] border-slate-800/90' : 'bg-white border-slate-200'} shadow-md`}>
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
            <span>Total Records</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-indigo-400">{kpiStats.totalRows}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">Answer dataset rows</div>
        </div>

        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-[#181b29] border-slate-800/90' : 'bg-white border-slate-200'} shadow-md`}>
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
            <span>Total {metricLabel}</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400">{kpiStats.metricSum}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">Sum of numeric measure</div>
        </div>

        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-[#181b29] border-slate-800/90' : 'bg-white border-slate-200'} shadow-md`}>
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
            <span>Average {metricLabel}</span>
            <ArrowUpRight className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-amber-400">{kpiStats.metricAvg}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">Mean metric value</div>
        </div>

        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-[#181b29] border-slate-800/90' : 'bg-white border-slate-200'} shadow-md`}>
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
            <span>Unique {dimensionLabel}</span>
            <CheckCircle2 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-extrabold text-purple-400">{kpiStats.uniqueCategories}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">Dimension categories</div>
        </div>
      </div>

      {/* Main Multi-Visual Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        
        {/* Visual 1: Bar Chart (Occupies 2 columns) */}
        <div className={`lg:col-span-2 p-5 rounded-2xl border ${isDark ? 'bg-[#181b29] border-slate-800' : 'bg-white border-slate-200'} shadow-md flex flex-col justify-between`}>
          <div className="flex items-center justify-between mb-4 border-b pb-3 border-slate-800/60">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-400" />
                <span>{metricLabel} by {dimensionLabel}</span>
              </h3>
              <p className="text-xs text-slate-400">Click any column bar to cross-filter the dashboard visuals</p>
            </div>
            {activeFilterCategory && (
              <span className="text-xs bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg font-mono">
                Filtered: {activeFilterCategory}
              </span>
            )}
          </div>

          <div className="w-full" style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topChartData} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#232736' : '#e2e8f0'} />
                <XAxis
                  dataKey={dimensionKey}
                  stroke={isDark ? '#94a3b8' : '#64748b'}
                  tick={{ fill: isDark ? '#cbd5e1' : '#334155', fontSize: 11, fontWeight: 600 }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis stroke={isDark ? '#94a3b8' : '#64748b'} tick={{ fill: isDark ? '#cbd5e1' : '#334155', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: isDark ? '#12141c' : '#ffffff', borderColor: '#475569', borderRadius: '12px', fontWeight: 600 }} />
                <Bar
                  dataKey={primaryMetricKey || 'Count'}
                  radius={[8, 8, 0, 0]}
                  barSize={36}
                  onClick={(entry) => setActiveFilterCategory(entry[dimensionKey])}
                  className="cursor-pointer"
                >
                  {topChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={activeFilterCategory === entry[dimensionKey] ? '#f59e0b' : COLOR_PALETTE[index % COLOR_PALETTE.length]}
                      opacity={activeFilterCategory && activeFilterCategory !== entry[dimensionKey] ? 0.35 : 1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Visual 2: Pie / Donut Chart Breakdown */}
        <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#181b29] border-slate-800' : 'bg-white border-slate-200'} shadow-md flex flex-col justify-between`}>
          <div className="flex items-center justify-between mb-4 border-b pb-3 border-slate-800/60">
            <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-indigo-400" />
              <span>Percentage Share</span>
            </h3>
            <span className="text-[11px] text-slate-400">Segment Share</span>
          </div>

          <div className="w-full" style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topChartData}
                  dataKey={primaryMetricKey || 'Count'}
                  nameKey={dimensionKey}
                  cx="50%"
                  cy="45%"
                  outerRadius={95}
                  innerRadius={45}
                  paddingAngle={4}
                  onClick={(entry) => setActiveFilterCategory(entry[dimensionKey])}
                  className="cursor-pointer"
                >
                  {topChartData.map((entry, index) => (
                    <Cell
                      key={`pie-cell-${index}`}
                      fill={COLOR_PALETTE[index % COLOR_PALETTE.length]}
                      opacity={activeFilterCategory && activeFilterCategory !== entry[dimensionKey] ? 0.35 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: isDark ? '#12141c' : '#ffffff', borderColor: '#475569', borderRadius: '12px', fontWeight: 600 }} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Power BI Interactive Matrix Table */}
      <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#181b29] border-slate-800' : 'bg-white border-slate-200'} shadow-md space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <TableIcon className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider">Power BI Matrix Table</h3>
            <span className="text-xs text-slate-400">({filteredData.length} records)</span>
          </div>

          {/* Table Search Filter */}
          <div className="w-full sm:w-64">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search table matrix..."
              className={`w-full text-xs px-3.5 py-2 rounded-xl border focus:outline-none ${
                isDark ? 'bg-[#11131a] border-slate-700 text-slate-200 focus:border-amber-400' : 'bg-slate-100 border-slate-300 text-slate-800 focus:border-indigo-500'
              }`}
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-72">
          <table className="w-full text-left text-xs font-sans">
            <thead className={`uppercase text-[11px] font-bold border-b ${isDark ? 'bg-[#11131a] text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
              <tr>
                {allKeys.map((col, idx) => (
                  <th key={idx} className="px-4 py-3 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-slate-800/60' : 'divide-slate-200'}`}>
              {filteredData.slice(0, 50).map((row, rIdx) => (
                <tr key={rIdx} className={isDark ? 'hover:bg-[#1f2334] transition' : 'hover:bg-slate-50 transition'}>
                  {allKeys.map((col, cIdx) => (
                    <td key={cIdx} className="px-4 py-2.5 whitespace-nowrap font-mono">
                      {row[col] === null || row[col] === undefined ? '-' : String(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export Modal Integration */}
      <PowerBIExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        question={question}
        sql={sql}
        data={processedData}
        fields={allKeys}
        dataSourceId={dataSourceId}
      />

    </div>
  );
}
