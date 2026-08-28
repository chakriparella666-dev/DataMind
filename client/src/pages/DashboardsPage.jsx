import React, { useState, useEffect } from 'react';
import { Plus, Eye, Edit2, Trash2, ArrowLeft, AlertCircle, LayoutDashboard, CheckCircle2 } from 'lucide-react';
import { getDashboards, createDashboard, deleteDashboard, getDataSources } from '../services/api';

export default function DashboardsPage({ onNavigate }) {
  const [dashboards, setDashboards] = useState([]);
  const [dataSources, setDataSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    layout: '2x2 Grid',
    visibility: 'Private (only me)',
    dateRange: 'Last 30 days',
    autoRefresh: 'Off',
    tags: ''
  });

  const fetchDashboards = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, dsRes] = await Promise.all([
        getDashboards(),
        getDataSources()
      ]);

      if (dashRes.success && Array.isArray(dashRes.dashboards)) {
        setDashboards(dashRes.dashboards);
      } else {
        setDashboards([]);
      }

      if (dsRes.success && Array.isArray(dsRes.dataSources)) {
        setDataSources(dsRes.dataSources);
      }
    } catch (err) {
      console.error('Error loading dashboards:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load dashboards from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboards();
  }, []);

  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setError(null);
    setSuccessMsg(null);
    setCreating(true);

    try {
      const res = await createDashboard({
        name: form.name.trim(),
        description: form.description.trim(),
        layout: form.layout,
        visibility: form.visibility,
        dateRange: form.dateRange,
        autoRefresh: form.autoRefresh,
        tags: form.tags,
        widgets: 0
      });

      if (res.success && res.dashboard) {
        setSuccessMsg(`Dashboard "${res.dashboard.name}" created successfully!`);
        setDashboards(prev => [res.dashboard, ...prev]);
        setForm({
          name: '',
          description: '',
          layout: '2x2 Grid',
          visibility: 'Private (only me)',
          dateRange: 'Last 30 days',
          autoRefresh: 'Off',
          tags: ''
        });
        setIsAdding(false);
      } else {
        setError(res.error || 'Failed to create dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error creating dashboard');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this dashboard?')) return;
    try {
      const res = await deleteDashboard(id);
      if (res.success) {
        setDashboards(prev => prev.filter(d => String(d.id || d._id) !== String(id)));
        setSuccessMsg('Dashboard deleted successfully.');
      }
    } catch (err) {
      setError('Error deleting dashboard');
    }
  };

  return (
    <div className="flex-1 h-screen bg-[#18181b] text-slate-100 overflow-y-auto p-6 md:p-8 font-sans antialiased">
      <div className="max-w-6xl w-full mx-auto space-y-6">

        {error && (
          <div className="p-4 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-sm flex items-center gap-2.5 font-medium shadow-lg">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-300 text-sm flex items-center gap-2.5 font-medium shadow-lg">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {!isAdding ? (
          <>
            {/* Page Header */}
            <div className="bg-[#222226] border border-[#2e2e36] rounded-2xl p-6 md:p-7 shadow-xl flex items-center justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-1.5">Dashboards</h1>
                <p className="text-sm md:text-base text-zinc-300 font-medium">Organize and visualize your data using custom dashboards and widgets.</p>
              </div>

              <button
                onClick={() => { setIsAdding(true); setError(null); setSuccessMsg(null); }}
                className="px-5 py-2.5 bg-[#5850ec] hover:bg-[#4f46e5] text-white font-bold text-sm rounded-xl transition cursor-pointer shadow-sm active:scale-[0.98] shrink-0"
              >
                <span>Add new</span>
              </button>
            </div>

            {/* Dashboards List Container */}
            <div className="bg-[#222226] border border-[#2e2e36] rounded-2xl p-6 md:p-7 shadow-xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white mb-0.5">All dashboards</h2>
                  <p className="text-sm text-zinc-400">Manage visibility, widgets and access</p>
                </div>
                <button
                  onClick={fetchDashboards}
                  className="text-xs text-zinc-400 hover:text-white font-semibold underline cursor-pointer"
                >
                  Refresh
                </button>
              </div>

              {loading ? (
                <div className="py-12 text-center text-zinc-400 text-sm font-medium">
                  Loading dashboards...
                </div>
              ) : dashboards.length === 0 ? (
                <div className="py-14 border border-dashed border-[#33333b] rounded-2xl text-center space-y-3.5">
                  <h3 className="text-lg font-bold text-white">No dashboards yet</h3>
                  <p className="text-sm text-zinc-400 max-w-sm mx-auto font-medium">
                    Create your first dashboard to start visualizing your data.
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={() => { setIsAdding(true); setError(null); setSuccessMsg(null); }}
                      className="px-5 py-2.5 bg-[#5850ec] hover:bg-[#4f46e5] text-white font-bold text-sm rounded-xl transition cursor-pointer shadow-sm active:scale-[0.98]"
                    >
                      <span>Add dashboard</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {dashboards.map((dash) => {
                    const fullQuestionText = dash.question || dash.description?.replace(/^Generated from query:\s*/i, '') || dash.name?.replace(/^Analytics\s*—\s*/i, '') || 'Database Query';
                    const fullDescText = `Generated from query: ${fullQuestionText}`;

                    return (
                      <div
                        key={dash.id || dash._id}
                        className="bg-[#18181b] border border-[#2e2e36] hover:border-zinc-500 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4 transition"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start space-x-2 text-amber-400 font-bold text-sm min-w-0 flex-1">
                              <LayoutDashboard className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                              <span className="text-white text-sm md:text-base font-bold leading-snug break-words" title={fullQuestionText}>
                                {fullQuestionText}
                              </span>
                            </div>
                            <span className="px-2.5 py-0.5 bg-[#222226] border border-[#33333b] text-zinc-300 text-[11px] font-semibold rounded-md shrink-0">
                              {dash.visibility || 'Private'}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 leading-relaxed font-medium break-words" title={fullDescText}>
                            {fullDescText}
                          </p>
                        </div>

                      <div className="pt-3 border-t border-[#2e2e36] flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-400">
                          {dash.widgets || 0} Widgets
                        </span>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => onNavigate?.('workspace', dash)}
                            className="px-3 py-1.5 bg-[#5850ec] hover:bg-[#4f46e5] text-white text-xs font-bold rounded-lg transition cursor-pointer"
                          >
                            Open
                          </button>
                          <button
                            onClick={() => handleDelete(dash.id || dash._id)}
                            className="px-2.5 py-1.5 border border-rose-800/80 hover:bg-rose-950/40 text-rose-400 text-xs font-bold rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>
              )}
            </div>
          </>
        ) : (
          /* INLINE Add Dashboard Form View (No Popup Modal!) */
          <div className="space-y-6">
            <div className="bg-[#222226] border border-[#2e2e36] rounded-2xl p-6 md:p-7 shadow-xl flex items-center justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-1.5">Add dashboard</h1>
                <p className="text-sm md:text-base text-zinc-300 font-medium">Create a new dashboard workspace to pin SQL charts and widgets</p>
              </div>

              <button
                onClick={() => setIsAdding(false)}
                className="px-4 py-2.5 border border-[#383842] hover:border-zinc-500 bg-[#18181b] text-zinc-200 font-bold text-xs md:text-sm rounded-xl transition cursor-pointer flex items-center space-x-2 shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to list</span>
              </button>
            </div>

            <div className="bg-[#222226] border border-[#2e2e36] rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
              <div className="p-4 bg-[#18181b] border border-[#2e2e36] rounded-xl text-xs md:text-sm text-zinc-300 font-medium">
                <span className="font-bold text-white">Tip:</span> You can add widgets after creating the dashboard. Start with key metrics, then charts.
              </div>

              <form onSubmit={handleCreateSubmit} autoComplete="off" className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-zinc-200 mb-1.5">Name</label>
                  <input
                    type="text"
                    name="name"
                    autoComplete="off"
                    value={form.name}
                    onChange={handleFormChange}
                    required
                    placeholder="e.g. Sales Performance (EU)"
                    className="w-full bg-[#18181b] border border-[#383842] focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-zinc-200 mb-1.5">Description</label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleFormChange}
                    rows={3}
                    placeholder="Short summary to help your team understand the purpose of this dashboard"
                    className="w-full bg-[#18181b] border border-[#383842] focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 transition resize-none"
                  />
                </div>

                <div className="p-5 bg-[#18181b] border border-[#2e2e36] rounded-xl space-y-4 relative pt-6">
                  <span className="absolute -top-3 left-4 bg-[#222226] px-2 text-xs font-bold text-zinc-200">
                    Layout & visibility
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-zinc-200 mb-1.5">Layout</label>
                      <select
                        name="layout"
                        value={form.layout}
                        onChange={handleFormChange}
                        className="w-full bg-[#18181b] border border-[#383842] focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white transition cursor-pointer font-medium"
                      >
                        <option value="2x2 Grid">2x2 Grid</option>
                        <option value="Single Column">Single Column</option>
                        <option value="Flexible Grid">Flexible Grid</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-zinc-200 mb-1.5">Visibility</label>
                      <select
                        name="visibility"
                        value={form.visibility}
                        onChange={handleFormChange}
                        className="w-full bg-[#18181b] border border-[#383842] focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white transition cursor-pointer font-medium"
                      >
                        <option value="Private (only me)">Private (only me)</option>
                        <option value="Shared">Shared</option>
                        <option value="Public">Public</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="p-5 bg-[#18181b] border border-[#2e2e36] rounded-xl space-y-4 relative pt-6">
                  <span className="absolute -top-3 left-4 bg-[#222226] px-2 text-xs font-bold text-zinc-200">
                    Defaults
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-zinc-200 mb-1.5">Default date range</label>
                      <select
                        name="dateRange"
                        value={form.dateRange}
                        onChange={handleFormChange}
                        className="w-full bg-[#18181b] border border-[#383842] focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white transition cursor-pointer font-medium"
                      >
                        <option value="Last 30 days">Last 30 days</option>
                        <option value="Last 7 days">Last 7 days</option>
                        <option value="This month">This month</option>
                        <option value="Year to date">Year to date</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-zinc-200 mb-1.5">Auto-refresh</label>
                      <select
                        name="autoRefresh"
                        value={form.autoRefresh}
                        onChange={handleFormChange}
                        className="w-full bg-[#18181b] border border-[#383842] focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white transition cursor-pointer font-medium"
                      >
                        <option value="Off">Off</option>
                        <option value="Every 5 min">Every 5 min</option>
                        <option value="Every 15 min">Every 15 min</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-zinc-200 mb-1.5">Tags</label>
                      <input
                        type="text"
                        name="tags"
                        value={form.tags}
                        onChange={handleFormChange}
                        placeholder="e.g. sales, eu, revenue"
                        className="w-full bg-[#18181b] border border-[#383842] focus:border-white focus:outline-none rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 transition"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center space-x-3">
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-6 py-3 bg-[#5850ec] hover:bg-[#4f46e5] text-white font-bold text-sm rounded-xl transition cursor-pointer shadow-md active:scale-[0.98] disabled:opacity-40"
                  >
                    {creating ? 'Creating dashboard...' : 'Save dashboard'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-5 py-3 bg-[#18181b] hover:bg-[#28282e] border border-[#383842] text-zinc-200 font-bold text-sm rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
