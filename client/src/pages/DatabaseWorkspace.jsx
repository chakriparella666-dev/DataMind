import React, { useState, useEffect } from 'react';
import { Download, AlertCircle, Terminal, FileCode2, Sparkles, Trash2, Check } from 'lucide-react';
import ResultTable from '../components/ResultTable';
import ChartRenderer from '../components/ChartRenderer';
import { sendChatMessage, deleteChatSession, getDashboards, createDashboard, updateDashboard } from '../services/api';

export default function DatabaseWorkspace({
  activeDataSource,
  setActiveDataSource,
  dataSources = [],
  onAddSession,
  question = '',
  setQuestion,
  activeQuery = null,
  setActiveQuery,
  recentQueries = [],
  setRecentQueries
}) {
  const [localQuestion, setLocalQuestion] = useState(question || '');
  const [querying, setQuerying] = useState(false);
  const [error, setError] = useState('');
  const [viewType, setViewType] = useState('Table'); // 'Table' | 'Bar Chart' | 'Line Chart' | 'Pie Chart'

  // Sync local question with prop when prop changes externally
  useEffect(() => {
    setLocalQuestion(question || '');
  }, [question]);

  // Auto-restore activeQuery from recentQueries if question is set but activeQuery is null
  useEffect(() => {
    if (!activeQuery && localQuestion && Array.isArray(recentQueries) && recentQueries.length > 0) {
      const match = recentQueries.find(q =>
        q.question && q.question.trim().toLowerCase() === localQuestion.trim().toLowerCase()
      );
      if (match && setActiveQuery) {
        setActiveQuery(match);
      }
    }
  }, [localQuestion, activeQuery, recentQueries, setActiveQuery]);

  const updateQuestion = (val) => {
    setLocalQuestion(val);
    if (setQuestion) setQuestion(val);
  };

  // Helper to ensure SQL is displayed cleanly line-by-line
  const formatSqlLineByLine = (rawSql) => {
    if (!rawSql) return '';
    let sql = rawSql.trim();

    if (!sql.includes('\n')) {
      sql = sql
        .replace(/\s+FROM\s+/gi, '\nFROM ')
        .replace(/\s+WHERE\s+/gi, '\nWHERE ')
        .replace(/\s+GROUP BY\s+/gi, '\nGROUP BY ')
        .replace(/\s+HAVING\s+/gi, '\nHAVING ')
        .replace(/\s+ORDER BY\s+/gi, '\nORDER BY ')
        .replace(/\s+LIMIT\s+/gi, '\nLIMIT ');
    }
    return sql;
  };

  const handleAsk = async (e) => {
    e?.preventDefault();
    if (!localQuestion.trim() || querying) return;

    setQuerying(true);
    setError('');

    try {
      const res = await sendChatMessage({
        message: localQuestion,
        dataSourceId: activeDataSource ? (activeDataSource._id || activeDataSource.id) : null,
        mode: 'sql'
      });

      const agentResult = res.result || res.data || res;

      if (res.success && agentResult) {
        if (agentResult.isRelevant === false || !agentResult.sql) {
          setError(agentResult.error || agentResult.explanation || agentResult.text || 'The question is not related to the connected database.');
          if (setActiveQuery) setActiveQuery(null);
          return;
        }

        if (agentResult.error) {
          setError(agentResult.error);
          if (setActiveQuery) setActiveQuery(null);
          return;
        }

        const rowsData = agentResult.data || agentResult.rows || [];
        const rawFields = agentResult.fields || (rowsData.length > 0 ? Object.keys(rowsData[0]) : []);
        const colsData = Array.isArray(rawFields) ? rawFields.map(f => (typeof f === 'string' ? f : (f?.name || String(f)))) : [];

        const formattedSql = formatSqlLineByLine(agentResult.sql);

        const newQueryResult = {
          id: 'q_' + Date.now(),
          question: localQuestion,
          sql: formattedSql,
          rowCount: agentResult.rowCount !== undefined ? agentResult.rowCount : rowsData.length,
          executionTimeMs: agentResult.executionTimeMs || 180,
          columns: colsData,
          rows: rowsData,
          explanation: agentResult.explanation || ''
        };

        if (setActiveQuery) setActiveQuery(newQueryResult);
        if (setRecentQueries) setRecentQueries(prev => [newQueryResult, ...(prev || [])]);
        onAddSession?.(localQuestion);
      } else {
        setError(res.error || 'Failed to process question via Gemini AI.');
        if (setActiveQuery) setActiveQuery(null);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Error processing query via Gemini AI.');
      if (setActiveQuery) setActiveQuery(null);
    } finally {
      setQuerying(false);
    }
  };

  const handleSelectRecent = (item) => {
    updateQuestion(item.question);
    if (setActiveQuery) setActiveQuery(item);
    setError('');
  };

  const handleDeleteQuery = async (e, item) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    const targetId = item.sessionId || item.id || item._id;

    if (setRecentQueries) {
      setRecentQueries(prev => prev.filter(q => (q.sessionId || q.id || q._id) !== targetId && q.question !== item.question));
    }

    if (activeQuery && (activeQuery.question === item.question || activeQuery.id === targetId)) {
      if (setActiveQuery) setActiveQuery(null);
      setLocalQuestion('');
      if (setQuestion) setQuestion('');
    }

    if (targetId) {
      try {
        await deleteChatSession(targetId);
      } catch (err) {
        console.warn('Error deleting chat session:', err.message);
      }
    }
  };

  const handleDownloadCSV = () => {
    if (!activeQuery || !activeQuery.rows || activeQuery.rows.length === 0) return;
    const keys = activeQuery.columns && activeQuery.columns.length > 0 ? activeQuery.columns : Object.keys(activeQuery.rows[0]);
    const csvContent = "data:text/csv;charset=utf-8,"
      + [keys.join(","), ...activeQuery.rows.map(row => keys.map(k => `"${row[k] || ''}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "query_results.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [addedSuccess, setAddedSuccess] = useState(false);

  const handleAddToDashboard = async () => {
    if (!activeQuery) return;
    try {
      const dashRes = await getDashboards();
      if (dashRes.success && Array.isArray(dashRes.dashboards) && dashRes.dashboards.length > 0) {
        const targetDashboard = dashRes.dashboards[0];
        await updateDashboard(targetDashboard.id || targetDashboard._id, {
          name: targetDashboard.name,
          question: activeQuery.question,
          sql: activeQuery.sql,
          dataSourceId: activeDataSource ? (activeDataSource._id || activeDataSource.id) : null,
          visibility: targetDashboard.visibility || 'Private',
          widgets: (targetDashboard.widgets || 0) + 1
        });
      } else {
        await createDashboard({
          name: `Analytics — ${activeQuery.question.slice(0, 25)}`,
          description: `Generated from query: ${activeQuery.question}`,
          question: activeQuery.question,
          sql: activeQuery.sql,
          dataSourceId: activeDataSource ? (activeDataSource._id || activeDataSource.id) : null,
          visibility: 'Private',
          widgets: 1
        });
      }

      setAddedSuccess(true);
      setTimeout(() => setAddedSuccess(false), 3000);
    } catch (err) {
      console.error('[Add To Dashboard Error]:', err);
    }
  };

  const dbDisplayName = activeDataSource ? activeDataSource.name : 'No active database connected';
  const dbTypeDisplay = activeDataSource ? (activeDataSource.type || 'DATABASE') : 'NONE';

  return (
    <div className="flex-1 h-[100dvh] bg-[#111318] text-slate-100 overflow-hidden flex flex-col md:flex-row font-sans select-none antialiased min-w-0 max-w-full">
      {/* Main Workspace Column */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 min-w-0 max-w-full overflow-x-hidden">

        {/* Top Active Data Source Header Card */}
        <div className="bg-[#181a20] border border-slate-800/90 rounded-2xl p-4 md:p-6 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white mb-1">Ask a question</h2>
            <p className="text-xs md:text-sm text-zinc-400 font-medium truncate">
              {dbDisplayName} — <span className="uppercase text-white font-bold">{dbTypeDisplay}</span>
            </p>
          </div>

          {Array.isArray(dataSources) && dataSources.length > 0 && (
            <div className="flex items-center space-x-2">
              <label htmlFor="ds-selector" className="text-xs font-semibold text-zinc-400 hidden sm:inline">Active Dataset:</label>
              <select
                id="ds-selector"
                value={activeDataSource ? String(activeDataSource.id || activeDataSource._id) : ''}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  const found = dataSources.find(ds => String(ds.id || ds._id) === selectedId);
                  if (found && setActiveDataSource) {
                    setActiveDataSource(found);
                    setError('');
                  }
                }}
                className="bg-[#111318] border border-slate-700 hover:border-white text-white text-xs md:text-sm font-semibold rounded-xl px-3.5 py-2 transition cursor-pointer focus:outline-none shadow-sm max-w-full"
              >
                {dataSources.map(ds => (
                  <option key={ds.id || ds._id} value={String(ds.id || ds._id)}>
                    {ds.name} ({ds.type || 'DATABASE'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Question Card */}
        <div className="bg-[#181a20] border border-slate-800/90 rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-slate-200">Your question</h3>
          <form onSubmit={handleAsk} className="space-y-4">
            <textarea
              rows={3}
              value={localQuestion}
              onChange={(e) => updateQuestion(e.target.value)}
              placeholder="Ask a question about your database..."
              className="w-full bg-[#121419] border border-slate-700/80 focus:border-white focus:outline-none rounded-xl p-4 text-sm md:text-base text-white placeholder-slate-500 transition resize-none leading-relaxed"
            />
            <div className="flex items-center justify-between">
              <button
                type="submit"
                disabled={querying || !localQuestion.trim()}
                className="px-6 py-2.5 bg-white hover:bg-zinc-200 text-black font-bold text-sm rounded-xl transition cursor-pointer shadow-md active:scale-[0.98] disabled:opacity-40"
              >
                {querying ? 'Querying Gemini AI...' : 'Ask'}
              </button>
            </div>
          </form>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-sm flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Generated SQL Card & Results OR Empty State */}
        {activeQuery ? (
          <>
            {/* Generated SQL Box */}
            <div className="bg-[#181a20] border border-slate-800/90 rounded-2xl p-5 md:p-6 shadow-xl space-y-4 min-w-0 max-w-full">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <FileCode2 className="w-4 h-4 text-zinc-300" />
                  <span>Generated SQL</span>
                </h3>
              </div>

              {/* Line-by-Line Formatted SQL Box */}
              <div className="bg-[#121419] border border-slate-800 rounded-xl p-4 md:p-5 font-mono text-sm md:text-base text-zinc-100 max-w-full overflow-x-auto leading-relaxed">
                <pre className="whitespace-pre-wrap break-words font-mono tracking-wide max-w-full">{formatSqlLineByLine(activeQuery.sql)}</pre>
              </div>

              {/* Line-by-line Easy to Understand Explanation */}
              {activeQuery.explanation && (
                <div className="p-4 bg-[#14161c] border border-slate-800 rounded-xl text-sm text-slate-300 space-y-1.5 shadow-inner">
                  <p className="font-bold text-zinc-300 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
                    <span>Query Explanation</span>
                  </p>
                  <p className="leading-relaxed text-slate-200 font-medium">{activeQuery.explanation}</p>
                </div>
              )}

              {/* Execution Metadata & Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-800/80">
                <div className="text-sm text-slate-400 font-medium">
                  Rows: <span className="text-white font-bold">{activeQuery.rowCount}</span> · Time: <span className="text-white font-bold">{activeQuery.executionTimeMs} ms</span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Download CSV Button */}
                  <button
                    type="button"
                    onClick={handleDownloadCSV}
                    className="px-4 py-2 border border-slate-700/80 hover:border-slate-500 bg-[#121419] hover:bg-slate-800 text-slate-200 text-sm font-semibold rounded-xl transition cursor-pointer flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download CSV</span>
                  </button>

                  {/* View Type Dropdown */}
                  <select
                    value={viewType}
                    onChange={(e) => setViewType(e.target.value)}
                    className="px-4 py-2 border border-slate-700/80 bg-[#121419] text-slate-200 text-sm font-semibold rounded-xl focus:outline-none transition cursor-pointer"
                  >
                    <option value="Table">Table</option>
                    <option value="Bar Chart">Bar Chart</option>
                    <option value="Line Chart">Line Chart</option>
                    <option value="Pie Chart">Pie Chart</option>
                  </select>

                  {/* Add to Dashboard Button */}
                  <button
                    type="button"
                    onClick={handleAddToDashboard}
                    className={`px-5 py-2 font-bold text-sm rounded-xl transition cursor-pointer shadow-md active:scale-[0.98] flex items-center gap-2 ${addedSuccess
                        ? 'bg-emerald-500 text-white'
                        : 'bg-white hover:bg-zinc-200 text-black'
                      }`}
                  >
                    {addedSuccess ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Added to dashboard!</span>
                      </>
                    ) : (
                      <span>Add to dashboard</span>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Results Render Card (Table or Chart) */}
            <div className="bg-[#181a20] border border-slate-800/90 rounded-2xl p-6 shadow-xl">
              {viewType === 'Table' ? (
                <ResultTable
                  data={activeQuery.rows}
                  fields={activeQuery.columns}
                  question={activeQuery.question}
                  sql={activeQuery.sql}
                  dataSourceId={activeDataSource?._id}
                />
              ) : (
                <ChartRenderer
                  chartType={viewType}
                  data={activeQuery.rows}
                />
              )}
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="bg-[#181a20] border border-slate-800/90 rounded-2xl p-14 text-center space-y-4 shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-[#14161c] border border-slate-700/80 text-zinc-300 mx-auto flex items-center justify-center shadow-md">
              <Terminal className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Ask a question to generate SQL</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                Type your question in natural English above to convert it into dialect-correct SELECT queries via Gemini AI and view live results.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Right Column: "Recent queries" Sidebar */}
      <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-slate-800/90 bg-[#14161c] p-5 flex flex-col shrink-0">
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800/80 mb-4">
          <h3 className="text-sm font-bold text-white tracking-wide">Recent queries</h3>
          <span className="text-xs text-slate-500 font-medium">Last {recentQueries.length}</span>
        </div>

        {recentQueries.length > 0 ? (
          <div className="space-y-3.5 overflow-y-auto flex-1 pr-1">
            {recentQueries.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelectRecent(item)}
                className={`p-3.5 rounded-xl border transition cursor-pointer relative group ${activeQuery?.question === item.question
                    ? 'bg-[#1b1e27] border-white text-white'
                    : 'bg-[#181a20] border-slate-800/80 hover:border-slate-700 text-slate-300'
                  }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="text-sm font-bold text-slate-200 line-clamp-2 pr-1">
                    {item.question}
                  </p>
                  <button
                    type="button"
                    title="Delete query"
                    onClick={(e) => handleDeleteQuery(e, item)}
                    className="p-1 rounded-lg hover:bg-rose-950/80 text-slate-500 hover:text-rose-400 border border-transparent hover:border-rose-800/60 transition cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  className="text-xs text-zinc-300 hover:text-white font-semibold underline"
                >
                  View details
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-4">
            <p className="text-sm text-slate-500 italic">No recent queries yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
