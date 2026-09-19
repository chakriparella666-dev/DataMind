import React, { useState, useEffect, useRef } from 'react';
import {
  Maximize2, Minimize2, RefreshCw, Plus, ExternalLink, Sparkles,
  Layers, Info, Trash2, Edit3, Check, AlertCircle, BarChart2,
  ChevronRight, Lock, Eye, Copy, CheckCheck, HelpCircle, X
} from 'lucide-react';
import { getPowerBIReports, createPowerBIReport, deletePowerBIReport } from '../services/api';

export default function PowerBIViewer({ onNavigate }) {
  const [reports, setReports] = useState([]);
  const [activeReport, setActiveReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAddingReport, setIsAddingReport] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [iframeKey, setIframeKey] = useState(Date.now());
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // DAX Copilot state
  const [daxPrompt, setDaxPrompt] = useState('');
  const [daxResult, setDaxResult] = useState(null);
  const [isGeneratingDax, setIsGeneratingDax] = useState(false);

  // Add Report Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Sales & Revenue',
    embedType: 'embed_url',
    embedUrl: '',
    datasetName: '',
    tags: '',
    visibility: 'Private'
  });
  const [formSubmitting, setFormSubmitting] = useState(false);

  const containerRef = useRef(null);

  // Load all reports
  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPowerBIReports();
      if (res.success && Array.isArray(res.reports)) {
        setReports(res.reports);
        if (res.reports.length > 0) {
          // Keep active report if still exists, or default to first
          setActiveReport(prev => {
            if (prev) {
              const match = res.reports.find(r => String(r.id || r._id) === String(prev.id || prev._id));
              if (match) return match;
            }
            return res.reports[0];
          });
        }
      }
    } catch (err) {
      console.error('[PowerBI] Failed to load reports:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load Power BI reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // When active report changes, trigger reload animation
  useEffect(() => {
    if (activeReport) {
      setIframeLoaded(false);
      setIframeKey(Date.now());
    }
  }, [activeReport?.id, activeReport?._id]);

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Copy link
  const handleCopyLink = () => {
    if (activeReport?.embedUrl) {
      navigator.clipboard.writeText(activeReport.embedUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  // Delete report
  const handleDeleteReport = async (reportId, e) => {
    e?.stopPropagation();
    if (!window.confirm('Are you sure you want to remove this Power BI report?')) return;
    try {
      const res = await deletePowerBIReport(reportId);
      if (res.success) {
        setSuccessMsg('Power BI report removed successfully.');
        setReports(prev => prev.filter(r => String(r.id || r._id) !== String(reportId)));
        if (String(activeReport?.id || activeReport?._id) === String(reportId)) {
          const remaining = reports.filter(r => String(r.id || r._id) !== String(reportId));
          setActiveReport(remaining[0] || null);
        }
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to delete report');
    }
  };

  // Submit new report
  const handleCreateReport = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.embedUrl.trim()) {
      setError('Please provide a report title and Power BI Embed URL.');
      return;
    }
    setFormSubmitting(true);
    setError(null);
    try {
      const res = await createPowerBIReport(formData);
      if (res.success && res.report) {
        setSuccessMsg(`Power BI Report "${res.report.name}" connected successfully!`);
        setReports(prev => [res.report, ...prev]);
        setActiveReport(res.report);
        setIsAddingReport(false);
        setFormData({
          name: '',
          description: '',
          category: 'Sales & Revenue',
          embedType: 'embed_url',
          embedUrl: '',
          datasetName: '',
          tags: '',
          visibility: 'Private'
        });
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save Power BI report');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Generate DAX with AI Copilot
  const handleGenerateDax = async (e) => {
    e.preventDefault();
    if (!daxPrompt.trim()) return;

    setIsGeneratingDax(true);
    setDaxResult(null);

    // Simulate intelligent DAX generation contextually based on report
    setTimeout(() => {
      const promptLower = daxPrompt.toLowerCase();
      let generated = {};

      if (promptLower.includes('yoy') || promptLower.includes('year over year') || promptLower.includes('growth')) {
        generated = {
          name: 'YoY Sales Growth %',
          formula: `YoY Sales Growth % = \nVAR CurrentSales = [Total Sales]\nVAR PriorYearSales = CALCULATE([Total Sales], SAMEPERIODLASTYEAR('Calendar'[Date]))\nRETURN\n    DIVIDE(CurrentSales - PriorYearSales, PriorYearSales, 0)`,
          explanation: 'Computes year-over-year revenue percentage growth comparing current calendar filter context against the same period in the previous year.'
        };
      } else if (promptLower.includes('margin') || promptLower.includes('profit')) {
        generated = {
          name: 'Gross Margin %',
          formula: `Gross Margin % = \nDIVIDE(\n    [Total Revenue] - [Total Cost],\n    [Total Revenue],\n    0\n)`,
          explanation: 'Safe division measure calculating the gross profit margin percentage across selected categories or dates.'
        };
      } else if (promptLower.includes('moving average') || promptLower.includes('rolling')) {
        generated = {
          name: '30-Day Rolling Revenue',
          formula: `Rolling 30D Revenue = \nCALCULATE(\n    [Total Revenue],\n    DATESINPERIOD('Calendar'[Date], MAX('Calendar'[Date]), -30, DAY)\n)`,
          explanation: 'Calculates the rolling 30-day cumulative revenue up to the current selected date.'
        };
      } else if (promptLower.includes('rank') || promptLower.includes('top')) {
        generated = {
          name: 'Product Revenue Rank',
          formula: `Product Sales Rank = \nRANKX(\n    ALL('Products'[ProductName]),\n    [Total Sales],\n    ,\n    DESC,\n    Dense\n)`,
          explanation: 'Ranks products by total sales in descending order across the entire product catalog ignoring current row filters.'
        };
      } else {
        generated = {
          name: 'Dynamic Measure Calculation',
          formula: `-- DAX Measure for: ${daxPrompt}\nCalculated Metric = \nCALCULATE(\n    SUM('Sales'[Amount]),\n    USERELATIONSHIP('Sales'[OrderDate], 'Calendar'[Date]),\n    FILTER(ALLSELECTED('Sales'), 'Sales'[Status] = "Completed")\n)`,
          explanation: `Calculates filtered metric matching "${daxPrompt}" using explicit context transition.`
        };
      }

      setDaxResult(generated);
      setIsGeneratingDax(false);
    }, 600);
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-[#141417] text-slate-100 font-sans antialiased overflow-hidden ${
        isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen p-0' : 'h-full flex-1'
      }`}
    >
      {/* Top Header & Interactive Report Selector Bar */}
      <div className="bg-[#1b1b20] border-b border-[#2e2e36] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-md">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-sm">
            <BarChart2 className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base md:text-lg font-bold text-white tracking-tight truncate max-w-xs md:max-w-md">
                {activeReport ? activeReport.name : 'Power BI Dashboards'}
              </h2>
              {activeReport?.isSample && (
                <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-bold rounded-full uppercase tracking-wider">
                  Live Showcase
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 truncate max-w-sm">
              {activeReport?.description || 'Full interactive Power BI report embedded in DataMind'}
            </p>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* DAX Copilot Button */}
          <button
            onClick={() => setIsCopilotOpen(!isCopilotOpen)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-sm ${
              isCopilotOpen
                ? 'bg-amber-500 text-black font-extrabold'
                : 'bg-[#222228] hover:bg-[#2c2c34] text-amber-300 border border-amber-500/30'
            }`}
            title="Open Power BI DAX AI Assistant"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>DAX Copilot</span>
          </button>

          {/* How to Embed Guide */}
          <button
            onClick={() => setShowHelpModal(true)}
            className="p-2 rounded-xl bg-[#222228] hover:bg-[#2c2c34] text-zinc-300 hover:text-white border border-[#33333b] transition cursor-pointer"
            title="How to connect your own Power BI report"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Refresh Report */}
          <button
            onClick={() => {
              setIframeLoaded(false);
              setIframeKey(Date.now());
            }}
            className="p-2 rounded-xl bg-[#222228] hover:bg-[#2c2c34] text-zinc-300 hover:text-white border border-[#33333b] transition cursor-pointer"
            title="Reload report"
          >
            <RefreshCw className={`w-4 h-4 ${!iframeLoaded ? 'animate-spin' : ''}`} />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-[#222228] hover:bg-[#2c2c34] text-zinc-300 hover:text-white border border-[#33333b] transition cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Full Screen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Add New Report Button */}
          <button
            onClick={() => setIsAddingReport(true)}
            className="px-3.5 py-1.5 bg-[#5850ec] hover:bg-[#4f46e5] text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect Report</span>
          </button>
        </div>
      </div>

      {/* Reports Horizontal Carousel Tabs */}
      <div className="bg-[#17171c] border-b border-[#26262e] px-5 py-2 flex items-center space-x-2 overflow-x-auto no-scrollbar shrink-0">
        <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
          <Layers className="w-3 h-3" /> Reports:
        </span>
        {reports.map((report) => {
          const isSelected = String(activeReport?.id || activeReport?._id) === String(report.id || report._id);
          return (
            <div
              key={report.id || report._id}
              onClick={() => setActiveReport(report)}
              className={`group flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition shrink-0 select-none ${
                isSelected
                  ? 'bg-amber-500/15 border border-amber-500/50 text-amber-200 shadow-sm'
                  : 'bg-[#202026] hover:bg-[#282830] text-zinc-400 hover:text-zinc-200 border border-[#2a2a34]'
              }`}
            >
              <span className="truncate max-w-[170px]">{report.name}</span>
              {!report.isSample && (
                <button
                  onClick={(e) => handleDeleteReport(report.id || report._id, e)}
                  className="opacity-0 group-hover:opacity-100 hover:text-rose-400 transition ml-1"
                  title="Remove report"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Alerts */}
      {error && (
        <div className="m-4 p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="m-4 p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Workspace Area: Embedded Iframe & Side Panels */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden bg-[#0d0e12]">
        {/* Iframe Loading Skeleton Overlay */}
        {!iframeLoaded && activeReport && (
          <div className="absolute inset-0 bg-[#0d0e12] flex flex-col items-center justify-center z-10 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center animate-pulse">
              <BarChart2 className="w-6 h-6 text-amber-400" />
            </div>
            <div className="text-center space-y-1">
              <h4 className="text-sm font-bold text-white">Loading Power BI Dashboard...</h4>
              <p className="text-xs text-zinc-400">Rendering interactive visual canvas & DirectQuery measures</p>
            </div>
          </div>
        )}

        {/* Embedded Power BI Interactive Canvas */}
        {activeReport ? (
          <div className="flex-1 h-full w-full relative">
            <iframe
              key={`${activeReport.id || activeReport._id}-${iframeKey}`}
              title={activeReport.name}
              src={activeReport.embedUrl}
              className="w-full h-full border-0"
              allowFullScreen={true}
              onLoad={() => setIframeLoaded(true)}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#1c1c22] border border-[#2e2e38] flex items-center justify-center">
              <BarChart2 className="w-8 h-8 text-zinc-500" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h3 className="text-base font-bold text-white">No Power BI Report Connected</h3>
              <p className="text-xs text-zinc-400">
                Connect your Power BI Desktop or Service report to view high-density interactive visuals here.
              </p>
            </div>
            <button
              onClick={() => setIsAddingReport(true)}
              className="px-4 py-2 bg-[#5850ec] hover:bg-[#4f46e5] text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm"
            >
              Connect Report Now
            </button>
          </div>
        )}

        {/* DAX AI Copilot Sidebar Drawer */}
        {isCopilotOpen && (
          <div className="w-80 md:w-96 bg-[#18181e] border-l border-[#2e2e36] flex flex-col h-full z-20 shadow-2xl animate-fadeIn">
            {/* Copilot Header */}
            <div className="p-4 border-b border-[#2e2e36] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Power BI DAX Copilot</h3>
              </div>
              <button
                onClick={() => setIsCopilotOpen(false)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Copilot Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200/90 leading-relaxed">
                <span className="font-bold text-amber-300">AI DAX Assistant:</span> Ask any metric calculation, time-intelligence formula, or ranking query to generate ready-to-paste DAX for your Power BI model.
              </div>

              {/* Quick Prompt Suggestions */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Example Calculations:</span>
                <div className="flex flex-col gap-1.5">
                  {[
                    'Calculate YoY Sales Growth %',
                    '30-day rolling average revenue',
                    'Gross profit margin with divide',
                    'Top 10 products ranked by gross revenue'
                  ].map((sug, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setDaxPrompt(sug);
                      }}
                      className="text-left px-3 py-2 bg-[#22222a] hover:bg-[#2b2b36] border border-[#30303c] rounded-lg text-zinc-300 hover:text-white transition"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Form */}
              <form onSubmit={handleGenerateDax} className="space-y-2 pt-2">
                <label className="block font-bold text-zinc-300">Describe what metric to calculate:</label>
                <textarea
                  rows={3}
                  value={daxPrompt}
                  onChange={(e) => setDaxPrompt(e.target.value)}
                  placeholder="e.g., Year over year margin % change compared to previous fiscal quarter..."
                  className="w-full bg-[#121216] border border-[#353542] focus:border-amber-400 rounded-xl p-3 text-white text-xs placeholder-zinc-500 resize-none focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isGeneratingDax || !daxPrompt.trim()}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition cursor-pointer flex items-center justify-center space-x-1.5 shadow-sm disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isGeneratingDax ? 'Generating DAX...' : 'Generate DAX Measure'}</span>
                </button>
              </form>

              {/* DAX Result Card */}
              {daxResult && (
                <div className="mt-4 p-3.5 bg-[#121216] border border-amber-500/40 rounded-xl space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300 text-xs">{daxResult.name}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(daxResult.formula);
                        setCopiedUrl(true);
                        setTimeout(() => setCopiedUrl(false), 2000);
                      }}
                      className="px-2 py-1 bg-[#22222a] hover:bg-[#2b2b36] border border-zinc-700 text-zinc-300 text-[10px] font-bold rounded flex items-center space-x-1"
                    >
                      {copiedUrl ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  <pre className="p-2.5 bg-[#0a0a0d] border border-[#2a2a34] rounded-lg text-emerald-400 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap">
                    {daxResult.formula}
                  </pre>

                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    {daxResult.explanation}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Connect Power BI Report Modal */}
      {isAddingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#1e1e24] border border-[#33333e] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-[#2e2e38] flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <BarChart2 className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Connect Power BI Report</h3>
              </div>
              <button
                onClick={() => setIsAddingReport(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReport} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-zinc-200 font-bold mb-1">Report Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Regional Sales & Operations Dashboard"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[#141418] border border-[#383846] focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-zinc-200 font-bold">Power BI Embed URL or iframe code *</label>
                  <button
                    type="button"
                    onClick={() => setShowHelpModal(true)}
                    className="text-[11px] text-amber-400 hover:underline flex items-center gap-0.5"
                  >
                    <HelpCircle className="w-3 h-3" /> Where do I get this?
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="https://app.powerbi.com/view?r=... or https://app.powerbi.com/reportEmbed?..."
                  value={formData.embedUrl}
                  onChange={(e) => setFormData({ ...formData, embedUrl: e.target.value })}
                  className="w-full bg-[#141418] border border-[#383846] focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-500 focus:outline-none font-mono text-[11px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-200 font-bold mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-[#141418] border border-[#383846] focus:border-amber-400 rounded-xl px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="Sales & Revenue">Sales & Revenue</option>
                    <option value="Executive">Executive</option>
                    <option value="Product Analytics">Product Analytics</option>
                    <option value="Operations">Operations</option>
                    <option value="Finance">Finance</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-200 font-bold mb-1">Dataset Model Name</label>
                  <input
                    type="text"
                    placeholder="e.g. SalesModel"
                    value={formData.datasetName}
                    onChange={(e) => setFormData({ ...formData, datasetName: e.target.value })}
                    className="w-full bg-[#141418] border border-[#383846] focus:border-amber-400 rounded-xl px-3 py-2 text-white placeholder-zinc-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-200 font-bold mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Brief description of the KPIs and visual charts in this report"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-[#141418] border border-[#383846] focus:border-amber-400 rounded-xl px-3.5 py-2 text-white placeholder-zinc-500 resize-none focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddingReport(false)}
                  className="px-4 py-2 border border-[#383846] hover:bg-zinc-800 text-zinc-300 font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded-xl transition cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {formSubmitting ? 'Saving...' : 'Connect Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Power BI Help / Quick Guide Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#1e1e24] border border-[#33333e] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-[#2e2e38] flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <HelpCircle className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">How to get a Power BI Embed URL</h3>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-zinc-300 leading-relaxed">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200">
                <span className="font-bold text-amber-300">Zero-Config Instant Embed:</span>
                <p className="mt-1">
                  You can embed any Power BI report published to the web or an organization portal directly in DataMind without leaving the app.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start space-x-2.5">
                  <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 text-amber-400 font-bold flex items-center justify-center shrink-0">1</div>
                  <p>
                    Open your report on <a href="https://app.powerbi.com" target="_blank" rel="noreferrer" className="text-amber-400 underline">app.powerbi.com</a>.
                  </p>
                </div>

                <div className="flex items-start space-x-2.5">
                  <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 text-amber-400 font-bold flex items-center justify-center shrink-0">2</div>
                  <p>
                    Click <strong className="text-white">File &rarr; Embed report</strong> in the top menu bar.
                  </p>
                </div>

                <div className="flex items-start space-x-2.5">
                  <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 text-amber-400 font-bold flex items-center justify-center shrink-0">3</div>
                  <p>
                    Choose <strong className="text-white">"Publish to web (public)"</strong> or <strong className="text-white">"Website or portal"</strong>.
                  </p>
                </div>

                <div className="flex items-start space-x-2.5">
                  <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 text-amber-400 font-bold flex items-center justify-center shrink-0">4</div>
                  <p>
                    Copy the link (e.g. <code className="text-amber-300 bg-black/40 px-1 py-0.5 rounded font-mono">https://app.powerbi.com/view?r=...</code>) and paste it into DataMind!
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl transition"
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
