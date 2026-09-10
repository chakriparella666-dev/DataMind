import React, { useState, useEffect } from 'react';
import { Database, ExternalLink, MessageSquare, Terminal } from 'lucide-react';
import { getSystemStats, getDataSources, getChatSessions } from '../services/api';

export default function HomePage({ activeDataSource, onNavigate, onSelectQuery, recentQueries = [] }) {
  const [stats, setStats] = useState({
    totalDataSources: 0,
    activeDataSources: 0,
    errorsCount: 0,
    recentActivityCount: 0
  });
  const [latestDataSources, setLatestDataSources] = useState([]);
  const [latestSqlQueries, setLatestSqlQueries] = useState([]);
  const [latestGeneralQueries, setLatestGeneralQueries] = useState([]);
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

      let allSessions = [];
      if (sessionsRes.success && Array.isArray(sessionsRes.sessions)) {
        allSessions = sessionsRes.sessions;
      }

      // 1. Gather SQL Workspace Queries from props, local storage & backend
      let sqlList = [];
      try {
        const savedLocal = localStorage.getItem('datamind_workspace_recent_queries');
        if (savedLocal) {
          const parsed = JSON.parse(savedLocal);
          if (Array.isArray(parsed)) sqlList = [...parsed];
        }
      } catch (e) { }

      if (Array.isArray(recentQueries) && recentQueries.length > 0) {
        sqlList = [...recentQueries, ...sqlList];
      }

      const dbSqlSessions = allSessions.filter(s => s.mode === 'sql' || s.sql || (s.rows && s.rows.length > 0));
      sqlList = [...sqlList, ...dbSqlSessions];

      const sqlMap = new Map();
      sqlList.forEach(q => {
        const qText = q.question || q.title || q.lastQuestion;
        if (qText && qText !== 'New Chat' && qText !== 'Default Session' && !/^(hi|hii|hiii|hello|hey)\b/i.test(qText.trim())) {
          const key = qText.trim().toLowerCase();
          if (!sqlMap.has(key)) {
            sqlMap.set(key, { ...q, question: qText, mode: 'sql' });
          }
        }
      });
      setLatestSqlQueries(Array.from(sqlMap.values()).slice(0, 5));

      // 2. Gather General AI Chatbot History
      const generalChatList = allSessions.filter(s => s.mode === 'general' || (!s.sql && (!s.rows || s.rows.length === 0)));
      const genMap = new Map();
      generalChatList.forEach(q => {
        const qText = q.question || q.title || q.lastQuestion;
        if (qText && qText !== 'New Chat' && qText !== 'Default Session') {
          const key = qText.trim().toLowerCase();
          if (!genMap.has(key)) {
            genMap.set(key, { ...q, question: qText, mode: 'general' });
          }
        }
      });
      setLatestGeneralQueries(Array.from(genMap.values()).slice(0, 5));

    } catch (err) {
      console.error('Failed to fetch home page live data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [recentQueries]);

  return (
    <div className="flex-1 h-screen bg-[#18181b] text-slate-100 overflow-y-auto overflow-x-hidden p-6 md:p-8 font-sans antialiased min-w-0 max-w-full">
      <div className="max-w-6xl w-full mx-auto space-y-6 min-w-0 max-w-full">
        
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
            <p className="text-xs font-medium text-zinc-400">Events logged</p>
          </div>

        </div>

        {/* Data Sources Row */}
        <div className="bg-[#222226] border border-[#2e2e36] rounded-2xl p-6 md:p-7 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white mb-0.5">Connected Data sources</h3>
              <p className="text-sm text-zinc-400">Recently active databases and files</p>
            </div>
            <div className="flex items-center space-x-2.5">
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
            <div className="py-8 text-center text-sm text-zinc-400 border border-dashed border-[#33333b] rounded-xl font-medium">
              No data sources yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 min-w-0">
              {latestDataSources.map(ds => (
                <div key={ds._id || ds.id} className="p-3.5 bg-[#18181b] border border-[#2e2e36] rounded-xl flex items-center justify-between gap-3 min-w-0">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <Database className="w-5 h-5 text-indigo-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white truncate" title={ds.name}>{ds.name}</p>
                      <p className="text-xs text-zinc-400 uppercase font-semibold">{ds.type}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 shrink-0">
                    Active
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Two Separate Columns: Dataset Workspace Queries vs General Chatbot History */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
          
          {/* Column 1: Dataset / SQL Workspace Queries */}
          <div className="bg-[#222226] border border-[#2e2e36] rounded-2xl p-6 md:p-7 shadow-xl space-y-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#2e2e36]">
                <div className="flex items-center space-x-2.5">
                  <Terminal className="w-5 h-5 text-indigo-400" />
                  <div>
                    <h3 className="text-base md:text-lg font-bold text-white">Database Workspace Queries</h3>
                    <p className="text-xs text-zinc-400">Recent SQL runs and data analytics questions</p>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate('workspace')}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition underline cursor-pointer shrink-0"
                >
                  Workspace
                </button>
              </div>

              {latestSqlQueries.length === 0 ? (
                <div className="py-10 text-center text-sm text-zinc-400 border border-dashed border-[#33333b] rounded-xl font-medium mt-4">
                  No dataset queries executed yet.
                </div>
              ) : (
                <div className="space-y-3 mt-4">
                  {latestSqlQueries.map(q => (
                    <div
                      key={q.id || q._id}
                      className="p-3.5 bg-[#18181b] border border-[#2e2e36] hover:border-slate-700 rounded-xl flex items-center justify-between cursor-pointer hover:bg-[#202026] transition"
                      onClick={() => {
                        if (onSelectQuery) {
                          onSelectQuery(q);
                        } else {
                          onNavigate('workspace');
                        }
                      }}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-sm font-bold text-white truncate" title={q.question || q.title}>{q.question || q.title || 'Database query'}</p>
                        <p className="text-xs text-zinc-400 font-mono mt-0.5">SQL Query</p>
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

          {/* Column 2: General AI Chatbot History */}
          <div className="bg-[#222226] border border-[#2e2e36] rounded-2xl p-6 md:p-7 shadow-xl space-y-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#2e2e36]">
                <div className="flex items-center space-x-2.5">
                  <MessageSquare className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="text-base md:text-lg font-bold text-white">General AI Chatbot History</h3>
                    <p className="text-xs text-zinc-400">Recent conversations and assistance prompts</p>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate('general')}
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition underline cursor-pointer shrink-0"
                >
                  Chatbot
                </button>
              </div>

              {latestGeneralQueries.length === 0 ? (
                <div className="py-10 text-center text-sm text-zinc-400 border border-dashed border-[#33333b] rounded-xl font-medium mt-4">
                  No chatbot conversations yet.
                </div>
              ) : (
                <div className="space-y-3 mt-4">
                  {latestGeneralQueries.map(q => (
                    <div
                      key={q.id || q._id}
                      className="p-3.5 bg-[#18181b] border border-[#2e2e36] hover:border-slate-700 rounded-xl flex items-center justify-between cursor-pointer hover:bg-[#202026] transition"
                      onClick={() => {
                        onNavigate('general');
                      }}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-sm font-bold text-white truncate" title={q.question || q.title}>{q.question || q.title || 'General Chat'}</p>
                        <p className="text-xs text-zinc-400 font-mono mt-0.5">Chatbot Prompt</p>
                      </div>
                      <button className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 shrink-0">
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
    </div>
  );
}
