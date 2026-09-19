import React, { useState, useEffect, useMemo } from 'react';
import {
  Download, Copy, CheckCheck, RefreshCw, Database, BarChart2,
  Sparkles, Layers, Check, AlertCircle, Code, Filter,
  FileSpreadsheet, Play, Activity, Search,
  ChevronRight, Terminal, PieChart, TrendingUp, BarChart3, X,
  Grid, SlidersHorizontal, ArrowUpDown
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

const PALETTE = [
  '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899',
  '#06b6d4', '#f97316', '#14b8a6', '#6366f1', '#84cc16'
];

export default function PowerBIViewer({ onNavigate }) {
  // Queries & Active Dashboard State
  const [queriesList, setQueriesList] = useState([]);
  const [activeQuery, setActiveQuery] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [schemaData, setSchemaData] = useState(null);

  // UI & Slicer States
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [activeChartType, setActiveChartType] = useState('bar'); // 'bar' | 'line' | 'area'
  const [selectedSlicers, setSelectedSlicers] = useState({}); // { [colName]: selectedVal }
  const [filterText, setFilterText] = useState('');

  // Custom Query Bar State
  const [customSql, setCustomSql] = useState('');
  const [customQuestion, setCustomQuestion] = useState('');
  const [isEditingSql, setIsEditingSql] = useState(false);

  // Modals & Clipboard States
  const [showMCodeModal, setShowMCodeModal] = useState(false);
  const [showPbidsModal, setShowPbidsModal] = useState(false);
  const [copiedMCode, setCopiedMCode] = useState(false);
  const [copiedField, setCopiedField] = useState('');

  // DAX Copilot State
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [daxPrompt, setDaxPrompt] = useState('');
  const [daxResult, setDaxResult] = useState(null);
  const [isGeneratingDax, setIsGeneratingDax] = useState(false);

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

      if (queriesRes.success && Array.isArray(queriesRes.queries) && queriesRes.queries.length > 0) {
        setQueriesList(queriesRes.queries);
        const initial = queriesRes.queries[0];
        setActiveQuery(initial);
        runQueryDashboard(initial.sql, initial.question || initial.name);
      } else {
        const defaultSql = `SELECT name_of_emp, department, designation, salary FROM tbl_sheet1_604870 LIMIT 10;`;
        runQueryDashboard(defaultSql, 'Sample Employee Salary Distribution');
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
  }, []);

  // Run SQL Query and build Power BI Dashboard
  const runQueryDashboard = async (sqlString, questionString) => {
    if (!sqlString || !sqlString.trim()) return;
    setLoadingDashboard(true);
    setError(null);
    setSelectedSlicers({});
    try {
      const res = await executePowerBIQuery({
        sql: sqlString.trim(),
        question: questionString || 'SQL Query Result'
      });

      if (res.success && res.dashboard) {
        setDashboardData(res.dashboard);
        setCustomSql(sqlString.trim());
        setCustomQuestion(questionString || '');
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
    setIsEditingSql(false);
    runQueryDashboard(qObj.sql, qObj.question || qObj.name);
  };

  const handleRunCustomQuery = (e) => {
    e.preventDefault();
    if (!customSql.trim()) return;
    runQueryDashboard(customSql, customQuestion || 'Custom SQL Query');
  };

  // Toggle Slicer selection
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

  // Dynamic Sliced Rows (Client-side interactive slicing)
  const slicedRows = useMemo(() => {
    if (!dashboardData?.rows) return [];
    return dashboardData.rows.filter(r => {
      // Check slicer filters
      for (const [col, val] of Object.entries(selectedSlicers)) {
        if (String(r[col] || '').trim() !== String(val).trim()) {
          return false;
        }
      }
      // Check search text filter
      if (filterText.trim()) {
        const match = Object.values(r).some(v => String(v || '').toLowerCase().includes(filterText.toLowerCase()));
        if (!match) return false;
      }
      return true;
    });
  }, [dashboardData?.rows, selectedSlicers, filterText]);

  // Dynamically recompute visuals based on sliced rows
  const dynamicVisuals = useMemo(() => {
    if (!dashboardData?.columns || slicedRows.length === 0) {
      return {
        primaryData: [],
        donutData: [],
        kpis: dashboardData?.kpis || []
      };
    }

    const numericCols = dashboardData.columns.filter(c => c.type === 'numeric').map(c => c.name);
    const textCols = dashboardData.columns.filter(c => c.type !== 'numeric').map(c => c.name);

    if (numericCols.length > 0 && textCols.length > 0) {
      const primaryDim = textCols[0];
      const secondaryDim = textCols[1] || textCols[0];
      const metric = numericCols[0];

      // Primary group
      const grp = {};
      slicedRows.forEach(r => {
        const key = String(r[primaryDim] || 'Other').trim();
        if (!grp[key]) grp[key] = { [primaryDim]: key };
        numericCols.slice(0, 3).forEach(nc => {
          grp[key][nc] = (grp[key][nc] || 0) + (Number(r[nc]) || 0);
        });
      });

      // Secondary donut
      const dGrp = {};
      slicedRows.forEach(r => {
        const key = String(r[secondaryDim] || 'Other').trim();
        dGrp[key] = (dGrp[key] || 0) + (Number(r[metric]) || 1);
      });

      return {
        primaryData: Object.values(grp),
        donutData: Object.entries(dGrp).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })),
        primaryXKey: primaryDim,
        primaryYKeys: numericCols.slice(0, 3),
        primaryTitle: `${numericCols.join(' & ').replace(/_/g, ' ')} by ${primaryDim.replace(/_/g, ' ')}`,
        donutTitle: `${metric.replace(/_/g, ' ')} Share by ${secondaryDim.replace(/_/g, ' ')}`
      };
    } else if (textCols.length > 0) {
      const primaryDim = textCols[0];
      const secondaryDim = textCols[1] || textCols[0];

      // Primary frequency
      const f1 = {};
      slicedRows.forEach(r => {
        const key = String(r[primaryDim] || 'Unknown').trim();
        f1[key] = (f1[key] || 0) + 1;
      });

      // Secondary frequency
      const f2 = {};
      slicedRows.forEach(r => {
        const key = String(r[secondaryDim] || 'Unknown').trim();
        f2[key] = (f2[key] || 0) + 1;
      });

      return {
        primaryData: Object.entries(f1).map(([k, v]) => ({ [primaryDim]: k, 'Record Count': v })),
        donutData: Object.entries(f2).map(([name, value]) => ({ name, value })),
        primaryXKey: primaryDim,
        primaryYKeys: ['Record Count'],
        primaryTitle: `Record Volume by ${primaryDim.replace(/_/g, ' ').toUpperCase()}`,
        donutTitle: `Distribution by ${secondaryDim.replace(/_/g, ' ').toUpperCase()}`
      };
    } else {
      return {
        primaryData: slicedRows.map((r, i) => ({ Index: `Row ${i + 1}`, ...r })),
        donutData: [],
        primaryXKey: 'Index',
        primaryYKeys: numericCols.slice(0, 3),
        primaryTitle: 'Metrics Distribution',
        donutTitle: ''
      };
    }
  }, [dashboardData?.columns, slicedRows]);

  // Export Table Rows to CSV
  const handleExportCsv = () => {
    if (slicedRows.length === 0) return;
    const cols = dashboardData.columns.map(c => c.name);
    const csvRows = [];
    csvRows.push(cols.join(','));

    for (const row of slicedRows) {
      const values = cols.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return '""';
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(dashboardData.question || 'sql_query').replace(/\s+/g, '_')}_results.csv`;
    link.click();
  };

  // Generate DAX with Copilot for active SQL columns
  const handleGenerateDax = (e) => {
    e.preventDefault();
    if (!daxPrompt.trim() || !dashboardData) return;

    setIsGeneratingDax(true);
    setDaxResult(null);

    setTimeout(() => {
      const promptLower = daxPrompt.toLowerCase();
      const numCols = dashboardData.columns.filter(c => c.type === 'numeric').map(c => c.name);
      const metricCol = numCols[0] || 'MetricValue';

      let dax = {};
      if (promptLower.includes('growth') || promptLower.includes('yoy')) {
        dax = {
          name: `YoY_${metricCol}_Growth`,
          formula: `${metricCol} YoY % = \nVAR CurrentVal = SUM('QueryResult'[${metricCol}])\nVAR PriorVal = CALCULATE(SUM('QueryResult'[${metricCol}]), SAMEPERIODLASTYEAR('Calendar'[Date]))\nRETURN\n    DIVIDE(CurrentVal - PriorVal, PriorVal, 0)`,
          explanation: `Calculates Year-Over-Year percentage growth for measure [${metricCol}].`
        };
      } else if (promptLower.includes('margin') || promptLower.includes('average') || promptLower.includes('avg')) {
        dax = {
          name: `Average_${metricCol}`,
          formula: `Average ${metricCol} = \nAVERAGE('QueryResult'[${metricCol}])`,
          explanation: `Calculates dynamic average for [${metricCol}] across selected dimensions.`
        };
      } else if (promptLower.includes('rank') || promptLower.includes('top')) {
        dax = {
          name: `Rank_By_${metricCol}`,
          formula: `Rank by ${metricCol} = \nRANKX(\n    ALL('QueryResult'),\n    CALCULATE(SUM('QueryResult'[${metricCol}])),\n    ,\n    DESC,\n    Dense\n)`,
          explanation: `Ranks rows in descending order by [${metricCol}].`
        };
      } else {
        dax = {
          name: `Total_${metricCol}`,
          formula: `Total ${metricCol} = \nCALCULATE(\n    SUM('QueryResult'[${metricCol}]),\n    ALLSELECTED('QueryResult')\n)`,
          explanation: `Aggregates [${metricCol}] with dynamic filter context.`
        };
      }

      setDaxResult(dax);
      setIsGeneratingDax(false);
    }, 450);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#111318] text-slate-100 font-sans antialiased overflow-hidden select-none">
      
      {/* Top Header & 1-Click Automation Bar */}
      <div className="bg-[#181a20] border-b border-[#2a2d36] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-md">
        
        {/* Left: Query Result Header */}
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-sm">
            <BarChart2 className="w-5 h-5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-extrabold text-white tracking-tight truncate max-w-md">
                {dashboardData?.question || activeQuery?.title || 'Power BI SQL Query Dashboard'}
              </h2>
              <span className="px-2 py-0.5 bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-black rounded-md uppercase tracking-wider">
                Live BI Canvas
              </span>
            </div>
            <p className="text-xs text-zinc-400 truncate">
              {dashboardData ? `${slicedRows.length} of ${dashboardData.totalRows} records displayed (${dashboardData.executionTimeMs}ms query)` : 'Automated Power BI Dashboard from generated SQL'}
            </p>
          </div>
        </div>

        {/* Right: 1-Click Power BI Export & Automation Actions */}
        <div className="flex items-center space-x-2 shrink-0">
          
          {/* ⚡ 1-Click Open in Power BI Desktop */}
          <button
            onClick={handleDownloadPbids}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs rounded-xl flex items-center space-x-1.5 shadow-md active:scale-[0.98] transition cursor-pointer"
            title="Download Power BI Desktop Data Source (.pbids)"
          >
            <Download className="w-4 h-4" />
            <span>⚡ 1-Click Open in Power BI</span>
          </button>

          {/* Power Query M-Code for this Query */}
          <button
            onClick={() => setShowMCodeModal(true)}
            className="px-3 py-2 bg-[#22242c] hover:bg-[#2b2e38] text-zinc-200 border border-[#343844] font-bold text-xs rounded-xl flex items-center space-x-1.5 transition cursor-pointer"
            title="View Power Query M-Script for this SQL Query"
          >
            <Code className="w-3.5 h-3.5 text-amber-400" />
            <span>Power Query M</span>
          </button>

          {/* DAX Copilot */}
          <button
            onClick={() => setIsCopilotOpen(!isCopilotOpen)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              isCopilotOpen
                ? 'bg-amber-400 text-black font-extrabold'
                : 'bg-[#22242c] hover:bg-[#2b2e38] text-amber-300 border border-amber-500/30'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>DAX Copilot</span>
          </button>

          {/* Refresh Query */}
          <button
            onClick={() => runQueryDashboard(customSql || activeQuery?.sql, customQuestion || activeQuery?.question)}
            className="p-2 bg-[#22242c] hover:bg-[#2b2e38] text-zinc-300 hover:text-white border border-[#343844] rounded-xl transition cursor-pointer"
            title="Re-execute SQL query"
          >
            <RefreshCw className={`w-4 h-4 ${loadingDashboard ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Generated SQL Queries Horizontal Carousel */}
      <div className="bg-[#15171d] border-b border-[#252832] px-5 py-2.5 flex items-center space-x-2 overflow-x-auto no-scrollbar shrink-0">
        <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
          <Layers className="w-3 h-3 text-zinc-400" /> Generated SQL Queries:
        </span>
        
        {queriesList.map((q) => {
          const isSelected = activeQuery && String(activeQuery.id || activeQuery._id) === String(q.id || q._id);
          const displayTitle = q.question || q.name || 'SQL Query';
          return (
            <button
              key={q.id || q._id}
              onClick={() => handleSelectSavedQuery(q)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition shrink-0 max-w-xs truncate ${
                isSelected
                  ? 'bg-amber-500 text-black font-extrabold shadow-sm'
                  : 'bg-[#1e2028] text-zinc-300 hover:text-white hover:bg-[#262a36] border border-[#2c303c]'
              }`}
              title={displayTitle}
            >
              {displayTitle}
            </button>
          );
        })}

        {/* Toggle Custom SQL Input */}
        <button
          onClick={() => setIsEditingSql(!isEditingSql)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 flex items-center gap-1 border ${
            isEditingSql
              ? 'bg-indigo-600 text-white border-indigo-500'
              : 'bg-[#1a1c24] text-indigo-400 border-indigo-500/40 hover:bg-indigo-500/10'
          }`}
        >
          <Terminal className="w-3 h-3" />
          <span>{isEditingSql ? 'Hide SQL Bar' : 'Custom SQL'}</span>
        </button>
      </div>

      {/* Custom SQL Query Editor Drawer */}
      {isEditingSql && (
        <form onSubmit={handleRunCustomQuery} className="bg-[#181a22] border-b border-[#2e323c] p-4 flex flex-col md:flex-row gap-3 animate-fadeIn shrink-0">
          <div className="flex-1 space-y-2">
            <input
              type="text"
              placeholder="Query title / question (e.g. Sales by region)"
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              className="w-full bg-[#101216] border border-[#343844] rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
            />
            <textarea
              rows={2}
              placeholder="Enter custom SQL query (e.g. SELECT department, AVG(salary) FROM tbl_sheet1_604870 GROUP BY department)"
              value={customSql}
              onChange={(e) => setCustomSql(e.target.value)}
              className="w-full bg-[#101216] border border-[#343844] rounded-lg p-2 text-xs font-mono text-emerald-400 placeholder-zinc-500 focus:outline-none focus:border-amber-400 resize-none"
            />
          </div>
          <div className="flex md:flex-col justify-end gap-2 shrink-0">
            <button
              type="submit"
              disabled={loadingDashboard || !customSql.trim()}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition cursor-pointer shadow-sm disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-black" />
              <span>Generate Dashboard</span>
            </button>
          </div>
        </form>
      )}

      {/* Interactive Slicers Bar */}
      {dashboardData?.visuals?.slicers && Object.keys(dashboardData.visuals.slicers).length > 0 && (
        <div className="bg-[#13151a] border-b border-[#22252e] px-5 py-2 flex items-center space-x-3 overflow-x-auto no-scrollbar shrink-0 text-xs">
          <span className="font-bold text-zinc-400 flex items-center gap-1 uppercase tracking-wider text-[11px] shrink-0">
            <SlidersHorizontal className="w-3 h-3 text-amber-400" /> Slicers:
          </span>
          {Object.entries(dashboardData.visuals.slicers).map(([colName, vals]) => (
            <div key={colName} className="flex items-center space-x-1.5 bg-[#1a1c24] border border-[#2c303c] rounded-lg px-2 py-1 shrink-0">
              <span className="text-zinc-400 font-bold text-[11px]">{colName}:</span>
              <div className="flex items-center space-x-1">
                {vals.slice(0, 5).map(val => {
                  const isSelected = selectedSlicers[colName] === val;
                  return (
                    <button
                      key={val}
                      onClick={() => handleToggleSlicer(colName, val)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                        isSelected
                          ? 'bg-amber-500 text-black font-bold'
                          : 'bg-[#22252e] text-zinc-300 hover:text-white hover:bg-[#2b2f3a]'
                      }`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {Object.keys(selectedSlicers).length > 0 && (
            <button
              onClick={() => setSelectedSlicers({})}
              className="text-[11px] text-amber-400 hover:underline font-bold shrink-0 ml-1"
            >
              Clear Slicers
            </button>
          )}
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div className="m-4 p-3.5 bg-rose-950/70 border border-rose-700/80 rounded-xl text-rose-200 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Power BI Visual Canvas */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden bg-[#0d0e12]">
        
        {loadingDashboard ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center animate-spin">
              <RefreshCw className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-xs font-bold text-zinc-300">Generating interactive Power BI Report Canvas from SQL...</p>
          </div>
        ) : !dashboardData ? (
          <div className="flex-1 flex items-center justify-center text-zinc-500 text-xs">
            Select a SQL query above to generate its Power BI dashboard.
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full overflow-y-auto p-5 md:p-6 space-y-6">
            
            {/* KPI Cards (Power BI Metric Tiles) */}
            {dashboardData.kpis && dashboardData.kpis.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {dashboardData.kpis.map((kpi, idx) => (
                  <div key={idx} className="bg-[#181a20] border border-[#2a2d36] rounded-2xl p-4 shadow-md space-y-1">
                    <div className="text-zinc-400 text-xs font-semibold truncate" title={kpi.label}>
                      {kpi.label}
                    </div>
                    <div className="text-xl md:text-2xl font-black text-amber-400 font-mono">
                      {kpi.value}
                    </div>
                    <p className="text-[10px] text-zinc-500 truncate" title={kpi.subtitle}>
                      {kpi.subtitle}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Multi-Visual Power BI Layout: Visual 1 (Bar/Line) + Visual 2 (Donut) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Visual 1: Primary Aggregated Chart */}
              <div className="lg:col-span-2 bg-[#181a20] border border-[#2a2d36] rounded-2xl p-5 shadow-md space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#262832] pb-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-white">
                      {dynamicVisuals.primaryTitle || 'Primary Visual Analytics'}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Grouped distribution for <code className="text-amber-300 font-mono">{dynamicVisuals.primaryXKey || 'Dimensions'}</code>
                    </p>
                  </div>

                  {/* Chart Type Tabs */}
                  <div className="flex items-center bg-[#101216] border border-[#2a2d36] rounded-xl p-1 space-x-1">
                    <button
                      onClick={() => setActiveChartType('bar')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                        activeChartType === 'bar' ? 'bg-amber-500 text-black font-extrabold' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>Bar</span>
                    </button>
                    <button
                      onClick={() => setActiveChartType('line')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                        activeChartType === 'line' ? 'bg-amber-500 text-black font-extrabold' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Line</span>
                    </button>
                  </div>
                </div>

                <div className="w-full h-72 md:h-80 pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    {activeChartType === 'line' ? (
                      <LineChart data={dynamicVisuals.primaryData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#262a34" />
                        <XAxis dataKey={dynamicVisuals.primaryXKey} stroke="#71717a" fontSize={11} tickLine={false} />
                        <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#181a20', borderColor: '#343844', borderRadius: '12px', fontSize: '12px' }} />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        {dynamicVisuals.primaryYKeys?.map((k, i) => (
                          <Line key={k} type="monotone" dataKey={k} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2.5} dot={{ r: 3 }} />
                        ))}
                      </LineChart>
                    ) : (
                      <BarChart data={dynamicVisuals.primaryData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#262a34" />
                        <XAxis dataKey={dynamicVisuals.primaryXKey} stroke="#71717a" fontSize={11} tickLine={false} />
                        <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#181a20', borderColor: '#343844', borderRadius: '12px', fontSize: '12px' }} />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        {dynamicVisuals.primaryYKeys?.map((k, i) => (
                          <Bar key={k} dataKey={k} fill={PALETTE[i % PALETTE.length]} radius={[6, 6, 0, 0]} />
                        ))}
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Visual 2: Secondary Donut Share */}
              <div className="bg-[#181a20] border border-[#2a2d36] rounded-2xl p-5 shadow-md space-y-4 flex flex-col justify-between">
                <div className="border-b border-[#262832] pb-3">
                  <h3 className="text-sm font-extrabold text-white">
                    {dynamicVisuals.donutTitle || 'Dimensional Distribution'}
                  </h3>
                  <p className="text-xs text-zinc-400">Share breakdown</p>
                </div>

                <div className="w-full h-64 md:h-72">
                  {dynamicVisuals.donutData && dynamicVisuals.donutData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={dynamicVisuals.donutData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                        >
                          {dynamicVisuals.donutData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#181a20', borderColor: '#343844', borderRadius: '12px', fontSize: '12px' }} />
                        <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
                      </RechartsPie>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
                      Single dimension dataset
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Visual 3: Cross-Tab Matrix (Pivot Breakdown) */}
            {dashboardData.visuals?.matrix?.matrixData && dashboardData.visuals.matrix.matrixData.length > 0 && (
              <div className="bg-[#181a20] border border-[#2a2d36] rounded-2xl p-5 shadow-md space-y-3">
                <div className="flex items-center justify-between border-b border-[#262832] pb-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <Grid className="w-4 h-4 text-amber-400" />
                      <span>Power BI Matrix Breakdown</span>
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Cross-tabulation: <span className="text-amber-300 font-bold">{dashboardData.visuals.matrix.rowKey}</span> &times; <span className="text-indigo-300 font-bold">{dashboardData.visuals.matrix.colKey}</span>
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-[#2e323c] rounded-xl max-h-60">
                  <table className="w-full text-left text-xs border-collapse font-sans">
                    <thead className="bg-[#14161c] text-zinc-300 font-bold border-b border-[#2e323c] sticky top-0">
                      <tr>
                        {Object.keys(dashboardData.visuals.matrix.matrixData[0] || {}).map((col, idx) => (
                          <th key={idx} className="p-2.5 font-mono text-zinc-300 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#22252e] bg-[#181a20]">
                      {dashboardData.visuals.matrix.matrixData.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-[#20232b] transition">
                          {Object.keys(dashboardData.visuals.matrix.matrixData[0] || {}).map((col, cIdx) => (
                            <td key={cIdx} className="p-2.5 text-zinc-300 font-mono text-[11px] whitespace-nowrap">
                              {row[col] !== undefined && row[col] !== null ? String(row[col]) : '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SQL Results Matrix Grid */}
            <div className="bg-[#181a20] border border-[#2a2d36] rounded-2xl p-5 shadow-md space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-amber-400" />
                    <span>Detailed Records Grid</span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Showing {slicedRows.length} of {dashboardData.totalRows} records
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Search Slicer */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Filter rows..."
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      className="bg-[#101216] border border-[#2e323c] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <button
                    onClick={handleExportCsv}
                    className="px-3 py-1.5 bg-[#22242c] hover:bg-[#2b2e38] text-zinc-200 border border-[#343844] rounded-lg text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto border border-[#2e323c] rounded-xl max-h-80">
                <table className="w-full text-left text-xs border-collapse font-sans">
                  <thead className="bg-[#14161c] text-zinc-300 font-bold border-b border-[#2e323c] sticky top-0 z-10">
                    <tr>
                      {dashboardData.columns.map((col, idx) => (
                        <th key={idx} className="p-3 whitespace-nowrap font-mono text-zinc-300">
                          {col.name}
                          <span className="ml-1 text-[10px] text-zinc-500 font-normal">({col.type})</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#22252e] bg-[#181a20]">
                    {slicedRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-[#20232b] transition">
                        {dashboardData.columns.map((col, cIdx) => (
                          <td key={cIdx} className="p-3 text-zinc-300 font-mono whitespace-nowrap text-[11px]">
                            {row[col.name] !== null && row[col.name] !== undefined ? String(row[col.name]) : <span className="text-zinc-600">NULL</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Underlying SQL Query Box */}
              <div className="p-3 bg-[#0d0e12] border border-[#262932] rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Executed SQL:</span>
                <pre className="text-[11px] font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap">
                  {dashboardData.sql}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* DAX Copilot Sidebar Drawer */}
        {isCopilotOpen && (
          <div className="w-80 md:w-96 bg-[#16181f] border-l border-[#2e323c] flex flex-col h-full z-20 shadow-2xl animate-fadeIn shrink-0">
            <div className="p-4 border-b border-[#2e323c] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-extrabold text-white">Power BI DAX Copilot</h3>
              </div>
              <button onClick={() => setIsCopilotOpen(false)} className="p-1 text-zinc-400 hover:text-white rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200/90 leading-relaxed">
                <span className="font-bold text-amber-300">Query Target:</span> Generating DAX expressions tailored to the columns in this SQL query result.
              </div>

              {/* Sample Prompts */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Common DAX Formulas:</span>
                <div className="flex flex-col gap-1.5">
                  {[
                    'Calculate YoY Growth %',
                    'Weighted Average calculation',
                    'Rank rows in descending order'
                  ].map((sug, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setDaxPrompt(sug)}
                      className="text-left px-3 py-2 bg-[#20232b] hover:bg-[#282c36] border border-[#2e323c] rounded-lg text-zinc-300 hover:text-white transition"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Form */}
              <form onSubmit={handleGenerateDax} className="space-y-2 pt-2">
                <textarea
                  rows={3}
                  value={daxPrompt}
                  onChange={(e) => setDaxPrompt(e.target.value)}
                  placeholder="Describe your desired calculation..."
                  className="w-full bg-[#101216] border border-[#343844] focus:border-amber-400 rounded-xl p-3 text-white text-xs placeholder-zinc-500 resize-none focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isGeneratingDax || !daxPrompt.trim()}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded-xl transition cursor-pointer flex items-center justify-center space-x-1.5 shadow-sm disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isGeneratingDax ? 'Generating...' : 'Generate DAX Formula'}</span>
                </button>
              </form>

              {/* DAX Result Card */}
              {daxResult && (
                <div className="p-3.5 bg-[#101216] border border-amber-500/40 rounded-xl space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300">{daxResult.name}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(daxResult.formula);
                        setSuccessMsg('DAX Formula copied!');
                        setTimeout(() => setSuccessMsg(null), 3000);
                      }}
                      className="px-2 py-1 bg-[#20232b] hover:bg-[#282c36] border border-zinc-700 text-zinc-300 text-[10px] font-bold rounded flex items-center space-x-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                  </div>
                  <pre className="p-2.5 bg-[#08090c] border border-[#262832] rounded-lg text-emerald-400 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap">
                    {daxResult.formula}
                  </pre>
                  <p className="text-[11px] text-zinc-400">{daxResult.explanation}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Power Query M-Code Modal for this SQL Query */}
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

            <p className="text-zinc-300">
              Paste this in <strong className="text-white">Power BI Desktop &rarr; Transform Data &rarr; Advanced Editor</strong> to load this exact query result:
            </p>

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

      {/* 1-Click Power BI Desktop Connection Helper Modal */}
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

            <div className="space-y-2.5">
              <p className="font-bold text-zinc-300">When prompted by Power BI Desktop for Database Credentials:</p>

              <div className="space-y-2 bg-[#101216] border border-[#2a2d36] rounded-xl p-3.5">
                {/* Server */}
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 font-medium">Server:</span>
                  <div className="flex items-center space-x-2">
                    <code className="text-amber-300 font-mono text-[11px]">{schemaData?.dbConfig?.host || 'dpg-da6a63e1egvs739u0880-a.oregon-postgres.render.com'}</code>
                    <button
                      onClick={() => handleCopyText(schemaData?.dbConfig?.host || 'dpg-da6a63e1egvs739u0880-a.oregon-postgres.render.com', 'server')}
                      className="px-2 py-0.5 bg-[#22242c] hover:bg-[#2b2e38] text-zinc-300 text-[10px] font-bold rounded flex items-center gap-1"
                    >
                      {copiedField === 'server' ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === 'server' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Database */}
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 font-medium">Database:</span>
                  <div className="flex items-center space-x-2">
                    <code className="text-amber-300 font-mono text-[11px]">{schemaData?.dbConfig?.database || 'datamind_app2'}</code>
                    <button
                      onClick={() => handleCopyText(schemaData?.dbConfig?.database || 'datamind_app2', 'database')}
                      className="px-2 py-0.5 bg-[#22242c] hover:bg-[#2b2e38] text-zinc-300 text-[10px] font-bold rounded flex items-center gap-1"
                    >
                      {copiedField === 'database' ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === 'database' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* User Name */}
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 font-medium">User Name:</span>
                  <div className="flex items-center space-x-2">
                    <code className="text-amber-300 font-mono text-[11px]">{schemaData?.dbConfig?.user || 'postgresql'}</code>
                    <button
                      onClick={() => handleCopyText(schemaData?.dbConfig?.user || 'postgresql', 'user')}
                      className="px-2 py-0.5 bg-[#22242c] hover:bg-[#2b2e38] text-zinc-300 text-[10px] font-bold rounded flex items-center gap-1"
                    >
                      {copiedField === 'user' ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === 'user' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Password */}
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 font-medium">Password:</span>
                  <div className="flex items-center space-x-2">
                    <code className="text-amber-300 font-mono text-[11px]">{schemaData?.dbConfig?.password || 'wAgTT2iOebYIxkk8pT6dupwZiocVzm0Q'}</code>
                    <button
                      onClick={() => handleCopyText(schemaData?.dbConfig?.password || 'wAgTT2iOebYIxkk8pT6dupwZiocVzm0Q', 'password')}
                      className="px-2 py-0.5 bg-[#22242c] hover:bg-[#2b2e38] text-zinc-300 text-[10px] font-bold rounded flex items-center gap-1"
                    >
                      {copiedField === 'password' ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === 'password' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>
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
