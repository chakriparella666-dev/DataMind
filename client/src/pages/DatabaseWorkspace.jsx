import React, { useState, useEffect, useRef } from 'react';
import { Download, AlertCircle, Terminal, FileCode2, Sparkles, Trash2, Check, ChevronDown, ChevronUp, X, Columns, HelpCircle, Database, ArrowRight } from 'lucide-react';
import ResultTable from '../components/ResultTable';
import ChartRenderer from '../components/ChartRenderer';
import PowerBIDashboard from '../components/PowerBIDashboard';
import DatasetColumnsAssistant from '../components/DatasetColumnsAssistant';
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
  const [matchingSuggestion, setMatchingSuggestion] = useState(null);
  const [viewType, setViewType] = useState('Table'); // 'Table' | 'Bar Chart' | 'Line Chart' | 'Pie Chart'
  const [isRecentExpandedMobile, setIsRecentExpandedMobile] = useState(false);
  const [showColumnsDrawer, setShowColumnsDrawer] = useState(true);
  const textareaRef = useRef(null);

  const handleInsertText = (textToInsert) => {
    if (!textareaRef.current) {
      const newText = localQuestion ? `${localQuestion.trim()} ${textToInsert}` : textToInsert;
      updateQuestion(newText);
      return;
    }

    const input = textareaRef.current;
    const start = input.selectionStart ?? localQuestion.length;
    const end = input.selectionEnd ?? localQuestion.length;

    const before = localQuestion.substring(0, start);
    const after = localQuestion.substring(end);

    const spaceBefore = before.length > 0 && !before.endsWith(' ') ? ' ' : '';
    const spaceAfter = after.length > 0 && !after.startsWith(' ') ? ' ' : ' ';

    const updated = `${before}${spaceBefore}${textToInsert}${spaceAfter}${after}`;
    updateQuestion(updated);

    setTimeout(() => {
      input.focus();
      const newCursorPos = (before + spaceBefore + textToInsert + spaceAfter).length;
      input.setSelectionRange(newCursorPos, newCursorPos);
    }, 50);
  };

  const autoRunQuestionRef = useRef('');

  const handleSelectQuestion = (qText) => {
    setLocalQuestion(qText);
    if (setQuestion) setQuestion(qText);
    setError('');
    setTimeout(() => {
      if (textareaRef.current) textareaRef.current.focus();
      executeQueryForText(qText);
    }, 50);
  };

  // Sync local question with prop when props change externally (e.g. from Dashboard or link click)
  useEffect(() => {
    const nextQ = question || '';
    setLocalQuestion(nextQ);
    if (!nextQ) {
      setError('');
      autoRunQuestionRef.current = '';
      if (setActiveQuery && activeQuery !== null) {
        setActiveQuery(null);
      }
    }
  }, [question]);

  // Auto-restore activeQuery OR auto-run live query ONLY ONCE when navigating from Dashboard or External link
  useEffect(() => {
    if (question && question.trim() && question.trim().length >= 3 && !activeQuery && !querying && !error) {
      if (autoRunQuestionRef.current === question.trim()) {
        return; // Already auto-executed for this navigation question!
      }

      autoRunQuestionRef.current = question.trim();

      const match = Array.isArray(recentQueries) ? recentQueries.find(q =>
        q.question && q.question.trim().toLowerCase() === question.trim().toLowerCase()
      ) : null;

      if (match && Array.isArray(match.rows) && match.rows.length > 0 && setActiveQuery) {
        setActiveQuery(match);
      } else {
        executeQueryForText(question);
      }
    }
  }, [question, activeQuery]);

  const updateQuestion = (val) => {
    setLocalQuestion(val);
    if (!val) {
      setError('');
      autoRunQuestionRef.current = '';
      if (setQuestion) setQuestion('');
    }
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

  const findMatchingDataSourceLocally = (questionText, dsList, currentDs) => {
    if (!Array.isArray(dsList) || dsList.length <= 1) return null;
    const prompt = (questionText || '').toLowerCase().trim();
    const words = prompt.replace(/[^a-z0-9_\s]/g, '').split(/\s+/);
    const stopWords = new Set(['give', 'me', 'the', 'show', 'all', 'list', 'get', 'select', 'find', 'display', 'data', 'from', 'table', 'database', 'where', 'and', 'or', 'for', 'with', 'in', 'of', 'to', 'a', 'an', 'is', 'are', 'what', 'which', 'how', 'many', 'count', 'name', 'names']);
    const keywords = words.filter(w => w.length >= 3 && !stopWords.has(w));
    if (keywords.length === 0) return null;

    const currentId = currentDs ? String(currentDs.id || currentDs._id) : '';

    for (const ds of dsList) {
      const dsId = String(ds.id || ds._id);
      if (dsId === currentId) continue;

      let meta = ds.schemaMetadata;
      if (typeof meta === 'string') {
        try { meta = JSON.parse(meta); } catch (e) { meta = null; }
      }
      if (!meta || !meta.tables) continue;

      const tokens = new Set();
      (ds.name || '').toLowerCase().replace(/[^a-z0-9_]/g, ' ').split(/\s+/).forEach(t => { if (t.length >= 3) tokens.add(t); });

      for (const tbl of meta.tables) {
        (tbl.name || '').toLowerCase().replace(/[^a-z0-9_]/g, ' ').split(/\s+/).forEach(t => { if (t.length >= 3) tokens.add(t); });
        for (const col of (tbl.columns || [])) {
          const colName = typeof col === 'string' ? col : (col.name || '');
          colName.toLowerCase().replace(/[^a-z0-9_]/g, ' ').split(/\s+/).forEach(t => { if (t.length >= 3) tokens.add(t); });
        }
      }

      for (const kw of keywords) {
        const stem = kw.replace(/s$/, '');
        for (const tok of tokens) {
          if (tok.includes(kw) || tok.includes(stem) || kw.includes(tok) || stem.includes(tok)) {
            return {
              id: dsId,
              _id: ds._id || ds.id,
              name: ds.name,
              type: ds.type || 'DATABASE',
              fullObject: ds
            };
          }
        }
      }
    }
    return null;
  };

  const handleSwitchDatabaseAndRun = (targetDs) => {
    const dsObj = targetDs.fullObject || (Array.isArray(dataSources) ? dataSources.find(ds => String(ds.id || ds._id) === String(targetDs.id || targetDs._id)) : null) || targetDs;
    if (dsObj && setActiveDataSource) {
      setActiveDataSource(dsObj);
      setError('');
      setMatchingSuggestion(null);
      setTimeout(() => {
        executeQueryForText(localQuestion, dsObj);
      }, 150);
    }
  };

  const executeQueryForText = async (targetText, overrideDs = null) => {
    const qToRun = (targetText || localQuestion || '').trim();
    if (!qToRun || querying) return;

    if (qToRun.length < 3) {
      setError('Please enter a complete question (at least 3 characters).');
      return;
    }

    if (setQuestion) setQuestion(qToRun);
    setQuerying(true);
    setError('');
    setMatchingSuggestion(null);

    const activeDs = overrideDs || activeDataSource;

    try {
      const res = await sendChatMessage({
        message: qToRun,
        dataSourceId: activeDs ? (activeDs._id || activeDs.id) : null,
        mode: 'sql'
      });

      const agentResult = res.result || res.data || res;

      if (res.success && agentResult) {
        if (agentResult.isRelevant === false || !agentResult.sql) {
          const matchingDs = agentResult.matchingDataSource || findMatchingDataSourceLocally(qToRun, dataSources, activeDs);
          setMatchingSuggestion(matchingDs);
          setError(agentResult.error || agentResult.explanation || agentResult.text || 'The question is not related to the connected database.');
          if (setActiveQuery) setActiveQuery(null);
          return;
        }

        if (agentResult.error) {
          const matchingDs = agentResult.matchingDataSource || findMatchingDataSourceLocally(qToRun, dataSources, activeDs);
          setMatchingSuggestion(matchingDs);
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
          question: qToRun,
          sql: formattedSql,
          rowCount: agentResult.rowCount !== undefined ? agentResult.rowCount : rowsData.length,
          executionTimeMs: agentResult.executionTimeMs || 180,
          columns: colsData,
          rows: rowsData,
          explanation: agentResult.explanation || ''
        };

        if (setActiveQuery) setActiveQuery(newQueryResult);
        if (setRecentQueries) setRecentQueries(prev => [newQueryResult, ...(prev || [])]);
        onAddSession?.(qToRun);
      } else {
        const matchingDs = findMatchingDataSourceLocally(qToRun, dataSources, activeDs);
        setMatchingSuggestion(matchingDs);
        setError(res.error || 'Failed to process question via AI Engine.');
        if (setActiveQuery) setActiveQuery(null);
      }
    } catch (err) {
      const matchingDs = findMatchingDataSourceLocally(qToRun, dataSources, activeDs);
      setMatchingSuggestion(matchingDs);
      setError(err.response?.data?.error || err.message || 'Error processing query via AI Engine.');
      if (setActiveQuery) setActiveQuery(null);
    } finally {
      setQuerying(false);
    }
  };

  const handleAsk = (e) => {
    e?.preventDefault();
    executeQueryForText(localQuestion);
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
      const fullQ = (activeQuery.question || 'Database Query').trim();
      await createDashboard({
        name: fullQ,
        description: `Generated from query: ${fullQ}`,
        question: fullQ,
        sql: activeQuery.sql,
        dataSourceId: activeDataSource ? (activeDataSource._id || activeDataSource.id) : null,
        visibility: 'Private',
        widgets: 1
      });

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
        <div className="bg-[#181a20] border border-slate-800/90 rounded-2xl p-4 md:p-6 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0 w-full overflow-hidden">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-white mb-1">Ask a question</h2>
            <p className="text-xs md:text-sm text-zinc-400 font-medium truncate" title={`${dbDisplayName} — ${dbTypeDisplay}`}>
              {dbDisplayName} — <span className="uppercase text-white font-bold">{dbTypeDisplay}</span>
            </p>
          </div>

          {Array.isArray(dataSources) && dataSources.length > 0 && (
            <div className="flex items-center space-x-2 min-w-0 w-full sm:w-auto shrink-0">
              <label htmlFor="ds-selector" className="text-xs font-semibold text-zinc-400 hidden sm:inline shrink-0">Active Dataset:</label>
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
                className="bg-[#111318] border border-slate-700 hover:border-white text-white text-xs md:text-sm font-semibold rounded-xl px-3.5 py-2 transition cursor-pointer focus:outline-none shadow-sm w-full sm:w-64 md:w-72 max-w-full truncate"
              >
                {dataSources.map(ds => {
                  const label = ds.name.length > 36 ? ds.name.slice(0, 33) + '...' : ds.name;
                  return (
                    <option key={ds.id || ds._id} value={String(ds.id || ds._id)} title={ds.name}>
                      {label} ({ds.type || 'DATABASE'})
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>

        {/* Question Card */}
        <div className="bg-[#181a20] border border-slate-800/90 rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200">Your question</h3>
            {localQuestion && (
              <button
                type="button"
                onClick={() => {
                  updateQuestion('');
                  if (setActiveQuery) setActiveQuery(null);
                }}
                className="text-xs text-zinc-400 hover:text-rose-400 font-semibold transition cursor-pointer flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear question</span>
              </button>
            )}
          </div>
          <form onSubmit={handleAsk} className="space-y-4">
            <textarea
              ref={textareaRef}
              rows={3}
              value={localQuestion}
              onChange={(e) => updateQuestion(e.target.value)}
              placeholder="Ask a question about your database..."
              className="w-full bg-[#121419] border border-slate-700/80 focus:border-white focus:outline-none rounded-xl p-4 text-sm md:text-base text-white placeholder-slate-500 transition resize-none leading-relaxed"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center space-x-3 gap-y-2">
                <button
                  type="submit"
                  disabled={querying || !localQuestion.trim()}
                  className="px-6 py-2.5 bg-white hover:bg-zinc-200 text-black font-bold text-sm rounded-xl transition cursor-pointer shadow-md active:scale-[0.98] disabled:opacity-40"
                >
                  {querying ? 'Processing AI Query...' : 'Ask'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowColumnsDrawer(!showColumnsDrawer)}
                  className={`px-4 py-2.5 rounded-xl border text-sm font-bold transition cursor-pointer flex items-center space-x-1.5 ${
                    showColumnsDrawer
                      ? 'bg-zinc-800 border-zinc-600 text-white'
                      : 'bg-[#121419] hover:bg-zinc-800 border-zinc-700/80 text-zinc-300 hover:text-white'
                  }`}
                >
                  <Columns className="w-4 h-4 text-zinc-300" />
                  <span>{showColumnsDrawer ? 'Hide Columns & Suggestions' : 'View Columns & Suggestions'}</span>
                </button>

                {localQuestion && (
                  <button
                    type="button"
                    onClick={() => {
                      updateQuestion('');
                      if (setActiveQuery) setActiveQuery(null);
                    }}
                    className="px-4 py-2.5 bg-[#121419] hover:bg-slate-800 border border-slate-700/80 text-zinc-300 hover:text-white font-bold text-sm rounded-xl transition cursor-pointer flex items-center space-x-1.5"
                  >
                    <X className="w-4 h-4 text-zinc-400" />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-rose-950/60 border border-rose-800/80 rounded-xl text-rose-300 text-sm flex items-start sm:items-center gap-2.5 min-w-0 max-w-full overflow-hidden break-words">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5 sm:mt-0" />
            <span className="min-w-0 flex-1 break-words break-all">{error}</span>
          </div>
        )}

        {/* Switch Database Recommendation Card */}
        {matchingSuggestion && (
          <div className="p-5 bg-[#14161c] border border-emerald-500/50 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-start space-x-3.5">
              <div className="p-3 bg-emerald-950/80 border border-emerald-700/80 rounded-xl text-emerald-400 shrink-0 shadow-md">
                <Sparkles className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-extrabold text-white">Database Switch Recommended</h4>
                  <span className="px-2.5 py-0.5 text-[10px] uppercase font-mono font-bold bg-emerald-950 text-emerald-300 rounded-md border border-emerald-800/80">
                    Matching Dataset Found
                  </span>
                </div>
                <p className="text-xs md:text-sm text-zinc-300 mt-1.5 leading-relaxed font-medium">
                  Your question <span className="text-white font-bold">"{localQuestion}"</span> is not related to <span className="text-rose-400 font-bold underline">{activeDataSource?.name || 'current database'}</span>, but matching entities were found in your connected dataset <span className="text-emerald-400 font-extrabold underline">{matchingSuggestion.name}</span>!
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs text-zinc-400 font-medium">
                Click below to switch active database and execute this query automatically:
              </span>
              <button
                type="button"
                onClick={() => handleSwitchDatabaseAndRun(matchingSuggestion)}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs md:text-sm rounded-xl transition shadow-lg flex items-center justify-center space-x-2 shrink-0 cursor-pointer active:scale-95"
              >
                <Database className="w-4 h-4 text-black" />
                <span>Switch to {matchingSuggestion.name} & Run Query</span>
                <ArrowRight className="w-4 h-4 text-black" />
              </button>
            </div>
          </div>
        )}

        {/* Dataset Columns Assistant & Sheet Suggestions Box */}
        {activeDataSource && (showColumnsDrawer || (error && (error.toLowerCase().includes('not related') || error.toLowerCase().includes('database')))) && (
          <DatasetColumnsAssistant
            activeDataSource={activeDataSource}
            onInsertText={handleInsertText}
            onSelectQuestion={handleSelectQuestion}
            isNotRelated={Boolean(error && (error.toLowerCase().includes('not related') || error.toLowerCase().includes('database')))}
          />
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
                    <option value="Power BI Dashboard">⚡ Power BI Dashboard</option>
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

            {/* Results Render Card (Table, Automated Power BI Dashboard, or Chart) */}
            <div className="bg-[#181a20] border border-slate-800/90 rounded-2xl p-6 shadow-xl">
              {viewType === 'Table' ? (
                <ResultTable
                  data={activeQuery.rows}
                  fields={activeQuery.columns}
                  question={activeQuery.question}
                  sql={activeQuery.sql}
                  dataSourceId={activeDataSource?._id}
                />
              ) : viewType === 'Power BI Dashboard' ? (
                <PowerBIDashboard
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
                Type your question in natural English above to convert it into dialect-correct SELECT queries via DataMind AI and view live results.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Right Column: "Recent queries" Sidebar */}
      <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-slate-800/90 bg-[#14161c] p-4 md:p-5 flex flex-col shrink-0">
        <div
          onClick={() => setIsRecentExpandedMobile(!isRecentExpandedMobile)}
          className="flex items-center justify-between pb-2 md:pb-3.5 border-b border-slate-800/80 cursor-pointer md:cursor-default select-none"
        >
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-white tracking-wide">Recent queries</h3>
            <span className="text-xs text-slate-500 font-medium">({recentQueries.length})</span>
          </div>
          <div className="flex items-center space-x-2 md:hidden">
            <span className="text-xs text-indigo-400 font-bold">
              {isRecentExpandedMobile ? 'Hide' : 'Show'}
            </span>
            <button type="button" className="text-zinc-400">
              {isRecentExpandedMobile ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className={`space-y-3.5 overflow-y-auto flex-1 pr-1 mt-3 ${isRecentExpandedMobile ? 'block' : 'hidden md:block'}`}>
          {recentQueries.length > 0 ? (
            recentQueries.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  handleSelectRecent(item);
                  setIsRecentExpandedMobile(false);
                }}
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
            ))
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-4">
              <p className="text-sm text-slate-500 italic">No recent queries yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
