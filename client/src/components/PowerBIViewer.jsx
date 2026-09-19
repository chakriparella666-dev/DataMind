import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Download, Copy, CheckCheck, RefreshCw, Database, BarChart2,
  Sparkles, Layers, Check, AlertCircle, Code, Filter,
  FileSpreadsheet, Play, Activity, Search,
  ChevronRight, ChevronDown, Terminal, PieChart as PieIcon, TrendingUp, BarChart3, X,
  Grid, SlidersHorizontal, Settings2, RotateCcw, ArrowLeft, Maximize2,
  Hash, Calendar, Type, Eye, Table as TableIcon, FileText, Zap, ChevronUp,
  Sliders, ArrowUpRight, ArrowDownRight, Sun, Moon, HelpCircle
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart as RechartsPie,
  Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  getPowerBIQueries,
  executePowerBIQuery,
  getPowerBISchema
} from '../services/api';

const TEAL_GRADIENT = ['#0891b2', '#06b6d4', '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8'];

export default function PowerBIViewer({ initialQuery, onNavigate }) {
  // Theme: 'dark' | 'light' (matching Power BI Dark & Classic canvas styles)
  const [canvasTheme, setCanvasTheme] = useState('dark');

  // Queries & Active Dashboard State
  const [queriesList, setQueriesList] = useState([]);
  const [activeQuery, setActiveQuery] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [schemaData, setSchemaData] = useState(null);

  // UI & Loading States
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Slicer States (Dynamic filtering across visuals)
  const [selectedSlicers, setSelectedSlicers] = useState({}); // { [colName]: val }
  const [filterText, setFilterText] = useState('');
  const [showFiltersPane, setShowFiltersPane] = useState(true); // Right Collapsible Filters Pane

  // Visual Customizer Field Wells
  const [customXAxis, setCustomXAxis] = useState('');
  const [customSecondaryDim, setCustomSecondaryDim] = useState('');
  const [customMetric, setCustomMetric] = useState('');
  const [aggFunction, setAggFunction] = useState('SUM'); // 'SUM' | 'AVG' | 'COUNT' | 'MAX' | 'MIN'

  // Natural Language Q&A Bar State
  const [showQnABar, setShowQnABar] = useState(false);
  const [qnaInput, setQnaInput] = useState('');

  // Modals & Clipboard States
  const [showMCodeModal, setShowMCodeModal] = useState(false);
  const [showPbidsModal, setShowPbidsModal] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [copiedMCode, setCopiedMCode] = useState(false);
  const [copiedField, setCopiedField] = useState('');

  // DAX Copilot State
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [daxPrompt, setDaxPrompt] = useState('');
  const [daxResult, setDaxResult] = useState(null);
  const [isGeneratingDax, setIsGeneratingDax] = useState(false);

  // Power BI REST API Configuration
  const [powerBiConfig, setPowerBiConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('powerbi_api_config');
      return saved ? JSON.parse(saved) : {
        tenantId: '',
        clientId: '',
        clientSecret: '',
        workspaceId: '',
        reportId: '',
        embedUrl: ''
      };
    } catch (e) {
      return { tenantId: '', clientId: '', clientSecret: '', workspaceId: '', reportId: '', embedUrl: '' };
    }
  });

  // Load Saved SQL Queries on Mount
  const fetchQueriesAndInit = async () => {
    setLoadingList(true);
    setError(null);
    try {
      const [queriesRes, schemaRes] = await Promise.all([
        getPowerBIQueries(),
        getPowerBISchema()
      ]);

      if (schemaRes.success) {
        setSchemaData(schemaRes);
      }

      if (queriesRes.success && Array.isArray(queriesRes.queries)) {
        setQueriesList(queriesRes.queries);
      }

      if (initialQuery && initialQuery.sql) {
        setActiveQuery(initialQuery);
        runQueryDashboard(initialQuery.sql, initialQuery.question || initialQuery.name);
      } else if (queriesRes.success && Array.isArray(queriesRes.queries) && queriesRes.queries.length > 0) {
        const initial = queriesRes.queries[0];
        setActiveQuery(initial);
        runQueryDashboard(initial.sql, initial.question || initial.name);
      } else {
        const defaultSql = `SELECT segment, country, product, units_sold, gross_sales, profit FROM tbl_sheet1_604870 LIMIT 50;`;
        runQueryDashboard(defaultSql, 'Executive Financial Performance');
      }
    } catch (err) {
      console.error('[PowerBI] Failed to load queries:', err);
      setError(err.response?.data?.error || err.message || 'Failed to fetch SQL queries');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchQueriesAndInit();
  }, [initialQuery]);

  // Execute SQL Query and generate live Power BI structures
  const runQueryDashboard = async (sqlString, questionString) => {
    if (!sqlString || !sqlString.trim()) return;
    setLoadingDashboard(true);
    setError(null);
    setSelectedSlicers({});
    try {
      const res = await executePowerBIQuery({
        sql: sqlString.trim(),
        question: questionString || 'Live SQL Query'
      });

      if (res.success && res.dashboard) {
        setDashboardData(res.dashboard);
        
        // Auto-configure optimal axes
        const cols = res.dashboard.columns || [];
        const textCols = cols.filter(c => c.type !== 'numeric').map(c => c.name);
        const numCols = cols.filter(c => c.type === 'numeric').map(c => c.name);

        const timeKeywords = ['date', 'month', 'year', 'quarter', 'day', 'time', 'period'];
        const timeCol = textCols.find(col => timeKeywords.some(k => col.toLowerCase().includes(k)));
        const primaryDim = textCols.find(col => ['segment', 'district', 'country', 'product', 'dept', 'department', 'name', 'brand', 'region', 'company'].some(k => col.toLowerCase().includes(k))) || textCols[0] || cols[0]?.name || 'Category';
        const secondaryDim = textCols.find(c => c !== primaryDim) || (timeCol && timeCol !== primaryDim ? timeCol : textCols[1] || primaryDim);

        const metricKeywords = ['sales', 'gross', 'profit', 'units', 'revenue', 'salary', 'score', 'rate', 'gap', 'amount', 'total'];
        const bestMetric = numCols.find(col => metricKeywords.some(k => col.toLowerCase().includes(k))) || numCols[0] || 'Record Count';

        setCustomXAxis(primaryDim);
        setCustomSecondaryDim(secondaryDim);
        setCustomMetric(bestMetric);
        setAggFunction(bestMetric.toLowerCase().includes('rate') || bestMetric.toLowerCase().includes('score') || bestMetric.toLowerCase().includes('price') || bestMetric.toLowerCase().includes('avg') ? 'AVG' : 'SUM');
      } else {
        setError(res.error || 'Failed to generate Power BI dashboard');
      }
    } catch (err) {
      console.error('[PowerBI] Query execution failed:', err);
      setError(err.response?.data?.error || err.message || 'SQL execution failed');
    } finally {
      setLoadingDashboard(false);
    }
  };

  const handleSelectSavedQuery = (qObj) => {
    setActiveQuery(qObj);
    runQueryDashboard(qObj.sql, qObj.question || qObj.name);
  };

  // 1-Click PBIDS Download Handler
  const handleDownloadPbids = () => {
    const url = `/api/powerbi/export-pbids`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `DataMind_${schemaData?.dbConfig?.database || 'Database'}_Live.pbids`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowPbidsModal(true);
  };

  // Copy helper
  const handleCopyText = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(''), 2500);
  };

  // Slicer toggle handler
  const handleToggleSlicer = (colName, val) => {
    setSelectedSlicers(prev => {
      if (prev[colName] === val) {
        const next = { ...prev };
        delete next[colName];
        return next;
      }
      return { ...prev, [colName]: val };
    });
  };

  // Dynamic Sliced Rows (Client-side interactive cross-filtering)
  const slicedRows = useMemo(() => {
    if (!dashboardData?.rows) return [];
    return dashboardData.rows.filter(r => {
      for (const [col, val] of Object.entries(selectedSlicers)) {
        if (String(r[col] || '').trim() !== String(val).trim()) {
          return false;
        }
      }
      if (filterText.trim()) {
        const match = Object.values(r).some(v => String(v || '').toLowerCase().includes(filterText.toLowerCase()));
        if (!match) return false;
      }
      return true;
    });
  }, [dashboardData?.rows, selectedSlicers, filterText]);

  // Dynamic Visual Computations based on chosen X-Axis, Secondary Dimension & Metric
  const visualCalculations = useMemo(() => {
    if (!dashboardData?.columns || slicedRows.length === 0) {
      return {
        kpi1: { label: 'Metric', value: '0', subtitle: 'No Data', isPositive: true },
        kpi2: { label: 'Metric Gap', value: '0', subtitle: 'No Data', isPositive: true },
        rankedBars: [],
        groupedTimeSeries: [],
        primaryDim: '',
        secondaryDim: '',
        metricName: ''
      };
    }

    const cols = dashboardData.columns;
    const textCols = cols.filter(c => c.type !== 'numeric').map(c => c.name);
    const numCols = cols.filter(c => c.type === 'numeric').map(c => c.name);

    const primaryDim = customXAxis || textCols[0] || cols[0]?.name || 'Dimension';
    const secondaryDim = customSecondaryDim || textCols.find(c => c !== primaryDim) || primaryDim;
    const metricName = customMetric || (numCols.length > 0 ? numCols[0] : 'Record Count');
    const isCountMode = metricName === 'Record Count' || !numCols.includes(metricName);

    // 1. Compute KPI 1 (Overall Total or Mean of Primary Metric)
    let totalVal = 0;
    let avgVal = 0;
    if (isCountMode) {
      totalVal = slicedRows.length;
      avgVal = slicedRows.length;
    } else {
      const numbers = slicedRows.map(r => Number(r[metricName]) || 0);
      totalVal = numbers.reduce((a, b) => a + b, 0);
      avgVal = totalVal / (slicedRows.length || 1);
    }

    const formatVal = (v) => {
      if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
      if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
      return Math.round(v * 10) / 10;
    };

    const kpi1 = {
      label: aggFunction === 'AVG' ? `Average ${metricName}` : `Total ${metricName}`,
      value: formatVal(aggFunction === 'AVG' ? avgVal : totalVal),
      subtitle: `${aggFunction} across ${slicedRows.length} records`,
      isPositive: true
    };

    // 2. Compute KPI 2 (Secondary metric or metric gap / variance)
    const secondaryMetric = numCols.find(c => c !== metricName) || numCols[1];
    let kpi2 = {};
    if (secondaryMetric) {
      const secNumbers = slicedRows.map(r => Number(r[secondaryMetric]) || 0);
      const secTotal = secNumbers.reduce((a, b) => a + b, 0);
      const secAvg = secTotal / (slicedRows.length || 1);
      kpi2 = {
        label: `${secondaryMetric} Metric`,
        value: formatVal(aggFunction === 'AVG' ? secAvg : secTotal),
        subtitle: `Secondary aggregate across records`,
        isPositive: true
      };
    } else {
      // Calculate Variance / Spread Gap
      const minVal = isCountMode ? 1 : Math.min(...slicedRows.map(r => Number(r[metricName]) || 0));
      const maxVal = isCountMode ? slicedRows.length : Math.max(...slicedRows.map(r => Number(r[metricName]) || 0));
      kpi2 = {
        label: `${metricName} Gap`,
        value: formatVal(maxVal - minVal),
        subtitle: `Range Spread (Max - Min)`,
        isPositive: true
      };
    }

    // 3. Ranked Horizontal Bars (e.g. Sentiment / Sales by District / Segment)
    const rankMap = {};
    const rankCount = {};
    slicedRows.forEach(r => {
      const key = r[primaryDim] !== null && r[primaryDim] !== undefined ? String(r[primaryDim]).trim() : 'Unknown';
      if (!rankMap[key]) {
        rankMap[key] = 0;
        rankCount[key] = 0;
      }
      rankCount[key] += 1;
      const num = isCountMode ? 1 : (Number(r[metricName]) || 0);
      rankMap[key] += num;
    });

    let rankedBars = Object.entries(rankMap).map(([name, sum]) => {
      const val = aggFunction === 'AVG' && !isCountMode ? Math.round((sum / (rankCount[name] || 1)) * 10) / 10 : Math.round(sum * 10) / 10;
      return { name, value: val, count: rankCount[name] };
    });

    rankedBars.sort((a, b) => b.value - a.value);
    rankedBars = rankedBars.slice(0, 10); // Top 10

    // 4. Grouped Dimensional / Time Series Columns (e.g. Sentiment by Month & Region)
    const groupedMap = {};
    slicedRows.forEach(r => {
      const pKey = r[primaryDim] !== null && r[primaryDim] !== undefined ? String(r[primaryDim]).trim() : 'Unknown';
      const sKey = r[secondaryDim] !== null && r[secondaryDim] !== undefined ? String(r[secondaryDim]).trim() : 'General';
      const groupKey = `${pKey} - ${sKey}`;
      if (!groupedMap[groupKey]) {
        groupedMap[groupKey] = { label: pKey, subLabel: sKey, value: 0, count: 0 };
      }
      groupedMap[groupKey].count += 1;
      groupedMap[groupKey].value += isCountMode ? 1 : (Number(r[metricName]) || 0);
    });

    const groupedTimeSeries = Object.values(groupedMap).slice(0, 24).map(item => ({
      name: `${item.label} (${item.subLabel})`,
      category: item.label,
      subGroup: item.subLabel,
      value: aggFunction === 'AVG' && !isCountMode ? Math.round((item.value / (item.count || 1)) * 10) / 10 : Math.round(item.value * 10) / 10
    }));

    return {
      kpi1,
      kpi2,
      rankedBars,
      groupedTimeSeries,
      primaryDim,
      secondaryDim,
      metricName
    };
  }, [dashboardData?.columns, slicedRows, customXAxis, customSecondaryDim, customMetric, aggFunction]);

  // DAX Generation
  const handleGenerateDax = (e) => {
    e.preventDefault();
    if (!daxPrompt.trim() || !dashboardData) return;
    setIsGeneratingDax(true);
    setDaxResult(null);

    setTimeout(() => {
      const numCols = dashboardData.columns.filter(c => c.type === 'numeric').map(c => c.name);
      const metricCol = customMetric || numCols[0] || 'MetricValue';

      let dax = {
        name: `Total_${metricCol}`,
        formula: `Total ${metricCol} = \nCALCULATE(\n    SUM('QueryResult'[${metricCol}]),\n    ALLSELECTED('QueryResult')\n)`,
        explanation: `Computes dynamic aggregate for [${metricCol}] respecting all active slicers.`
      };

      setDaxResult(dax);
      setIsGeneratingDax(false);
    }, 400);
  };

  // CSV Export
  const handleExportCsv = () => {
    if (slicedRows.length === 0) return;
    const cols = dashboardData.columns.map(c => c.name);
    const csvRows = [cols.join(',')];
    for (const row of slicedRows) {
      const values = cols.map(col => {
        const val = row[col];
        return val === null || val === undefined ? '""' : `"${String(val).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(dashboardData.question || 'powerbi_report').replace(/\s+/g, '_')}.csv`;
    link.click();
  };

  const isDark = canvasTheme === 'dark';

  return (
    <div className={`flex-1 flex flex-col h-full font-sans antialiased overflow-hidden select-none ${isDark ? 'bg-[#121316] text-slate-100' : 'bg-[#f4f5f7] text-slate-800'}`}>
      
      {/* Top Power BI Desktop / Web Header Bar (matching Reference Image 1) */}
      <div className={`px-4 py-2 border-b flex items-center justify-between text-xs shrink-0 ${isDark ? 'bg-[#181a20] border-[#292c36] text-zinc-300' : 'bg-white border-zinc-200 text-zinc-700'}`}>
        <div className="flex items-center space-x-4">
          
          {/* Reload Action */}
          <button
            onClick={() => runQueryDashboard(activeQuery?.sql, activeQuery?.question)}
            className="flex items-center space-x-1.5 hover:text-amber-400 font-semibold transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingDashboard ? 'animate-spin text-amber-400' : ''}`} />
            <span>Reload</span>
          </button>

          <span className="text-zinc-500">|</span>

          {/* Show M Code */}
          <button
            onClick={() => setShowMCodeModal(true)}
            className="flex items-center space-x-1.5 hover:text-amber-400 font-semibold transition cursor-pointer"
          >
            <Code className="w-3.5 h-3.5 text-amber-400" />
            <span>Show sample code</span>
          </button>

          <span className="text-zinc-500">|</span>

          {/* ⚡ 1-Click Power BI Desktop (.pbids) */}
          <button
            onClick={handleDownloadPbids}
            className="flex items-center space-x-1.5 text-amber-400 hover:text-amber-300 font-black transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>⚡ 1-Click Power BI Desktop</span>
          </button>
        </div>

        {/* Right Tools: View & Theme toggles */}
        <div className="flex items-center space-x-3">
          {/* Theme toggle */}
          <button
            onClick={() => setCanvasTheme(isDark ? 'light' : 'dark')}
            className={`p-1.5 rounded-lg border flex items-center gap-1 font-bold text-[11px] cursor-pointer transition ${isDark ? 'bg-[#22252e] border-zinc-700 text-zinc-300 hover:text-white' : 'bg-zinc-100 border-zinc-300 text-zinc-700 hover:bg-zinc-200'}`}
            title="Toggle Dark / Classic White Power BI Theme"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-600" />}
            <span className="hidden sm:inline">{isDark ? 'Light Theme' : 'Dark Theme'}</span>
          </button>

          {/* Filters Pane Toggle */}
          <button
            onClick={() => setShowFiltersPane(!showFiltersPane)}
            className={`px-2.5 py-1 rounded-lg border font-bold text-[11px] flex items-center gap-1.5 cursor-pointer transition ${showFiltersPane ? 'bg-amber-500 text-black border-amber-500 font-extrabold' : isDark ? 'bg-[#22252e] border-zinc-700 text-zinc-300' : 'bg-zinc-100 border-zinc-300 text-zinc-700'}`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* Top Slicers / Interactive Filters Row (Exact Layout from Reference Image 1) */}
      {dashboardData && (
        <div className={`px-4 py-3 border-b flex flex-wrap items-center gap-4 text-xs shrink-0 shadow-sm ${isDark ? 'bg-[#15171e] border-[#252834]' : 'bg-white border-zinc-200'}`}>
          
          {/* Q&A Button */}
          <button
            onClick={() => setShowQnABar(!showQnABar)}
            className="bg-black hover:bg-zinc-900 text-white font-extrabold px-4 py-2.5 rounded-md shadow flex items-center justify-center space-x-1.5 cursor-pointer border border-zinc-700 active:scale-95 transition shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="tracking-wider text-xs">Q&A</span>
          </button>

          {/* Primary Slicer Dropdowns computed from real dataset columns */}
          {dashboardData.visuals?.slicers && Object.entries(dashboardData.visuals.slicers).slice(0, 3).map(([colName, vals]) => (
            <div key={colName} className="flex flex-col space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-black dark:bg-amber-400 inline-block"></span>
                {colName}
              </span>
              <select
                value={selectedSlicers[colName] || ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '') {
                    const next = { ...selectedSlicers };
                    delete next[colName];
                    setSelectedSlicers(next);
                  } else {
                    setSelectedSlicers({ ...selectedSlicers, [colName]: v });
                  }
                }}
                className={`border rounded-md px-2.5 py-1 text-xs font-semibold focus:outline-none focus:border-amber-400 cursor-pointer min-w-[120px] ${isDark ? 'bg-[#1e2028] border-zinc-700 text-white' : 'bg-zinc-50 border-zinc-300 text-zinc-800'}`}
              >
                <option value="">All ({vals.length})</option>
                {vals.slice(0, 20).map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          ))}

          {/* Quick Category Chips Slicer (e.g. Region or Segment) */}
          {dashboardData.visuals?.slicers && Object.keys(dashboardData.visuals.slicers).length > 0 && (() => {
            const firstSlicerKey = Object.keys(dashboardData.visuals.slicers)[0];
            const chips = dashboardData.visuals.slicers[firstSlicerKey].slice(0, 5);
            return (
              <div className="flex flex-col space-y-1 ml-auto">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-black dark:bg-amber-400 inline-block"></span>
                  {firstSlicerKey} Quick Filter:
                </span>
                <div className="flex items-center space-x-1 bg-zinc-800/20 p-0.5 rounded-lg border border-zinc-700/50">
                  <button
                    onClick={() => {
                      const next = { ...selectedSlicers };
                      delete next[firstSlicerKey];
                      setSelectedSlicers(next);
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${!selectedSlicers[firstSlicerKey] ? 'bg-amber-500 text-black font-extrabold' : 'text-zinc-400 hover:text-white'}`}
                  >
                    All
                  </button>
                  {chips.map(chip => (
                    <button
                      key={chip}
                      onClick={() => handleToggleSlicer(firstSlicerKey, chip)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer ${selectedSlicers[firstSlicerKey] === chip ? 'bg-amber-500 text-black font-extrabold' : 'text-zinc-400 hover:text-white'}`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Natural Language Q&A Drawer */}
      {showQnABar && (
        <div className={`p-3 border-b flex items-center gap-2 animate-fadeIn shrink-0 ${isDark ? 'bg-[#181a22] border-zinc-800' : 'bg-zinc-100 border-zinc-300'}`}>
          <Search className="w-4 h-4 text-amber-400 shrink-0" />
          <input
            type="text"
            placeholder="Ask a question about your data (e.g. What is total profit by country in 2014?)"
            value={qnaInput}
            onChange={(e) => setQnaInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && qnaInput.trim()) {
                setFilterText(qnaInput.trim());
              }
            }}
            className={`flex-1 px-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:border-amber-400 ${isDark ? 'bg-[#101216] border-zinc-700 text-white' : 'bg-white border-zinc-300 text-zinc-800'}`}
          />
          <button
            onClick={() => setFilterText(qnaInput.trim())}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs rounded-lg transition cursor-pointer"
          >
            Apply Q&A
          </button>
        </div>
      )}

      {/* Main Canvas + Right Collapsible Filters Pane */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        
        {/* Visual Report Canvas (Exact Layout from Reference Image 1) */}
        <div className="flex-1 flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-5">
          {loadingDashboard ? (
            <div className="h-full flex flex-col items-center justify-center space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center animate-spin">
                <RefreshCw className="w-5 h-5 text-amber-400" />
              </div>
              <p className="text-xs font-bold text-zinc-400">Loading Power BI visual components...</p>
            </div>
          ) : !dashboardData ? (
            <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
              Select a query above to render Power BI visual report.
            </div>
          ) : (
            <>
              {/* TOP ROW: KPI Card 1 + KPI Card 2 + Ranked Horizontal Bar Chart (Exact Reference 1) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                
                {/* KPI Card 1 (e.g. Sentiment / Sales) */}
                <div className={`lg:col-span-3 rounded-xl border flex flex-col justify-between overflow-hidden shadow-md transition ${isDark ? 'bg-[#181a20] border-[#292c37]' : 'bg-white border-zinc-200'}`}>
                  <div className="p-5 space-y-2">
                    <span className="text-xs font-black tracking-wide text-zinc-400 uppercase">
                      {visualCalculations.kpi1.label}
                    </span>
                    <div className="text-4xl lg:text-5xl font-black text-zinc-900 dark:text-white font-mono tracking-tight">
                      {visualCalculations.kpi1.value}
                    </div>
                  </div>
                  
                  {/* Card Bottom Status Banner */}
                  <div className="bg-black text-white p-3 px-4 flex items-center space-x-2.5">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-400 font-black text-xs shrink-0">
                      &uarr;
                    </div>
                    <span className="text-xs font-bold truncate text-zinc-200">
                      {visualCalculations.kpi1.subtitle}
                    </span>
                  </div>
                </div>

                {/* KPI Card 2 (e.g. Sentiment Gap / Profit Margin) */}
                <div className={`lg:col-span-3 rounded-xl border flex flex-col justify-between overflow-hidden shadow-md transition ${isDark ? 'bg-[#181a20] border-[#292c37]' : 'bg-white border-zinc-200'}`}>
                  <div className="p-5 space-y-2">
                    <span className="text-xs font-black tracking-wide text-zinc-400 uppercase">
                      {visualCalculations.kpi2.label}
                    </span>
                    <div className="text-4xl lg:text-5xl font-black text-zinc-900 dark:text-white font-mono tracking-tight">
                      {visualCalculations.kpi2.value}
                    </div>
                  </div>

                  {/* Card Bottom Status Banner */}
                  <div className="bg-black text-white p-3 px-4 flex items-center space-x-2.5">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-400 font-black text-xs shrink-0">
                      &uarr;
                    </div>
                    <span className="text-xs font-bold truncate text-zinc-200">
                      {visualCalculations.kpi2.subtitle}
                    </span>
                  </div>
                </div>

                {/* Ranked Horizontal Bar Chart (e.g. Sentiment by District) */}
                <div className={`lg:col-span-6 rounded-xl border overflow-hidden shadow-md flex flex-col justify-between ${isDark ? 'bg-[#181a20] border-[#292c37]' : 'bg-white border-zinc-200'}`}>
                  
                  {/* Visual Header */}
                  <div className="bg-black text-white px-4 py-2.5 flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-wider">
                      {visualCalculations.metricName} by {visualCalculations.primaryDim}
                    </h3>
                    <div className="flex items-center space-x-2 text-[10px] text-zinc-400">
                      <span>Bar Size: {visualCalculations.metricName}</span>
                      <span>&bull;</span>
                      <span className="text-cyan-400 font-semibold">&bull; High &bull; Med &bull; Low</span>
                    </div>
                  </div>

                  {/* Horizontal Bar Visual Content */}
                  <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-center">
                    {visualCalculations.rankedBars.map((bar, i) => {
                      const maxVal = visualCalculations.rankedBars[0]?.value || 1;
                      const pct = Math.max(12, Math.min(100, Math.round((bar.value / maxVal) * 100)));
                      const color = TEAL_GRADIENT[i % TEAL_GRADIENT.length];
                      return (
                        <div key={bar.name} className="flex items-center space-x-3 text-xs">
                          <span className="w-24 text-zinc-400 font-bold truncate text-[11px]" title={bar.name}>
                            {bar.name}
                          </span>
                          <div className="flex-1 bg-zinc-800/30 rounded h-5 overflow-hidden flex items-center">
                            <div
                              style={{ width: `${pct}%`, backgroundColor: color }}
                              className="h-full rounded-r flex items-center justify-end pr-2 transition-all duration-500 shadow-sm"
                            >
                              <span className="text-[10px] font-black text-zinc-950">{bar.value}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* BOTTOM ROW: Grouped Column Chart (e.g. Industry Sentiment / Sentiment by Month & Region) */}
              <div className={`rounded-xl border overflow-hidden shadow-md ${isDark ? 'bg-[#181a20] border-[#292c37]' : 'bg-white border-zinc-200'}`}>
                
                {/* Visual Header */}
                <div className="bg-black text-white px-4 py-2.5 flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider">
                    {visualCalculations.metricName} by {visualCalculations.primaryDim} &amp; {visualCalculations.secondaryDim}
                  </h3>
                  <div className="flex items-center space-x-2 text-[10px] text-zinc-400">
                    <span>Grouped Breakdown</span>
                    <span>&bull;</span>
                    <span className="text-cyan-400 font-semibold">&bull; High &bull; Medium &bull; Low</span>
                  </div>
                </div>

                <div className="p-4 h-72 md:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={visualCalculations.groupedTimeSeries} margin={{ top: 15, right: 20, left: 0, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#262934' : '#e5e7eb'} vertical={false} />
                      <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} angle={-25} textAnchor="end" />
                      <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#181a20', borderColor: '#343844', borderRadius: '8px', fontSize: '12px', color: '#fff' }} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {visualCalculations.groupedTimeSeries.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={TEAL_GRADIENT[index % TEAL_GRADIENT.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* DETAILED DATA TABLE / CSV EXPORT */}
              <div className={`rounded-xl border p-4 shadow-md space-y-3 ${isDark ? 'bg-[#181a20] border-[#292c37]' : 'bg-white border-zinc-200'}`}>
                <div className="flex items-center justify-between border-b pb-2.5 border-zinc-700/50">
                  <div className="flex items-center space-x-2">
                    <Database className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-black uppercase tracking-wider">Underlying Query Records</h3>
                    <span className="text-zinc-500 text-[11px]">({slicedRows.length} rows)</span>
                  </div>
                  <button
                    onClick={handleExportCsv}
                    className="px-3 py-1 bg-[#22252e] hover:bg-[#2c303c] text-zinc-200 border border-zinc-700 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Export CSV</span>
                  </button>
                </div>

                <div className="overflow-x-auto border border-zinc-800 rounded-lg max-h-56">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#12141a] text-zinc-300 font-bold border-b border-zinc-800 sticky top-0">
                      <tr>
                        {dashboardData.columns.map(col => (
                          <th key={col.name} className="p-2.5 font-mono whitespace-nowrap">{col.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50 bg-[#181a20]">
                      {slicedRows.slice(0, 30).map((row, idx) => (
                        <tr key={idx} className="hover:bg-[#20232b] transition">
                          {dashboardData.columns.map(col => (
                            <td key={col.name} className="p-2.5 text-zinc-300 font-mono text-[11px] whitespace-nowrap">
                              {row[col.name] !== null && row[col.name] !== undefined ? String(row[col.name]) : '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Collapsible Filters Pane (Exact Power BI Filters Sidebar) */}
        {showFiltersPane && dashboardData?.columns && (
          <div className={`w-72 md:w-80 border-l flex flex-col h-full z-10 shrink-0 shadow-2xl animate-fadeIn ${isDark ? 'bg-[#181a20] border-[#292c36]' : 'bg-white border-zinc-200'}`}>
            
            {/* Filters Pane Header */}
            <div className="p-3.5 border-b border-zinc-700/50 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-black uppercase tracking-wider">Filters on this page</h3>
              </div>
              <button onClick={() => setShowFiltersPane(false)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filters Content List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              
              {/* Active Filters Clear Button */}
              {Object.keys(selectedSlicers).length > 0 && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between">
                  <span className="text-amber-300 font-bold text-[11px]">{Object.keys(selectedSlicers).length} Filter(s) Applied</span>
                  <button onClick={() => setSelectedSlicers({})} className="text-amber-400 hover:underline font-extrabold text-[10px]">
                    Clear All
                  </button>
                </div>
              )}

              {/* Filter Cards for every Dimension */}
              {dashboardData.columns.filter(c => c.type !== 'numeric').map(col => {
                const uniqueVals = Array.from(new Set(dashboardData.rows.map(r => r[col.name]))).filter(Boolean).slice(0, 15);
                const isFiltered = !!selectedSlicers[col.name];
                return (
                  <div key={col.name} className="border border-zinc-800 rounded-lg overflow-hidden bg-[#12141a]">
                    <div className="p-2.5 bg-[#181a22] border-b border-zinc-800 flex items-center justify-between">
                      <span className="font-bold text-zinc-200 text-xs">{col.name}</span>
                      {isFiltered && <span className="w-2 h-2 rounded-full bg-amber-400"></span>}
                    </div>
                    <div className="p-2 max-h-36 overflow-y-auto space-y-1">
                      {uniqueVals.map(val => {
                        const isChecked = selectedSlicers[col.name] === val;
                        return (
                          <button
                            key={val}
                            onClick={() => handleToggleSlicer(col.name, val)}
                            className={`w-full text-left px-2 py-1 rounded text-[11px] flex items-center justify-between transition cursor-pointer ${isChecked ? 'bg-amber-500 text-black font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                          >
                            <span className="truncate">{val}</span>
                            {isChecked && <Check className="w-3 h-3" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Power Query M-Script Modal */}
      {showMCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#181a20] border border-[#2e323c] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl space-y-4 p-6 text-xs">
            <div className="flex items-center justify-between border-b border-[#2e323c] pb-3">
              <div className="flex items-center space-x-2">
                <Code className="w-4 h-4 text-amber-400" />
                <h3 className="text-base font-extrabold text-white">Power Query M Script (Generated SQL)</h3>
              </div>
              <button onClick={() => setShowMCodeModal(false)} className="p-1.5 text-zinc-400 hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <pre className="p-4 bg-[#0d0e12] border border-[#2a2d36] rounded-xl text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-60 whitespace-pre-wrap">
              {dashboardData?.powerQueryCode || 'Loading M-Code...'}
            </pre>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(dashboardData?.powerQueryCode || '');
                  setCopiedMCode(true);
                  setTimeout(() => setCopiedMCode(false), 2500);
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded-xl flex items-center space-x-1.5 transition cursor-pointer"
              >
                {copiedMCode ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedMCode ? 'Copied M-Script!' : 'Copy Script'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1-Click Power BI Desktop Connection Modal */}
      {showPbidsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#181a20] border border-[#2e323c] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-[#2e323c] pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  ⚡
                </div>
                <h3 className="text-base font-extrabold text-white">Power BI Desktop Connection</h3>
              </div>
              <button onClick={() => setShowPbidsModal(false)} className="p-1.5 text-zinc-400 hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-emerald-200">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>File Downloaded: DataMind_{schemaData?.dbConfig?.database || 'datamind_app2'}_Live.pbids</span>
              </div>
              <p className="text-[11px] text-emerald-300/80">
                Double-click the downloaded <code className="bg-black/30 px-1 py-0.5 rounded font-mono">.pbids</code> file to launch Power BI Desktop.
              </p>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                onClick={() => setShowPbidsModal(false)}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded-xl transition cursor-pointer"
              >
                Got It, Open Power BI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
