import React, { useState, useEffect } from 'react';
import {
  Download, Copy, CheckCheck, RefreshCw, Database, Table, BarChart2,
  Sparkles, ExternalLink, Layers, Check, AlertCircle, ArrowUpRight,
  Code, Filter, ChevronRight, FileSpreadsheet, Eye, Plus, Trash2, X,
  FileText, Activity, ShieldCheck, Cpu, Play
} from 'lucide-react';
import {
  getPowerBISchema,
  getPowerBITableAnalytics,
  getPowerQueryMCode,
  getPowerBIReports,
  createPowerBIReport,
  deletePowerBIReport
} from '../services/api';

export default function PowerBIViewer({ onNavigate }) {
  // Schema & Database State
  const [schemaData, setSchemaData] = useState(null);
  const [selectedTable, setSelectedTable] = useState('');
  const [tableAnalytics, setTableAnalytics] = useState(null);
  const [loadingSchema, setLoadingSchema] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Power BI Custom Published Reports
  const [customReports, setCustomReports] = useState([]);
  const [activeCustomReport, setActiveCustomReport] = useState(null);
  const [viewMode, setViewMode] = useState('live_database'); // 'live_database' | 'embedded_report'

  // Clipboard & Automation states
  const [copiedMCode, setCopiedMCode] = useState(false);
  const [copiedFeedUrl, setCopiedFeedUrl] = useState(false);
  const [copiedField, setCopiedField] = useState('');
  const [mCodeText, setMCodeText] = useState('');
  const [showMCodeModal, setShowMCodeModal] = useState(false);
  const [showPbidsModal, setShowPbidsModal] = useState(false);
  const [isAddingReport, setIsAddingReport] = useState(false);

  // DAX Copilot State
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [daxPrompt, setDaxPrompt] = useState('');
  const [daxResult, setDaxResult] = useState(null);
  const [isGeneratingDax, setIsGeneratingDax] = useState(false);

  // New Custom Report Form
  const [formReport, setFormReport] = useState({
    name: '',
    description: '',
    embedUrl: '',
    category: 'Executive'
  });

  // Fetch Live Database Schema on mount
  const fetchLiveSchema = async () => {
    setLoadingSchema(true);
    setError(null);
    try {
      const [schemaRes, reportsRes] = await Promise.all([
        getPowerBISchema(),
        getPowerBIReports()
      ]);

      if (schemaRes.success) {
        setSchemaData(schemaRes);
        if (schemaRes.tables && schemaRes.tables.length > 0) {
          const firstTbl = schemaRes.tables[0].tableName;
          setSelectedTable(firstTbl);
          loadTableData(firstTbl);
        }
      }

      if (reportsRes.success && Array.isArray(reportsRes.reports)) {
        setCustomReports(reportsRes.reports);
      }
    } catch (err) {
      console.error('[PowerBI] Schema load failed:', err);
      setError(err.response?.data?.error || err.message || 'Failed to connect to live database schema.');
    } finally {
      setLoadingSchema(false);
    }
  };

  useEffect(() => {
    fetchLiveSchema();
  }, []);

  // Fetch Live Table Records & BI Metrics
  const loadTableData = async (tableName) => {
    if (!tableName) return;
    setLoadingAnalytics(true);
    try {
      const res = await getPowerBITableAnalytics(tableName, 50);
      if (res.success && res.analytics) {
        setTableAnalytics(res.analytics);
        setMCodeText(res.analytics.powerQueryCode || '');
      }
    } catch (err) {
      console.error('[PowerBI] Table analytics load failed:', err);
      setError(`Failed to load data for table "${tableName}".`);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleSelectTable = (tblName) => {
    setSelectedTable(tblName);
    loadTableData(tblName);
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

  const handleCopyText = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(''), 2500);
  };

  // 1-Click Copy Power Query M-Code
  const handleCopyMCode = () => {
    if (mCodeText) {
      navigator.clipboard.writeText(mCodeText);
      setCopiedMCode(true);
      setTimeout(() => setCopiedMCode(false), 2500);
    }
  };

  // 1-Click Copy Live REST Data Feed URL
  const handleCopyFeedUrl = () => {
    const feedUrl = `${window.location.origin}/api/powerbi/feed?table=${encodeURIComponent(selectedTable || '')}`;
    navigator.clipboard.writeText(feedUrl);
    setCopiedFeedUrl(true);
    setSuccessMsg('Live Web Connector Feed URL copied! In Power BI: Get Data -> Web -> paste this URL.');
    setTimeout(() => {
      setCopiedFeedUrl(false);
      setSuccessMsg(null);
    }, 5000);
  };

  // 1-Click Export Table Rows to CSV
  const handleExportCsv = () => {
    if (!tableAnalytics?.rows || tableAnalytics.rows.length === 0) return;
    const cols = tableAnalytics.columns.map(c => c.name);
    const csvRows = [];
    csvRows.push(cols.join(','));

    for (const row of tableAnalytics.rows) {
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
    link.download = `${selectedTable || 'database_data'}_export.csv`;
    link.click();
  };

  // Generate DAX Measure with AI Copilot
  const handleGenerateDax = (e) => {
    e.preventDefault();
    if (!daxPrompt.trim() || !selectedTable) return;

    setIsGeneratingDax(true);
    setDaxResult(null);

    setTimeout(() => {
      const promptLower = daxPrompt.toLowerCase();
      const colNames = tableAnalytics?.columns?.map(c => c.name) || [];
      const firstNumCol = tableAnalytics?.columns?.find(c => ['integer', 'bigint', 'numeric', 'double precision', 'real'].includes(c.type?.toLowerCase()))?.name || colNames[0] || 'Amount';

      let dax = {};
      if (promptLower.includes('growth') || promptLower.includes('yoy')) {
        dax = {
          name: `YoY_${firstNumCol}_Growth`,
          formula: `${firstNumCol} YoY % = \nVAR CurrentVal = SUM('${selectedTable}'[${firstNumCol}])\nVAR PriorVal = CALCULATE(SUM('${selectedTable}'[${firstNumCol}]), SAMEPERIODLASTYEAR('Calendar'[Date]))\nRETURN\n    DIVIDE(CurrentVal - PriorVal, PriorVal, 0)`,
          explanation: `Calculates Year-Over-Year percentage growth for column [${firstNumCol}] on table '${selectedTable}'.`
        };
      } else if (promptLower.includes('margin') || promptLower.includes('profit') || promptLower.includes('average')) {
        dax = {
          name: `Avg_${firstNumCol}`,
          formula: `Average ${firstNumCol} = \nAVERAGE('${selectedTable}'[${firstNumCol}])`,
          explanation: `Calculates dynamic weighted average for [${firstNumCol}] in '${selectedTable}'.`
        };
      } else if (promptLower.includes('rank') || promptLower.includes('top')) {
        dax = {
          name: `Rank_By_${firstNumCol}`,
          formula: `Rank by ${firstNumCol} = \nRANKX(\n    ALL('${selectedTable}'),\n    CALCULATE(SUM('${selectedTable}'[${firstNumCol}])),\n    ,\n    DESC,\n    Dense\n)`,
          explanation: `Ranks rows in '${selectedTable}' in descending order by [${firstNumCol}].`
        };
      } else {
        dax = {
          name: `Total_${firstNumCol}`,
          formula: `Total ${firstNumCol} = \nCALCULATE(\n    SUM('${selectedTable}'[${firstNumCol}]),\n    ALLSELECTED('${selectedTable}')\n)`,
          explanation: `DAX measure calculating aggregated sum for column [${firstNumCol}].`
        };
      }

      setDaxResult(dax);
      setIsGeneratingDax(false);
    }, 500);
  };

  // Add Custom Embedded Report
  const handleAddCustomReport = async (e) => {
    e.preventDefault();
    if (!formReport.name.trim() || !formReport.embedUrl.trim()) return;

    try {
      const res = await createPowerBIReport(formReport);
      if (res.success && res.report) {
        setCustomReports(prev => [res.report, ...prev]);
        setActiveCustomReport(res.report);
        setViewMode('embedded_report');
        setIsAddingReport(false);
        setFormReport({ name: '', description: '', embedUrl: '', category: 'Executive' });
        setSuccessMsg(`Power BI Report "${res.report.name}" connected!`);
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save Power BI report');
    }
  };

  // Delete Custom Report
  const handleDeleteCustomReport = async (id, e) => {
    e?.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this report?')) return;
    try {
      const res = await deletePowerBIReport(id);
      if (res.success) {
        setCustomReports(prev => prev.filter(r => String(r.id || r._id) !== String(id)));
        if (String(activeCustomReport?.id || activeCustomReport?._id) === String(id)) {
          setViewMode('live_database');
          setActiveCustomReport(null);
        }
      }
    } catch (err) {
      setError('Failed to delete report');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#111318] text-slate-100 font-sans antialiased overflow-hidden select-none">
      
      {/* Top Main Navigation & Automation Toolbar */}
      <div className="bg-[#181a20] border-b border-[#2a2d36] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-md">
        
        {/* Left: DB Connection Indicator */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-sm">
            <BarChart2 className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-extrabold text-white tracking-tight">Power BI Live Integration Hub</h2>
              <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-[10px] font-black rounded-md uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Live DB Connected
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-medium truncate">
              Database: <span className="text-amber-300 font-mono font-bold">{schemaData?.dbConfig?.database || 'datamind_app2'}</span> ({schemaData?.totalTables || 0} tables, {schemaData?.totalRows?.toLocaleString() || 0} total rows)
            </p>
          </div>
        </div>

        {/* Right: 1-Click Automation Actions */}
        <div className="flex items-center space-x-2 shrink-0">
          
          {/* ⚡ 1-Click Open in Power BI Desktop (.pbids) */}
          <button
            onClick={handleDownloadPbids}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs rounded-xl flex items-center space-x-1.5 shadow-md active:scale-[0.98] transition cursor-pointer"
            title="1-Click download Power BI Data Source Connection (.pbids) for Power BI Desktop"
          >
            <Download className="w-4 h-4" />
            <span>⚡ 1-Click Open in Power BI</span>
          </button>

          {/* Power Query M-Code */}
          <button
            onClick={() => setShowMCodeModal(true)}
            className="px-3 py-2 bg-[#22242c] hover:bg-[#2b2e38] text-zinc-200 border border-[#343844] font-bold text-xs rounded-xl flex items-center space-x-1.5 transition cursor-pointer shadow-sm"
            title="View ready-to-paste Power Query M Script"
          >
            <Code className="w-3.5 h-3.5 text-amber-400" />
            <span>Power Query M</span>
          </button>

          {/* Copy Live Feed URL */}
          <button
            onClick={handleCopyFeedUrl}
            className="px-3 py-2 bg-[#22242c] hover:bg-[#2b2e38] text-zinc-200 border border-[#343844] font-bold text-xs rounded-xl flex items-center space-x-1.5 transition cursor-pointer shadow-sm"
            title="Copy Live REST Data Feed URL for Power BI Web Connector"
          >
            {copiedFeedUrl ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedFeedUrl ? 'Copied' : 'Live Data Feed'}</span>
          </button>

          {/* DAX Copilot Toggle */}
          <button
            onClick={() => setIsCopilotOpen(!isCopilotOpen)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-sm ${
              isCopilotOpen
                ? 'bg-amber-400 text-black font-extrabold'
                : 'bg-[#22242c] hover:bg-[#2b2e38] text-amber-300 border border-amber-500/30'
            }`}
            title="Open Power BI DAX AI Copilot"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>DAX Copilot</span>
          </button>

          {/* Connect Published Report */}
          <button
            onClick={() => setIsAddingReport(true)}
            className="px-3 py-2 bg-[#5850ec] hover:bg-[#4f46e5] text-white text-xs font-bold rounded-xl transition flex items-center space-x-1 cursor-pointer shadow-sm"
            title="Embed an existing published Power BI Report"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Embed Report</span>
          </button>

          {/* Refresh Schema */}
          <button
            onClick={fetchLiveSchema}
            className="p-2 bg-[#22242c] hover:bg-[#2b2e38] text-zinc-300 hover:text-white border border-[#343844] rounded-xl transition cursor-pointer"
            title="Refresh database schema"
          >
            <RefreshCw className={`w-4 h-4 ${loadingSchema ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* View Mode & Tables Horizontal Carousel */}
      <div className="bg-[#15171d] border-b border-[#252832] px-5 py-2 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar shrink-0">
        
        {/* Left: Active Mode Selector */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => setViewMode('live_database')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer ${
              viewMode === 'live_database'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
                : 'bg-[#1e2028] text-zinc-400 hover:text-white border border-[#2c303c]'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-amber-400" />
            <span>Live Database BI View</span>
          </button>

          {customReports.map((report) => (
            <div
              key={report.id || report._id}
              onClick={() => {
                setActiveCustomReport(report);
                setViewMode('embedded_report');
              }}
              className={`group flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition shrink-0 ${
                viewMode === 'embedded_report' && String(activeCustomReport?.id || activeCustomReport?._id) === String(report.id || report._id)
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 shadow-sm'
                  : 'bg-[#1e2028] text-zinc-400 hover:text-white border border-[#2c303c]'
              }`}
            >
              <Eye className="w-3 h-3 text-indigo-400" />
              <span className="truncate max-w-[150px]">{report.name}</span>
              <button
                onClick={(e) => handleDeleteCustomReport(report.id || report._id, e)}
                className="opacity-0 group-hover:opacity-100 hover:text-rose-400 transition ml-1"
                title="Remove report"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Right: Table Switcher */}
        {viewMode === 'live_database' && schemaData?.tables && (
          <div className="flex items-center space-x-2 shrink-0 overflow-x-auto">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
              <Table className="w-3 h-3 text-zinc-400" /> Tables:
            </span>
            {schemaData.tables.map((t) => (
              <button
                key={t.tableName}
                onClick={() => handleSelectTable(t.tableName)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition cursor-pointer shrink-0 ${
                  selectedTable === t.tableName
                    ? 'bg-amber-500 text-black font-extrabold shadow-sm'
                    : 'bg-[#1c1f26] text-zinc-300 hover:text-white hover:bg-[#252a34] border border-[#2c303c]'
                }`}
              >
                {t.tableName} ({t.rowCount})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Notifications / Alerts */}
      {successMsg && (
        <div className="m-4 p-3.5 bg-emerald-950/70 border border-emerald-700/80 rounded-xl text-emerald-200 text-xs flex items-center justify-between shadow-lg animate-fadeIn">
          <div className="flex items-center space-x-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="m-4 p-3.5 bg-rose-950/70 border border-rose-700/80 rounded-xl text-rose-200 text-xs flex items-center justify-between shadow-lg animate-fadeIn">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden bg-[#0d0e12]">
        
        {/* MODE 1: LIVE DATABASE BI WORKSPACE */}
        {viewMode === 'live_database' && (
          <div className="flex-1 flex flex-col h-full overflow-y-auto p-5 md:p-6 space-y-6">
            
            {/* KPI Summary Cards from Real Database */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              
              {/* Card 1: Active Table */}
              <div className="bg-[#181a20] border border-[#2a2d36] rounded-2xl p-4 shadow-md space-y-1">
                <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
                  <span>Selected Table</span>
                  <Table className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-lg font-black text-white truncate font-mono" title={selectedTable}>
                  {selectedTable || 'No table selected'}
                </div>
                <p className="text-[11px] text-zinc-500">Live PostgreSQL Table</p>
              </div>

              {/* Card 2: Row Count */}
              <div className="bg-[#181a20] border border-[#2a2d36] rounded-2xl p-4 shadow-md space-y-1">
                <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
                  <span>Total Records</span>
                  <Activity className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-xl font-black text-emerald-400 font-mono">
                  {tableAnalytics ? tableAnalytics.totalRows.toLocaleString() : '0'}
                </div>
                <p className="text-[11px] text-zinc-500">Direct query row count</p>
              </div>

              {/* Card 3: Columns Count */}
              <div className="bg-[#181a20] border border-[#2a2d36] rounded-2xl p-4 shadow-md space-y-1">
                <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
                  <span>Column Attributes</span>
                  <Layers className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-xl font-black text-indigo-300 font-mono">
                  {tableAnalytics ? tableAnalytics.columns.length : 0}
                </div>
                <p className="text-[11px] text-zinc-500">Schema fields available</p>
              </div>

              {/* Card 4: 1-Click Power BI Desktop */}
              <div
                onClick={handleDownloadPbids}
                className="bg-gradient-to-br from-amber-500/10 to-amber-600/20 border border-amber-500/40 hover:border-amber-400 rounded-2xl p-4 shadow-md space-y-1 cursor-pointer transition active:scale-[0.98]"
              >
                <div className="flex items-center justify-between text-amber-300 text-xs font-bold">
                  <span>Power BI Desktop</span>
                  <Download className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-sm font-black text-amber-200">
                  ⚡ Open in Power BI
                </div>
                <p className="text-[11px] text-amber-300/70">Click to launch DirectQuery</p>
              </div>
            </div>

            {/* Live Visual Analytics & Categorical Distributions from Database */}
            {tableAnalytics?.categoryDistribution && tableAnalytics.categoryDistribution.length > 0 && (
              <div className="bg-[#181a20] border border-[#2a2d36] rounded-2xl p-5 shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-extrabold text-white">Live Data Distribution</h3>
                    <p className="text-xs text-zinc-400">Aggregated directly from database rows</p>
                  </div>
                  <span className="px-2 py-0.5 bg-zinc-800 text-zinc-300 text-[10px] font-mono rounded">
                    Top {tableAnalytics.categoryDistribution.length} Categories
                  </span>
                </div>

                {/* Dynamic Bar Charts */}
                <div className="space-y-2.5 pt-2">
                  {(() => {
                    const maxCount = Math.max(...tableAnalytics.categoryDistribution.map(d => Number(d.count) || 1));
                    return tableAnalytics.categoryDistribution.map((item, idx) => {
                      const countNum = Number(item.count) || 0;
                      const pct = Math.round((countNum / maxCount) * 100);
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-medium">
                            <span className="text-zinc-200 truncate max-w-xs">{String(item.label || 'None')}</span>
                            <span className="text-amber-400 font-mono font-bold">{countNum.toLocaleString()} rows</span>
                          </div>
                          <div className="w-full h-2.5 bg-[#121318] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Real Data Table Grid */}
            <div className="bg-[#181a20] border border-[#2a2d36] rounded-2xl p-5 shadow-md space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-amber-400" />
                    <span>Live Database Records</span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Showing first {tableAnalytics?.rows?.length || 0} rows from table <code className="text-amber-300 font-mono">{selectedTable}</code>
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleExportCsv}
                    className="px-3 py-1.5 bg-[#22242c] hover:bg-[#2b2e38] text-zinc-200 border border-[#343844] rounded-lg text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Export CSV</span>
                  </button>

                  <button
                    onClick={() => loadTableData(selectedTable)}
                    className="p-1.5 bg-[#22242c] hover:bg-[#2b2e38] text-zinc-300 hover:text-white border border-[#343844] rounded-lg transition"
                    title="Reload table rows"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingAnalytics ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto border border-[#2e323c] rounded-xl max-h-96">
                {loadingAnalytics ? (
                  <div className="py-16 text-center text-zinc-400 text-xs font-semibold">
                    Loading live database records...
                  </div>
                ) : !tableAnalytics || tableAnalytics.rows.length === 0 ? (
                  <div className="py-16 text-center text-zinc-500 text-xs font-medium">
                    No rows found in this table.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse font-sans">
                    <thead className="bg-[#14161c] text-zinc-300 font-bold border-b border-[#2e323c] sticky top-0 z-10">
                      <tr>
                        {tableAnalytics.columns.map((col, idx) => (
                          <th key={idx} className="p-3 whitespace-nowrap font-mono text-zinc-300">
                            {col.name}
                            <span className="ml-1 text-[10px] text-zinc-500 font-normal">({col.type})</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#22252e] bg-[#181a20]">
                      {tableAnalytics.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-[#20232b] transition">
                          {tableAnalytics.columns.map((col, cIdx) => (
                            <td key={cIdx} className="p-3 text-zinc-300 font-mono whitespace-nowrap text-[11px]">
                              {row[col.name] !== null && row[col.name] !== undefined ? String(row[col.name]) : <span className="text-zinc-600">NULL</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODE 2: EMBEDDED PUBLISHED REPORT */}
        {viewMode === 'embedded_report' && activeCustomReport && (
          <div className="flex-1 h-full w-full relative">
            <iframe
              title={activeCustomReport.name}
              src={activeCustomReport.embedUrl}
              className="w-full h-full border-0"
              allowFullScreen={true}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
            />
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
                <span className="font-bold text-amber-300">Live Model Target:</span> Generating DAX measures tailored for table <code className="text-white font-mono font-bold">'{selectedTable}'</code>.
              </div>

              {/* Sample Prompts */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Common Calculations:</span>
                <div className="flex flex-col gap-1.5">
                  {[
                    'Calculate YoY Growth %',
                    'Dynamic average calculation',
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
                        setSuccessMsg('DAX Formula copied to clipboard!');
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
                <h3 className="text-base font-extrabold text-white">Power Query M Script</h3>
              </div>
              <button onClick={() => setShowMCodeModal(false)} className="p-1.5 text-zinc-400 hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-zinc-300">
              Paste this in <strong className="text-white">Power BI Desktop &rarr; Transform Data &rarr; Advanced Editor</strong>:
            </p>

            <pre className="p-4 bg-[#0d0e12] border border-[#2a2d36] rounded-xl text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-60">
              {mCodeText}
            </pre>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={handleCopyMCode}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded-xl flex items-center space-x-1.5 transition cursor-pointer"
              >
                {copiedMCode ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedMCode ? 'Copied M-Code!' : 'Copy Script'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connect Custom Published Report Modal */}
      {isAddingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#181a20] border border-[#2e323c] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-[#2e323c] pb-3">
              <h3 className="text-base font-extrabold text-white">Embed Power BI Published Report</h3>
              <button onClick={() => setIsAddingReport(false)} className="p-1.5 text-zinc-400 hover:text-white rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomReport} className="space-y-4">
              <div>
                <label className="block text-zinc-200 font-bold mb-1">Report Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sales Executive Dashboard"
                  value={formReport.name}
                  onChange={(e) => setFormReport({ ...formReport, name: e.target.value })}
                  className="w-full bg-[#101216] border border-[#343844] focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-200 font-bold mb-1">Power BI Embed URL or iframe code *</label>
                <input
                  type="text"
                  required
                  placeholder="https://app.powerbi.com/view?r=... or https://app.powerbi.com/reportEmbed?..."
                  value={formReport.embedUrl}
                  onChange={(e) => setFormReport({ ...formReport, embedUrl: e.target.value })}
                  className="w-full bg-[#101216] border border-[#343844] focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-500 focus:outline-none font-mono text-[11px]"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingReport(false)}
                  className="px-4 py-2 border border-[#343844] hover:bg-zinc-800 text-zinc-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded-xl transition cursor-pointer"
                >
                  Save Report
                </button>
              </div>
            </form>
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
