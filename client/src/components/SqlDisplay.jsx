import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, Code2, Sparkles, RefreshCw } from 'lucide-react';

export default function SqlDisplay({ sql, explanation, selfCorrected }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl mb-4">
      {/* Top Header */}
      <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Code2 className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-slate-300">Generated SQL Query</span>
          {selfCorrected && (
            <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Auto-Corrected
            </span>
          )}
        </div>

        <button
          onClick={handleCopy}
          className="text-xs btn-3d-secondary text-slate-300 px-2.5 py-1.5 rounded-lg flex items-center space-x-1.5 cursor-pointer font-medium"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy SQL</span>
            </>
          )}
        </button>
      </div>

      {/* SQL Code Box */}
      <div className="text-xs font-mono">
        <SyntaxHighlighter
          language="sql"
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: 'transparent',
            fontSize: '0.8rem',
            lineHeight: '1.4'
          }}
        >
          {sql}
        </SyntaxHighlighter>
      </div>

      {/* Explanation Footer */}
      {explanation && (
        <div className="bg-slate-950/60 px-4 py-2.5 border-t border-slate-800/60 flex items-start space-x-2 text-xs text-slate-300">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
          <p><span className="font-semibold text-slate-200">Explanation:</span> {explanation}</p>
        </div>
      )}
    </div>
  );
}
