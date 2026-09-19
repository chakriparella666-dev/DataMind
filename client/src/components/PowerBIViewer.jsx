import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Download, Copy, CheckCheck, RefreshCw, Database, BarChart2,
  Sparkles, Layers, Check, AlertCircle, Code, Filter,
  FileSpreadsheet, Play, Activity, Search,
  ChevronRight, ChevronDown, Terminal, PieChart as PieIcon, TrendingUp, BarChart3, X,
  Grid, SlidersHorizontal, Settings2, RotateCcw, ArrowLeft, Maximize2,
  Hash, Calendar, Type, Eye, Table as TableIcon, FileText, Zap, ChevronUp
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart as RechartsPie,
  Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart
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

export default function PowerBIViewer({ initialQuery, onNavigate }) {
  // Page Tab state (like Power BI Desktop Page 1, Page 2, Page 3)
  const [activeCanvasPage, setActiveCanvasPage] = useState('page1'); // 'page1' (Executive), 'page2' (Analytics), 'page3' (Data Grid)

  // Queries & Active Dashboard State
  const [queriesList, setQueriesList] = useState([]);
  const [activeQuery, setActiveQuery] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [schemaData, setSchemaData] = useState(null);

  // UI, Slicer & Customization States
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [activeChartType, setActiveChartType] = useState('bar'); // 'bar' | 'column' | 'line' | 'area' | 'composed' | 'donut'
  const [selectedSlicers, setSelectedSlicers] = useState({}); // { [colName]: selectedVal }
  const [filterText, setFilterText] = useState('');
  const [activeRibbonTab, setActiveRibbonTab] = useState('home'); // 'home' | 'visuals' | 'modeling' | 'view'

  // Visual Customizer Field Wells (X-Axis, Y-Axis, Aggregation Method)
  const [customXAxis, setCustomXAxis] = useState('');
  const [customYAxis, setCustomYAxis] = useState([]); // array of selected metric names
  const [aggFunction, setAggFunction] = useState('SUM'); // 'SUM' | 'AVG' | 'COUNT' | 'MAX' | 'MIN'
  const [showRightPane, setShowRightPane] = useState(true); // Power BI Right Sidebar (Visualizations & Fields)
  const [rightPaneTab, setRightPaneTab] = useState('visuals'); // 'visuals' | 'fields' | 'filters'
  const [showDataLabels, setShowDataLabels] = useState(true);

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

  // Power BI REST API Integration State
  const [showApiModal, setShowApiModal] = useState(false);
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
  const [activeViewMode, setActiveViewMode] = useState('canvas'); // 'canvas' | 'embed'
  const [autoAxesReason, setAutoAxesReason] = useState('');

  // Smart Best Axes Recommendation Engine
  const computeBestAxes = (cols) => {
    if (!cols || cols.length === 0) {
      return { x: '', y: ['Record Count'], agg: 'SUM', reason: 'Default count' };
    }
    const textCols = cols.filter(c => c.type !== 'numeric').map(c => c.name);
    const numCols = cols.filter(c => c.type === 'numeric').map(c => c.name);

    // 1. Check for temporal/time columns for trends (X-Axis)
    const timeKeywords = ['date', 'month', 'year', 'quarter', 'day', 'time', 'created', 'period', 'week'];
    let bestX = textCols.find(col => timeKeywords.some(k => col.toLowerCase().includes(k)));

    // 2. Check for primary nominal/categorical dimensions (X-Axis)
    if (!bestX) {
      const dimKeywords = ['segment', 'country', 'product', 'category', 'dept', 'department', 'name', 'brand', 'region', 'status', 'company', 'role', 'title'];
      bestX = textCols.find(col => dimKeywords.some(k => col.toLowerCase().includes(k)));
    }

    // 3. Fallback to first text column, or first available column
    if (!bestX) {
      bestX = textCols[0] || cols[0]?.name || 'Dimension';
    }

    // 4. Select best Y-axis metrics
    let bestY = [];
    let bestAgg = 'SUM';
    let reason = '';

    if (numCols.length > 0) {
      const metricKeywords = ['sales', 'gross', 'profit', 'revenue', 'units', 'unit', 'amount', 'salary', 'price', 'score', 'cost', 'total', 'val'];
      const matched = numCols.filter(col => metricKeywords.some(k => col.toLowerCase().includes(k)));
      bestY = matched.length > 0 ? matched.slice(0, 2) : numCols.slice(0, 2);

      const firstMetric = (bestY[0] || '').toLowerCase();
      if (firstMetric.includes('price') || firstMetric.includes('rate') || firstMetric.includes('score') || firstMetric.includes('avg') || firstMetric.includes('salary')) {
        bestAgg = 'AVG';
        reason = `Auto-Selected: Average ${bestY.join(', ')} grouped by ${bestX}`;
      } else {
        bestAgg = 'SUM';
        reason = `Auto-Selected: Total ${bestY.join(', ')} grouped by ${bestX}`;
      }
    } else {
      bestY = ['Record Count'];
      bestAgg = 'COUNT';
      reason = `Auto-Selected: Frequency count grouped by ${bestX}`;
    }

    return { x: bestX, y: bestY, agg: bestAgg, reason };
  };

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
  }, [initialQuery]);

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

        // Auto-select smart optimal X-axis and Y-axis
        const auto = computeBestAxes(res.dashboard.columns || []);
        setCustomXAxis(auto.x);
        setCustomYAxis(auto.y);
        setAggFunction(auto.agg);
        setAutoAxesReason(auto.reason);
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

  // Dynamic Sliced Rows (Client-side interactive cross-filtering)
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

  // Dynamically recompute visual data based on chosen X-Axis, Y-Axis metrics & Slicers
  const dynamicVisuals = useMemo(() => {
    if (!dashboardData?.columns || slicedRows.length === 0) {
      return {
        primaryData: [],
        donutData: [],
        xKey: '',
        yKeys: [],
        title: ''
      };
    }

    const cols = dashboardData.columns;
    const textCols = cols.filter(c => c.type !== 'numeric').map(c => c.name);
    const numCols = cols.filter(c => c.type === 'numeric').map(c => c.name);

    // Chosen X Dimension
    const xKey = customXAxis || textCols[0] || cols[0]?.name || 'Dimension';
    const secondaryDim = textCols.find(c => c !== xKey) || textCols[0] || xKey;

    // Chosen Y Metrics
    const selectedNumeric = customYAxis.filter(y => numCols.includes(y));
    const isCountMode = customYAxis.includes('Record Count') || selectedNumeric.length === 0;

    const groupMap = {};
    const groupCount = {};

    slicedRows.forEach(r => {
      const xVal = r[xKey] !== null && r[xKey] !== undefined ? String(r[xKey]).trim() : 'Unknown';
      if (!groupMap[xVal]) {
        groupMap[xVal] = { [xKey]: xVal };
        groupCount[xVal] = 0;
      }
      groupCount[xVal] += 1;

      if (isCountMode) {
        groupMap[xVal]['Record Count'] = (groupMap[xVal]['Record Count'] || 0) + 1;
      } else {
        selectedNumeric.forEach(m => {
          const num = Number(r[m]) || 0;
          if (aggFunction === 'SUM') {
            groupMap[xVal][m] = (groupMap[xVal][m] || 0) + num;
          } else if (aggFunction === 'MAX') {
            groupMap[xVal][m] = Math.max(groupMap[xVal][m] !== undefined ? groupMap[xVal][m] : -Infinity, num);
          } else if (aggFunction === 'MIN') {
            groupMap[xVal][m] = Math.min(groupMap[xVal][m] !== undefined ? groupMap[xVal][m] : Infinity, num);
          } else if (aggFunction === 'AVG') {
            groupMap[xVal][m] = (groupMap[xVal][m] || 0) + num;
          }
        });
      }
    });

    // Finalize Averages
    if (aggFunction === 'AVG' && !isCountMode) {
      Object.keys(groupMap).forEach(k => {
        selectedNumeric.forEach(m => {
          groupMap[k][m] = Math.round((groupMap[k][m] / (groupCount[k] || 1)) * 100) / 100;
        });
      });
    }

    const primaryData = Object.values(groupMap);
    const activeYKeys = isCountMode ? ['Record Count'] : selectedNumeric;

    // Secondary Donut Share Data (on secondary dimension)
    const donutMap = {};
    slicedRows.forEach(r => {
      const dKey = r[secondaryDim] !== null && r[secondaryDim] !== undefined ? String(r[secondaryDim]).trim() : 'Unknown';
      const metricVal = !isCountMode && selectedNumeric.length > 0 ? (Number(r[selectedNumeric[0]]) || 1) : 1;
      donutMap[dKey] = (donutMap[dKey] || 0) + metricVal;
    });

    const donutData = Object.entries(donutMap).map(([name, value]) => ({
      name,
      value: Math.round(value * 100) / 100
    }));

    return {
      primaryData,
      donutData,
      xKey,
      yKeys: activeYKeys,
      title: `${aggFunction} of ${activeYKeys.join(', ').replace(/_/g, ' ')} by ${xKey.replace(/_/g, ' ')}`,
      donutTitle: `${activeYKeys[0] || 'Share'} by ${secondaryDim.replace(/_/g, ' ')}`
    };
  }, [dashboardData?.columns, slicedRows, customXAxis, customYAxis, aggFunction]);

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
    <div className="flex-1 flex flex-col h-full bg-[#111317] text-slate-100 font-sans antialiased overflow-hidden select-none">
      
      {/* Power BI Signature Top Studio Ribbon Bar */}
      <div className="bg-[#181a20] border-b border-[#252830] shrink-0">
        
        {/* Ribbon Header Brand Row */}
        <div className="px-4 py-2 flex items-center justify-between border-b border-[#23252d]">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-amber-600 px-2.5 py-1 rounded-lg text-black font-black text-xs shadow-md">
              <BarChart2 className="w-4 h-4 fill-black" />
              <span className="tracking-tight">Power BI Studio</span>
            </div>
            <div className="h-4 w-[1px] bg-zinc-700 hidden sm:block"></div>
            <h1 className="text-xs font-bold text-white tracking-wide truncate max-w-sm hidden sm:block">
              {dashboardData?.question || activeQuery?.title || 'Live Executive Report Canvas'}
            </h1>
          </div>

          {/* Quick Action Ribbon Controls */}
          <div className="flex items-center space-x-1.5">
            {/* ⚡ 1-Click Power BI Desktop */}
            <button
              onClick={handleDownloadPbids}
              className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs rounded-lg flex items-center space-x-1.5 shadow-sm active:scale-95 transition cursor-pointer"
              title="Download Power BI Desktop DirectQuery File (.pbids)"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">1-Click Power BI</span>
            </button>

            {/* Power Query M */}
            <button
              onClick={() => setShowMCodeModal(true)}
              className="px-2.5 py-1.5 bg-[#22252e] hover:bg-[#2c303c] text-zinc-200 border border-[#343844] font-bold text-xs rounded-lg flex items-center space-x-1 transition cursor-pointer"
              title="View Power Query M-Script"
            >
              <Code className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">M-Code</span>
            </button>

            {/* Power BI REST API */}
            <button
              onClick={() => setShowApiModal(true)}
              className="px-2.5 py-1.5 bg-[#22252e] hover:bg-[#2c303c] text-amber-300 border border-amber-500/40 font-bold text-xs rounded-lg flex items-center space-x-1 transition cursor-pointer"
              title="Power BI REST API & Azure Settings"
            >
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">API Config</span>
            </button>

            {/* DAX Copilot */}
            <button
              onClick={() => setIsCopilotOpen(!isCopilotOpen)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer ${
                isCopilotOpen ? 'bg-amber-400 text-black font-black' : 'bg-[#22252e] text-amber-300 border border-amber-500/30'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">DAX AI</span>
            </button>

            {/* Refresh */}
            <button
              onClick={() => runQueryDashboard(customSql || activeQuery?.sql, customQuestion || activeQuery?.question)}
              className="p-1.5 bg-[#22252e] hover:bg-[#2c303c] text-zinc-300 hover:text-white border border-[#343844] rounded-lg transition cursor-pointer"
              title="Re-execute Live Query"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDashboard ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Ribbon Command Sub-Bar (Generated Queries + Customizer Trigger) */}
        <div className="px-4 py-2 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar text-xs">
          
          {/* Query Pills Carousel */}
          <div className="flex items-center space-x-1.5 shrink-0 overflow-x-auto no-scrollbar">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1 shrink-0">
              <Layers className="w-3 h-3 text-amber-400" /> Reports:
            </span>
            {queriesList.map((q) => {
              const isSelected = activeQuery && String(activeQuery.id || activeQuery._id) === String(q.id || q._id);
              const displayTitle = q.question || q.name || 'SQL Query';
              return (
                <button
                  key={q.id || q._id}
                  onClick={() => handleSelectSavedQuery(q)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition shrink-0 max-w-xs truncate ${
                    isSelected
                      ? 'bg-amber-500 text-black font-extrabold shadow-sm'
                      : 'bg-[#20232a] text-zinc-300 hover:text-white hover:bg-[#2a2e38] border border-[#2c303a]'
                  }`}
                  title={displayTitle}
                >
                  {displayTitle}
                </button>
              );
            })}

            <button
              onClick={() => setIsEditingSql(!isEditingSql)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition shrink-0 flex items-center gap-1 border ${
                isEditingSql ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-[#1e2029] text-indigo-400 border-indigo-500/40'
              }`}
            >
              <Terminal className="w-3 h-3" />
              <span>{isEditingSql ? 'Close SQL' : 'Custom SQL'}</span>
            </button>
          </div>

          {/* Toggle Visualizations / Fields Sidebar */}
          <button
            onClick={() => setShowRightPane(!showRightPane)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition shrink-0 flex items-center gap-1 border ${
              showRightPane ? 'bg-[#2a2e3a] text-amber-300 border-amber-500/50' : 'bg-[#1e2029] text-zinc-400 border-[#2f333f]'
            }`}
          >
            <Settings2 className="w-3 h-3" />
            <span>{showRightPane ? 'Hide Build Pane' : 'Show Build Pane'}</span>
          </button>
        </div>
      </div>

      {/* Custom SQL Drawer */}
      {isEditingSql && (
        <form onSubmit={handleRunCustomQuery} className="bg-[#181a22] border-b border-[#2e323c] p-4 flex flex-col md:flex-row gap-3 animate-fadeIn shrink-0">
          <div className="flex-1 space-y-2">
            <input
              type="text"
              placeholder="Report question (e.g. Total Sales and Profit by Segment)"
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              className="w-full bg-[#101216] border border-[#343844] rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
            />
            <textarea
              rows={2}
              placeholder="SELECT segment, SUM(gross_sales), SUM(profit) FROM tbl_sheet1_604870 GROUP BY segment"
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
              <span>Render Report</span>
            </button>
          </div>
        </form>
      )}

      {/* Slicers Bar */}
      {dashboardData?.visuals?.slicers && Object.keys(dashboardData.visuals.slicers).length > 0 && (
        <div className="bg-[#14161d] border-b border-[#22252e] px-4 py-2 flex items-center space-x-3 overflow-x-auto no-scrollbar shrink-0 text-xs">
          <span className="font-bold text-zinc-400 flex items-center gap-1 uppercase tracking-wider text-[10px] shrink-0">
            <SlidersHorizontal className="w-3 h-3 text-amber-400" /> Slicers:
          </span>
          {Object.entries(dashboardData.visuals.slicers).map(([colName, vals]) => (
            <div key={colName} className="flex items-center space-x-1 bg-[#1a1d26] border border-[#2b2f3c] rounded-lg px-2 py-0.5 shrink-0">
              <span className="text-zinc-400 font-bold text-[10px]">{colName}:</span>
              <div className="flex items-center space-x-1">
                {vals.slice(0, 6).map(val => {
                  const isSelected = selectedSlicers[colName] === val;
                  return (
                    <button
                      key={val}
                      onClick={() => handleToggleSlicer(colName, val)}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                        isSelected
                          ? 'bg-amber-500 text-black font-extrabold'
                          : 'bg-[#222632] text-zinc-300 hover:text-white hover:bg-[#2b3040]'
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
              className="text-[10px] text-amber-400 hover:underline font-bold shrink-0 ml-1 cursor-pointer"
            >
              Clear All Slicers
            </button>
          )}
        </div>
      )}

      {/* Main Workspace (Canvas on Left + Power BI Visual & Field Pane on Right) */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden bg-[#0d0e12]">
        
        {/* Left: Interactive Power BI Report Canvas */}
        <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
          
          {/* Main Visual Content Viewport */}
          <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-5">
            {loadingDashboard ? (
              <div className="h-full flex flex-col items-center justify-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center animate-spin">
                  <RefreshCw className="w-5 h-5 text-amber-400" />
                </div>
                <p className="text-xs font-bold text-zinc-300">Rendering live Power BI visuals...</p>
              </div>
            ) : !dashboardData ? (
              <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
                Select a report query to view interactive Power BI dashboard.
              </div>
            ) : (
              <>
                {/* Executive KPI Metric Tiles */}
                {dashboardData.kpis && dashboardData.kpis.length > 0 && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {dashboardData.kpis.map((kpi, idx) => (
                      <div
                        key={idx}
                        className="bg-[#181a22] border border-[#292c37] hover:border-amber-500/40 rounded-xl p-3.5 shadow-md space-y-1 transition"
                      >
                        <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
                          <span className="truncate" title={kpi.label}>{kpi.label}</span>
                          <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                        </div>
                        <div className="text-xl md:text-2xl font-black text-amber-400 font-mono tracking-tight">
                          {kpi.value}
                        </div>
                        <div className="flex items-center space-x-1 text-[10px] text-zinc-500">
                          <span className="text-emerald-400 font-bold">● Active</span>
                          <span className="truncate">&bull; {kpi.subtitle}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Page 1: Executive Overview Multi-Visual Layout */}
                {activeCanvasPage === 'page1' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    
                    {/* Primary Aggregated Chart Visual */}
                    <div className="lg:col-span-2 bg-[#181a22] border border-[#292c37] rounded-xl p-4 shadow-md space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#262934] pb-2.5">
                        <div>
                          <h3 className="text-sm font-extrabold text-white">
                            {dynamicVisuals.title || 'Primary Visual'}
                          </h3>
                          <p className="text-[11px] text-zinc-400">
                            X: <span className="text-amber-300 font-mono font-bold">{dynamicVisuals.xKey}</span> | Y: <span className="text-indigo-300 font-mono">{dynamicVisuals.yKeys.join(', ')}</span> ({aggFunction})
                          </p>
                        </div>

                        {/* Visual Type Mini Switcher */}
                        <div className="flex items-center bg-[#101216] border border-[#282b35] rounded-lg p-0.5 space-x-1">
                          {[
                            { type: 'bar', label: 'Bar', icon: BarChart3 },
                            { type: 'line', label: 'Line', icon: TrendingUp },
                            { type: 'area', label: 'Area', icon: Activity }
                          ].map(t => (
                            <button
                              key={t.type}
                              onClick={() => setActiveChartType(t.type)}
                              className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                                activeChartType === t.type ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white'
                              }`}
                            >
                              <t.icon className="w-3 h-3" />
                              <span>{t.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="w-full h-72 md:h-80 pt-1">
                        <ResponsiveContainer width="100%" height="100%">
                          {activeChartType === 'line' ? (
                            <LineChart data={dynamicVisuals.primaryData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#252834" />
                              <XAxis dataKey={dynamicVisuals.xKey} stroke="#71717a" fontSize={11} tickLine={false} />
                              <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
                              <Tooltip contentStyle={{ backgroundColor: '#181a20', borderColor: '#343844', borderRadius: '12px', fontSize: '12px' }} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                              {dynamicVisuals.yKeys.map((k, i) => (
                                <Line key={k} type="monotone" dataKey={k} stroke={PALETTE[i % PALETTE.length]} strokeWidth={3} dot={{ r: 4 }} />
                              ))}
                            </LineChart>
                          ) : activeChartType === 'area' ? (
                            <AreaChart data={dynamicVisuals.primaryData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#252834" />
                              <XAxis dataKey={dynamicVisuals.xKey} stroke="#71717a" fontSize={11} tickLine={false} />
                              <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
                              <Tooltip contentStyle={{ backgroundColor: '#181a20', borderColor: '#343844', borderRadius: '12px', fontSize: '12px' }} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                              {dynamicVisuals.yKeys.map((k, i) => (
                                <Area key={k} type="monotone" dataKey={k} stroke={PALETTE[i % PALETTE.length]} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.25} strokeWidth={2.5} />
                              ))}
                            </AreaChart>
                          ) : (
                            <BarChart data={dynamicVisuals.primaryData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#252834" />
                              <XAxis dataKey={dynamicVisuals.xKey} stroke="#71717a" fontSize={11} tickLine={false} />
                              <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
                              <Tooltip contentStyle={{ backgroundColor: '#181a20', borderColor: '#343844', borderRadius: '12px', fontSize: '12px' }} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                              {dynamicVisuals.yKeys.map((k, i) => (
                                <Bar key={k} dataKey={k} fill={PALETTE[i % PALETTE.length]} radius={[6, 6, 0, 0]} />
                              ))}
                            </BarChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Secondary Donut Breakdown */}
                    <div className="bg-[#181a22] border border-[#292c37] rounded-xl p-4 shadow-md space-y-3 flex flex-col justify-between">
                      <div className="border-b border-[#262934] pb-2">
                        <h3 className="text-sm font-extrabold text-white">
                          {dynamicVisuals.donutTitle || 'Categorical Share'}
                        </h3>
                        <p className="text-[10px] text-zinc-400">Distribution proportion</p>
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
                            Single dimensional metric
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Page 2 or Always Visible Matrix & Breakdown */}
                {(activeCanvasPage === 'page2' || activeCanvasPage === 'page1') && dashboardData.visuals?.matrix?.matrixData && dashboardData.visuals.matrix.matrixData.length > 0 && (
                  <div className="bg-[#181a22] border border-[#292c37] rounded-xl p-4 shadow-md space-y-3">
                    <div className="flex items-center justify-between border-b border-[#262934] pb-2">
                      <div className="flex items-center space-x-2">
                        <Grid className="w-4 h-4 text-amber-400" />
                        <h3 className="text-sm font-extrabold text-white">Power BI 2D Pivot Matrix</h3>
                      </div>
                      <span className="text-[11px] text-zinc-400">
                        {dashboardData.visuals.matrix.rowKey} &times; {dashboardData.visuals.matrix.colKey}
                      </span>
                    </div>

                    <div className="overflow-x-auto border border-[#292d38] rounded-lg max-h-60">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-[#12141a] text-zinc-300 font-bold border-b border-[#292d38] sticky top-0">
                          <tr>
                            {Object.keys(dashboardData.visuals.matrix.matrixData[0] || {}).map((col, idx) => (
                              <th key={idx} className="p-2.5 font-mono text-zinc-300 whitespace-nowrap">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#20232d] bg-[#181a22]">
                          {dashboardData.visuals.matrix.matrixData.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-[#222530] transition">
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

                {/* Page 3 or Detailed Records Grid */}
                {(activeCanvasPage === 'page3' || activeCanvasPage === 'page1') && (
                  <div className="bg-[#181a22] border border-[#292c37] rounded-xl p-4 shadow-md space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <Database className="w-4 h-4 text-amber-400" />
                        <h3 className="text-sm font-extrabold text-white">Query Results Grid</h3>
                        <span className="text-[11px] text-zinc-400">({slicedRows.length} records)</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <div className="relative">
                          <Search className="w-3 h-3 absolute left-2.5 top-2 text-zinc-500" />
                          <input
                            type="text"
                            placeholder="Filter records..."
                            value={filterText}
                            onChange={(e) => setFilterText(e.target.value)}
                            className="bg-[#101216] border border-[#2c303c] rounded-lg pl-7 pr-2.5 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        <button
                          onClick={handleExportCsv}
                          className="px-2.5 py-1 bg-[#222632] hover:bg-[#2b3040] text-zinc-200 border border-[#343844] rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                        >
                          <FileSpreadsheet className="w-3 h-3 text-emerald-400" />
                          <span>Export CSV</span>
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-[#292d38] rounded-lg max-h-64">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-[#12141a] text-zinc-300 font-bold border-b border-[#292d38] sticky top-0 z-10">
                          <tr>
                            {dashboardData.columns.map((col, idx) => (
                              <th key={idx} className="p-2.5 whitespace-nowrap font-mono text-zinc-300">
                                {col.name} <span className="text-[10px] text-zinc-500">({col.type})</span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#20232d] bg-[#181a22]">
                          {slicedRows.slice(0, 50).map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-[#222530] transition">
                              {dashboardData.columns.map((col, cIdx) => (
                                <td key={cIdx} className="p-2.5 text-zinc-300 font-mono whitespace-nowrap text-[11px]">
                                  {row[col.name] !== null && row[col.name] !== undefined ? String(row[col.name]) : <span className="text-zinc-600">NULL</span>}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Bottom Page Navigation Tabs (Page 1, Page 2, Page 3 like Power BI Desktop) */}
          <div className="bg-[#14161d] border-t border-[#242732] px-4 py-2 flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setActiveCanvasPage('page1')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                activeCanvasPage === 'page1'
                  ? 'bg-amber-500 text-black shadow-sm font-black'
                  : 'bg-[#1e212b] text-zinc-400 hover:text-white'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Page 1: Executive Overview</span>
            </button>

            <button
              onClick={() => setActiveCanvasPage('page2')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                activeCanvasPage === 'page2'
                  ? 'bg-amber-500 text-black shadow-sm font-black'
                  : 'bg-[#1e212b] text-zinc-400 hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Page 2: Matrix & Deep Breakdown</span>
            </button>

            <button
              onClick={() => setActiveCanvasPage('page3')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                activeCanvasPage === 'page3'
                  ? 'bg-amber-500 text-black shadow-sm font-black'
                  : 'bg-[#1e212b] text-zinc-400 hover:text-white'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Page 3: Live Records Grid</span>
            </button>
          </div>
        </div>

        {/* Right Sidebar: Power BI Visualizations Palette & Field Wells */}
        {showRightPane && dashboardData?.columns && (
          <div className="w-72 md:w-80 bg-[#161821] border-l border-[#262934] flex flex-col h-full z-10 shrink-0 shadow-2xl animate-fadeIn">
            
            {/* Sidebar Tab Header */}
            <div className="p-3 border-b border-[#262934] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Settings2 className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Build Visual</h3>
              </div>
              <button
                onClick={() => {
                  const auto = computeBestAxes(dashboardData.columns);
                  setCustomXAxis(auto.x);
                  setCustomYAxis(auto.y);
                  setAggFunction(auto.agg);
                  setAutoAxesReason(auto.reason);
                }}
                className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-bold rounded flex items-center gap-1 transition cursor-pointer"
                title="Auto-detect best axes"
              >
                <Sparkles className="w-3 h-3" />
                <span>Auto Axes</span>
              </button>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              
              {/* Visualizations Type Palette Icons */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Visual Type:</span>
                <div className="grid grid-cols-4 gap-1.5 bg-[#101216] border border-[#262934] rounded-xl p-2">
                  {[
                    { id: 'bar', icon: BarChart3, label: 'Bar' },
                    { id: 'line', icon: TrendingUp, label: 'Line' },
                    { id: 'area', icon: Activity, label: 'Area' },
                    { id: 'donut', icon: PieIcon, label: 'Donut' }
                  ].map(v => (
                    <button
                      key={v.id}
                      onClick={() => setActiveChartType(v.id)}
                      className={`p-2 rounded-lg flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                        activeChartType === v.id
                          ? 'bg-amber-500 text-black font-extrabold shadow-sm'
                          : 'text-zinc-400 hover:text-white hover:bg-[#1a1d26]'
                      }`}
                      title={v.label}
                    >
                      <v.icon className="w-4 h-4" />
                      <span className="text-[9px]">{v.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Field Well: X-Axis Dimension */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                  <Type className="w-3 h-3" /> X-Axis (Dimension):
                </span>
                <select
                  value={customXAxis}
                  onChange={(e) => setCustomXAxis(e.target.value)}
                  className="w-full bg-[#101216] border border-[#343844] rounded-lg px-2.5 py-2 text-white text-xs font-semibold focus:outline-none focus:border-amber-400"
                >
                  {dashboardData.columns.map(col => (
                    <option key={col.name} value={col.name}>
                      {col.name} ({col.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Field Well: Y-Axis Values / Metrics */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1">
                  <Hash className="w-3 h-3" /> Y-Axis (Values):
                </span>
                <div className="bg-[#101216] border border-[#292c37] rounded-xl p-2.5 space-y-1.5">
                  <button
                    onClick={() => setCustomYAxis(['Record Count'])}
                    className={`w-full text-left px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center justify-between ${
                      customYAxis.includes('Record Count') ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-[#1a1d26]'
                    }`}
                  >
                    <span>Record Count (Frequency)</span>
                    {customYAxis.includes('Record Count') && <Check className="w-3.5 h-3.5" />}
                  </button>

                  {dashboardData.columns.filter(c => c.type === 'numeric').map(c => {
                    const isSelected = customYAxis.includes(c.name);
                    return (
                      <button
                        key={c.name}
                        onClick={() => {
                          setCustomYAxis(prev => {
                            const clean = prev.filter(y => y !== 'Record Count');
                            if (clean.includes(c.name)) {
                              const next = clean.filter(y => y !== c.name);
                              return next.length > 0 ? next : ['Record Count'];
                            }
                            return [...clean, c.name];
                          });
                        }}
                        className={`w-full text-left px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center justify-between ${
                          isSelected ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-white hover:bg-[#1a1d26]'
                        }`}
                      >
                        <span className="truncate">&sum; {c.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Field Well: Aggregation Function */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                  Calculation Function:
                </span>
                <select
                  value={aggFunction}
                  onChange={(e) => setAggFunction(e.target.value)}
                  className="w-full bg-[#101216] border border-[#343844] rounded-lg px-2.5 py-2 text-white text-xs font-bold focus:outline-none focus:border-emerald-400"
                >
                  <option value="SUM">SUM (Total)</option>
                  <option value="AVG">AVERAGE (Mean)</option>
                  <option value="COUNT">COUNT (Frequency)</option>
                  <option value="MAX">MAX (Maximum)</option>
                  <option value="MIN">MIN (Minimum)</option>
                </select>
              </div>

              {/* Data Table Schema Fields Browser */}
              <div className="space-y-1.5 pt-2 border-t border-[#262934]">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  <Database className="w-3 h-3 text-amber-400" /> Data Table Fields:
                </span>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {dashboardData.columns.map(col => (
                    <div key={col.name} className="flex items-center justify-between p-1.5 rounded bg-[#101216] border border-[#222530] text-[11px]">
                      <span className="text-zinc-300 font-mono truncate">{col.name}</span>
                      <span className="text-[10px] text-zinc-500">{col.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DAX Copilot Drawer */}
        {isCopilotOpen && (
          <div className="w-80 md:w-96 bg-[#161821] border-l border-[#262934] flex flex-col h-full z-20 shadow-2xl animate-fadeIn shrink-0">
            <div className="p-4 border-b border-[#262934] flex items-center justify-between">
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
                <span className="font-bold text-amber-300">Target Schema:</span> Generating measures optimized for this active SQL query.
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Common DAX Formulas:</span>
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
                      className="text-left px-3 py-2 bg-[#1f222b] hover:bg-[#282c38] border border-[#292d38] rounded-lg text-zinc-300 hover:text-white transition"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

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

      {/* Power Query M-Code Modal */}
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
              Paste this in <strong className="text-white">Power BI Desktop &rarr; Transform Data &rarr; Advanced Editor</strong>:
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

      {/* Power BI REST API Settings Modal */}
      {showApiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#181a20] border border-[#2e323c] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-[#2e323c] pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Power BI REST API & Embed Integration</h3>
                  <p className="text-[11px] text-zinc-400">Connect your Power BI Service workspace, tenant & reports</p>
                </div>
              </div>
              <button onClick={() => setShowApiModal(false)} className="p-1.5 text-zinc-400 hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-zinc-300 mb-1">Power BI Report Embed URL</label>
                <input
                  type="text"
                  placeholder="https://app.powerbi.com/reportEmbed?reportId=...&groupId=..."
                  value={powerBiConfig.embedUrl || ''}
                  onChange={(e) => setPowerBiConfig({ ...powerBiConfig, embedUrl: e.target.value })}
                  className="w-full bg-[#101216] border border-[#343844] focus:border-amber-400 rounded-xl px-3 py-2 text-white placeholder-zinc-500 focus:outline-none font-mono text-[11px]"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Get this from Power BI Service &rarr; File &rarr; Embed report &rarr; Website or portal</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 mb-1">Azure Tenant ID</label>
                  <input
                    type="text"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={powerBiConfig.tenantId || ''}
                    onChange={(e) => setPowerBiConfig({ ...powerBiConfig, tenantId: e.target.value })}
                    className="w-full bg-[#101216] border border-[#343844] focus:border-amber-400 rounded-xl px-3 py-2 text-white placeholder-zinc-500 focus:outline-none font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 mb-1">Application / Client ID</label>
                  <input
                    type="text"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={powerBiConfig.clientId || ''}
                    onChange={(e) => setPowerBiConfig({ ...powerBiConfig, clientId: e.target.value })}
                    className="w-full bg-[#101216] border border-[#343844] focus:border-amber-400 rounded-xl px-3 py-2 text-white placeholder-zinc-500 focus:outline-none font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 mb-1">Workspace (Group) ID</label>
                  <input
                    type="text"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={powerBiConfig.workspaceId || ''}
                    onChange={(e) => setPowerBiConfig({ ...powerBiConfig, workspaceId: e.target.value })}
                    className="w-full bg-[#101216] border border-[#343844] focus:border-amber-400 rounded-xl px-3 py-2 text-white placeholder-zinc-500 focus:outline-none font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 mb-1">Report ID</label>
                  <input
                    type="text"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={powerBiConfig.reportId || ''}
                    onChange={(e) => setPowerBiConfig({ ...powerBiConfig, reportId: e.target.value })}
                    className="w-full bg-[#101216] border border-[#343844] focus:border-amber-400 rounded-xl px-3 py-2 text-white placeholder-zinc-500 focus:outline-none font-mono text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-300 mb-1">Client Secret (Azure App Registration)</label>
                <input
                  type="password"
                  placeholder="••••••••••••••••••••••••••••••••"
                  value={powerBiConfig.clientSecret || ''}
                  onChange={(e) => setPowerBiConfig({ ...powerBiConfig, clientSecret: e.target.value })}
                  className="w-full bg-[#101216] border border-[#343844] focus:border-amber-400 rounded-xl px-3 py-2 text-white placeholder-zinc-500 focus:outline-none font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#2e323c]">
              <div className="text-[11px] text-emerald-400 font-medium">
                {powerBiConfig.embedUrl ? '✓ Power BI URL Active' : '⚡ Direct PostgreSQL DirectQuery Active'}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('powerbi_api_config', JSON.stringify(powerBiConfig));
                    setSuccessMsg('Power BI REST API configuration saved!');
                    setShowApiModal(false);
                    setTimeout(() => setSuccessMsg(null), 3000);
                  }}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded-xl transition cursor-pointer"
                >
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
