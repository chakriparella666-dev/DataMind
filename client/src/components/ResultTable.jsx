import React, { useState } from 'react';
import { Download, ThumbsUp, Table, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { saveQAPair } from '../services/api';

export default function ResultTable({ data = [], fields = [], question, sql, dataSourceId }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!data || data.length === 0) return null;

  const colKeys = fields && fields.length > 0 ? fields : Object.keys(data[0]);

  const totalPages = Math.ceil(data.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const currentRows = data.slice(startIndex, startIndex + pageSize);

  // Download CSV Handler
  const handleDownloadCSV = () => {
    if (!data || data.length === 0) return;

    const headers = colKeys.join(',');
    const rows = data.map(row =>
      colKeys.map(key => {
        let val = row[key];
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      }).join(',')
    );

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `query_result_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Save to Training Data Handler
  const handleSaveToTraining = async () => {
    if (!question || !sql || saved || saving) return;
    setSaving(true);
    try {
      await saveQAPair({
        dataSourceId: dataSourceId || 'default',
        question,
        sql
      });
      setSaved(true);
    } catch (err) {
      console.error('Failed to save to training:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#14161c] border border-slate-800/90 rounded-2xl overflow-hidden shadow-xl mb-4">
      {/* Table Toolbar */}
      <div className="bg-[#181a20] px-5 py-3 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-2.5">
          <Table className="w-5 h-5 text-indigo-400" />
          <span className="text-sm font-bold text-slate-200">
            Query Results ({data.length} rows)
          </span>
        </div>

        <div className="flex items-center space-x-3">
          {/* Save to Training Data Button */}
          {question && sql && (
            <button
              onClick={handleSaveToTraining}
              disabled={saved || saving}
              className={`text-xs px-3.5 py-2 rounded-xl flex items-center space-x-2 font-semibold transition cursor-pointer ${
                saved
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-default'
                  : 'bg-[#1e212b] hover:bg-slate-800 text-slate-200 border border-slate-700/80'
              }`}
              title="Save this question & verified SQL pair into RAG training dataset"
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Saved to Training</span>
                </>
              ) : (
                <>
                  <ThumbsUp className="w-4 h-4 text-indigo-400" />
                  <span>{saving ? 'Saving...' : 'Save as Training Example'}</span>
                </>
              )}
            </button>
          )}

          {/* Download CSV Button */}
          <button
            onClick={handleDownloadCSV}
            className="text-xs bg-[#5850ec] hover:bg-[#4f46e5] text-white font-semibold px-4 py-2 rounded-xl flex items-center space-x-2 shrink-0 cursor-pointer shadow-md"
          >
            <Download className="w-4 h-4" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {/* Table Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm font-sans text-slate-200">
          <thead className="bg-[#121419] uppercase tracking-wider text-xs font-bold text-slate-400 border-b border-slate-800">
            <tr>
              {colKeys.map((col, idx) => (
                <th key={idx} className="px-5 py-3 whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {currentRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-[#1b1e27] transition">
                {colKeys.map((col, cIdx) => {
                  const cellVal = row[col];
                  return (
                    <td key={cIdx} className="px-5 py-3 whitespace-nowrap font-mono text-sm">
                      {cellVal === null || cellVal === undefined ? (
                        <span className="text-slate-500 italic">null</span>
                      ) : (
                        String(cellVal)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="bg-[#121419] px-5 py-3 border-t border-slate-800 flex items-center justify-between text-sm text-slate-400 font-medium">
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg hover:bg-slate-800 border border-slate-700/80 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg hover:bg-slate-800 border border-slate-700/80 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
