import React, { useState, useEffect } from 'react';
import { Database, ExternalLink } from 'lucide-react';
import { getSystemStats, getDataSources, getChatSessions } from '../services/api';

export default function HomePage({ activeDataSource, onNavigate, onSelectQuery }) {
  const [stats, setStats] = useState({
    totalDataSources: 0,
    activeDataSources: 0,
    errorsCount: 0,
    recentActivityCount: 0
  });
  const [latestDataSources, setLatestDataSources] = useState([]);
  const [latestQueries, setLatestQueries] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [statsRes, dsRes, sessionsRes] = await Promise.all([
        getSystemStats(),
        getDataSources(),
        getChatSessions()
      ]);

      if (statsRes.success && statsRes.stats) {
        setStats(statsRes.stats);
      }

      if (dsRes.success && Array.isArray(dsRes.dataSources)) {
        setLatestDataSources(dsRes.dataSources.slice(0, 5));
      }

      if (sessionsRes.success && Array.isArray(sessionsRes.sessions)) {
        setLatestQueries(sessionsRes.sessions.slice(0, 5));
      }
    } catch (err) {
      console.error('Failed to fetch home page live data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="flex-1 h-screen bg-[#18181b] text-slate-100 overflow-y-auto p-6 md:p-8 font-sans antialiased">
      <div className="max-w-6xl w-full mx-auto space-y-6">
        
        {/* Quick Start Banner Card */}
        <div className="bg-[#222226] border border-[#2e2e36] rounded-2xl p-6 md:p-7 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-1.5">Quick start</h2>
            <p className="text-sm md:text-base text-zinc-300 font-medium">
              Connect a new data source or ask a question on an existing one.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={() => onNavigate('datasources')}
              className="px-4 py-2.5 bg-[#5850ec] hover:bg-[#4f46e5] text-white font-bold text-sm rounded-xl transition cursor-pointer shadow-sm active:scale-[0.98]"
            >
              <span>Add data source</span>
            </button>

            <button
              onClick={() => onNavigate('datasources')}
              className="px-4 py-2.5 border border-[#383842] hover:border-zinc-500 bg-[#18181b] hover:bg-[#26262e] text-zinc-200 font-bold text-sm rounded-xl transition cursor-pointer"
            >
              <span>Manage sources</span>
            </button>
          </div>
        </div>

        {/* 4 Stats Grid Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          
          {/* Card 1: Data sources */}
          <div className="bg-[#222226] border border-[#2e2e36] rounded-2xl p-5 md:p-6 shadow-lg space-y-1.5">
            <p className="text-sm font-bold text-zinc-300">Data sources</p>
            <h3 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
              {loading ? '...' : stats.totalDataSources}
            </h3>
            <p className="text-xs font-medium text-zinc-400">Total connected</p>
          </div>

          {/* Card 2: Active */}
          <div className="bg-[#222226] border border-[#2e2e36] rounded-2xl p-5 md:p-6 shadow-lg space-y-1.5">
            <p className="text-sm font-bold text-zinc-300">Active</p>
            <h3 className="text-4xl md:text-5xl font-extrabold text-emerald-400 tracking-tight">
              {loading ? '...' : stats.activeDataSources}
            </h3>
            <p className="text-xs font-medium text-zinc-400">Healthy connections</p>
          </div>

          {/* Card 3: Errors */}
          <div className="bg-[#222226] border border-[#2e2e36] rounded-2xl p-5 md:p-6 shadow-lg space-y-1.5">
            <p className="text-sm font-bold text-zinc-300">Errors</p>
            <h3 className="text-4xl md:text-5xl font-extrabold text-rose-500 tracking-tight">
              {loading ? '...' : stats.errorsCount}
            </h3>
            <p className="text-xs font-medium text-zinc-400">Require attention</p>
          </div>

          {/* Card 4: Recent activity */}
          <div className="bg-[#222226] border border-[#2e2e36] rounded-2xl p-5 md:p-6 shadow-lg space-y-1.5">
            <p className="text-sm font-bold text-zinc-300">Recent activity</p>
            <h3 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
              {loading ? '...' : stats.recentActivityCount}
            </h3>
            <p className="text-xs font-medium text-zinc-400">Queries run recently</p>
          </div>

        </div>

        {/* 2 Bottom Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Latest Data Sources Card */}
          <div className="bg-[#222226] border border-[#2e2e36] rounded-2xl p-6 md:p-7 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white mb-0.5">Latest data sources</h3>
                <p className="text-sm text-zinc-400">Your most recent connections</p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onNavigate('datasources')}
                  className="px-3.5 py-2 bg-[#5850ec] hover:bg-[#4f46e5] text-white font-bold text-xs md:text-sm rounded-xl transition cursor-pointer"
                >
                  Add new
                </button>
                <button
                  onClick={() => onNavigate('datasources')}
                  className="px-3.5 py-2 border border-[#383842] hover:border-zinc-500 bg-[#18181b] hover:bg-[#26262e] text-zinc-200 font-bold text-xs md:text-sm rounded-xl transition cursor-pointer"
                >
                  View all
                </button>
              </div>
            </div>

            {latestDataSources.length === 0 ? (
              <div className="py-10 text-center text-sm text-zinc-400 border border-dashed border-[#33333b] rounded-xl font-medium">
                No data sources yet.
              </div>
            ) : (
              <div className="space-y-3">
                {latestDataSources.map(ds => (
                  <div key={ds._id || ds.id} className="p-3.5 bg-[#18181b] border border-[#2e2e36] rounded-xl flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Database className="w-5 h-5 text-indigo-400 shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-white">{ds.name}</p>
                        <p className="text-xs text-zinc-400 uppercase font-semibold">{ds.type}</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Latest Queries Card */}
          <div className="bg-[#222226] border border-[#2e2e36] rounded-2xl p-6 md:p-7 shadow-xl space-y-5">
            <div>
              <h3 className="text-lg font-bold text-white mb-0.5">Latest queries</h3>
              <p className="text-sm text-zinc-400">Recent questions and runs</p>
            </div>

            {latestQueries.length === 0 ? (
              <div className="py-10 text-center text-sm text-zinc-400 border border-dashed border-[#33333b] rounded-xl font-medium">
                No queries yet.
              </div>
            ) : (
              <div className="space-y-3">
                {latestQueries.map(q => (
                  <div
                    key={q.id || q._id}
                    className="p-3.5 bg-[#18181b] border border-[#2e2e36] rounded-xl flex items-center justify-between cursor-pointer hover:bg-[#26262e] transition"
                    onClick={() => {
                      if (onSelectQuery) {
                        onSelectQuery(q);
                      } else {
                        onNavigate('workspace');
                      }
                    }}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-bold text-white truncate">{q.title || q.lastQuestion || 'Database query'}</p>
                      <p className="text-xs text-zinc-400">{q.mode || 'sql'}</p>
                    </div>
                    <button className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 shrink-0">
                      Open <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
