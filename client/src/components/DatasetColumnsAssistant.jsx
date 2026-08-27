import React, { useState } from 'react';
import { Layers, FileSpreadsheet, Columns, Sparkles, Plus, Check, HelpCircle, Table, ChevronRight, Info } from 'lucide-react';

export default function DatasetColumnsAssistant({
  activeDataSource,
  onInsertText,
  onSelectQuestion,
  title,
  subtitle,
  isNotRelated = false
}) {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [copiedCol, setCopiedCol] = useState(null);

  // Safely extract tables array from activeDataSource schemaMetadata
  const getTables = () => {
    if (!activeDataSource) return [];
    let meta = activeDataSource.schemaMetadata;
    if (typeof meta === 'string') {
      try {
        meta = JSON.parse(meta);
      } catch (e) {
        meta = null;
      }
    }
    return meta?.tables || [];
  };

  const tables = getTables();

  // Helper to format clean sheet / table display names
  const getSheetDisplayName = (table, index) => {
    if (!table) return `Sheet ${index + 1}`;
    if (table.rawSheetName) return table.rawSheetName;

    let clean = table.name || `Sheet_${index + 1}`;
    clean = clean.replace(/^tbl_/, '').replace(/_\d{5,}$/, '').replace(/_/g, ' ');
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  };

  const currentTable = tables[activeSheetIndex] || tables[0];
  const currentSheetName = getSheetDisplayName(currentTable, activeSheetIndex);

  const handleColumnClick = (colName, e) => {
    e?.preventDefault?.();
    if (!onInsertText) return;

    onInsertText(colName);
    setCopiedCol(colName);
    setTimeout(() => {
      setCopiedCol(null);
    }, 2000);
  };

  // Generate dynamic, sheet-aware suggested questions
  const generateSheetSuggestions = (table, sheetName) => {
    if (!table || !table.columns || table.columns.length === 0) {
      return [
        `Show all records from ${sheetName || 'dataset'}`,
        `Count total records in ${sheetName || 'dataset'}`,
        `List top 10 rows from ${sheetName || 'dataset'}`
      ];
    }

    const cols = table.columns.map(c => typeof c === 'string' ? c : c.name);
    const numCols = table.columns
      .filter(c => {
        const typeStr = (c.type || '').toLowerCase();
        const nameStr = (c.name || '').toLowerCase();
        return typeStr.includes('int') || typeStr.includes('float') || typeStr.includes('num') ||
          nameStr.includes('amount') || nameStr.includes('score') || nameStr.includes('age') ||
          nameStr.includes('gpa') || nameStr.includes('price') || nameStr.includes('total') ||
          nameStr.includes('salary') || nameStr.includes('count') || nameStr.includes('value');
      })
      .map(c => typeof c === 'string' ? c : c.name);

    const catCols = cols.filter(c => {
      const nameStr = c.toLowerCase();
      return nameStr.includes('city') || nameStr.includes('location') || nameStr.includes('department') ||
        nameStr.includes('major') || nameStr.includes('grade') || nameStr.includes('category') ||
        nameStr.includes('type') || nameStr.includes('status') || nameStr.includes('gender') || nameStr.includes('country');
    });

    const nameCol = cols.find(c => c.toLowerCase().includes('name')) || cols[0];
    const metricCol = numCols.find(c => !c.toLowerCase().includes('id')) || numCols[0];
    const categoryCol = catCols[0] || cols.find(c => c !== nameCol && !c.toLowerCase().includes('id')) || cols[1];

    const questions = [];

    // Question 1: Basic Select
    questions.push(`Show all records from ${sheetName}`);

    // Question 2: Specific Columns
    if (nameCol && categoryCol && nameCol !== categoryCol) {
      questions.push(`Show ${nameCol} and ${categoryCol} from ${sheetName}`);
    } else if (nameCol) {
      questions.push(`Show ${nameCol} from ${sheetName}`);
    }

    // Question 3: Metric Top 5
    if (metricCol) {
      questions.push(`Show top 5 records from ${sheetName} ordered by ${metricCol} desc`);
    }

    // Question 4: Aggregation / Group by
    if (categoryCol) {
      questions.push(`Count total records in ${sheetName} grouped by ${categoryCol}`);
    }

    // Question 5: Average metric
    if (metricCol && categoryCol) {
      questions.push(`What is the average ${metricCol} by ${categoryCol} in ${sheetName}?`);
    } else if (metricCol) {
      questions.push(`Calculate average ${metricCol} in ${sheetName}`);
    }

    return questions.slice(0, 5);
  };

  const suggestions = generateSheetSuggestions(currentTable, currentSheetName);

  if (!activeDataSource) return null;

  return (
    <div className={`rounded-2xl border transition-all duration-200 shadow-xl overflow-hidden ${
      isNotRelated 
        ? 'bg-[#181a20] border-amber-500/50 shadow-amber-950/20' 
        : 'bg-[#181a20] border-slate-800/90'
    }`}>
      {/* Header Bar */}
      <div className="p-4 md:p-5 border-b border-slate-800/80 bg-[#14161c] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start space-x-3 min-w-0">
          <div className={`p-2.5 rounded-xl shrink-0 ${
            isNotRelated 
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
              : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
          }`}>
            {tables.length > 1 ? <Layers className="w-5 h-5" /> : <FileSpreadsheet className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 truncate">
              <span>{title || (isNotRelated ? "Query Not Related to Database — Available Dataset Schema" : "Dataset Columns & Sheet Assistant")}</span>
              {tables.length > 1 && (
                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-md bg-indigo-950 text-indigo-300 border border-indigo-800/80">
                  {tables.length} Sheets
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {subtitle || "Click any column pill below to add it directly into your chat question box."}
            </p>
          </div>
        </div>

        {/* Copied Toast Banner */}
        {copiedCol && (
          <div className="px-3 py-1.5 bg-emerald-950/90 border border-emerald-500/60 rounded-xl text-emerald-300 text-xs font-bold flex items-center space-x-1.5 animate-bounce self-start sm:self-auto shrink-0 shadow-lg">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>Added "{copiedCol}" to chat box!</span>
          </div>
        )}
      </div>

      {/* Sheets Mention / Sheet Selection Tabs (If multi-sheet) */}
      {tables.length > 0 ? (
        <div className="p-4 md:p-5 space-y-5">
          {tables.length > 1 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Select Sheet to view columns (Total {tables.length} sheets in {activeDataSource.name}):</span>
                </span>
                <span className="text-[11px] text-indigo-300 font-semibold">
                  Sheet {activeSheetIndex + 1} of {tables.length}
                </span>
              </div>

              {/* Sheet Pills / Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {tables.map((tbl, idx) => {
                  const sheetName = getSheetDisplayName(tbl, idx);
                  const isActive = idx === activeSheetIndex;
                  const colCount = tbl.columns?.length || 0;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveSheetIndex(idx)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 shrink-0 cursor-pointer border ${
                        isActive
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30'
                          : 'bg-[#121419] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <FileSpreadsheet className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-indigo-400'}`} />
                      <span>{sheetName}</span>
                      <span className={`px-1.5 py-0.2 text-[10px] rounded-md ${
                        isActive ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {colCount} cols
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Current Sheet Title & Column Badges Box */}
          <div className="bg-[#121419] border border-slate-800/90 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center space-x-2">
                <Table className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                  Sheet: <span className="text-cyan-400 capitalize">{currentSheetName}</span>
                </h4>
                <span className="text-xs text-slate-500 font-medium">
                  ({currentTable?.columns?.length || 0} Columns Available)
                </span>
              </div>
              <span className="text-[11px] text-slate-400 hidden sm:inline-block">
                ⚡ Click column to insert text
              </span>
            </div>

            {/* Column Badges Grid */}
            {currentTable?.columns && currentTable.columns.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {currentTable.columns.map((col, cIdx) => {
                  const colName = typeof col === 'string' ? col : col.name;
                  const colType = typeof col === 'object' ? col.type : null;
                  const isJustAdded = copiedCol === colName;

                  return (
                    <button
                      key={cIdx}
                      type="button"
                      onClick={(e) => handleColumnClick(colName, e)}
                      title={`Click to add "${colName}" into your chat question box`}
                      className={`group px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 border active:scale-95 ${
                        isJustAdded
                          ? 'bg-emerald-600 border-emerald-400 text-white ring-2 ring-emerald-400/50'
                          : 'bg-[#181a20] hover:bg-indigo-950/70 border-slate-700/80 hover:border-indigo-500/80 text-slate-200 hover:text-white shadow-sm'
                      }`}
                    >
                      <Columns className={`w-3.5 h-3.5 ${isJustAdded ? 'text-white' : 'text-indigo-400 group-hover:text-cyan-300'}`} />
                      <span>{colName}</span>
                      {colType && (
                        <span className="text-[9px] px-1 py-0.2 uppercase rounded bg-slate-800 text-slate-400 font-mono group-hover:bg-indigo-900 group-hover:text-indigo-200">
                          {colType}
                        </span>
                      )}
                      <Plus className={`w-3 h-3 opacity-60 group-hover:opacity-100 transition ${isJustAdded ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic py-1">No columns metadata found for this sheet.</p>
            )}
          </div>

          {/* Suggested Questions Section */}
          <div className="bg-[#121419] border border-slate-800/90 rounded-xl p-4 space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-200">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Suggested questions for sheet <span className="text-amber-300 font-semibold">{currentSheetName}</span>:</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {suggestions.map((q, qIdx) => (
                <button
                  key={qIdx}
                  type="button"
                  onClick={() => onSelectQuestion?.(q)}
                  className="text-left text-xs bg-[#181a20] hover:bg-slate-800 border border-slate-700/80 hover:border-slate-500 text-indigo-300 hover:text-white px-3 py-2 rounded-xl transition duration-150 cursor-pointer font-medium flex items-center space-x-1.5 group active:scale-[0.99]"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 shrink-0" />
                  <span>{q}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 text-center text-slate-400 text-sm italic">
          No schema metadata available for active dataset.
        </div>
      )}
    </div>
  );
}
