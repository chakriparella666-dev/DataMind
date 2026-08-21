import React, { useState } from 'react';
import { Copy, Check, Code } from 'lucide-react';

/**
 * Parses markdown text (headers, bold, lists, SQL code blocks) into ChatGPT-style formatted UI
 */
export default function FormattedMarkdown({ content }) {
  const [copiedCode, setCopiedCode] = useState(null);

  if (!content) return null;

  const handleCopy = (codeText, index) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCode(index);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Split content by code blocks ```sql ... ``` or ``` ... ```
  const codeBlockRegex = /```(?:sql|postgresql|mysql|sqlite)?\n?([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  let blockCount = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Text before code block
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: content.substring(lastIndex, match.index) });
    }
    // Code block itself
    parts.push({ type: 'code', value: match[1].trim(), id: blockCount++ });
    lastIndex = codeBlockRegex.lastIndex;
  }

  // Remaining text after last code block
  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.substring(lastIndex) });
  }

  // Format regular text lines (handling headings, bold, bullet points)
  const renderFormattedText = (textStr) => {
    const lines = textStr.split('\n');
    return lines.map((line, idx) => {
      let trimmed = line.trim();
      if (!trimmed) return <div key={idx} className="h-2" />;

      // Skip horizontal rule lines '---'
      if (trimmed === '---' || trimmed === '***') return null;

      // Handle Headings (### or ## or #)
      if (trimmed.startsWith('#')) {
        const level = trimmed.match(/^#+/)[0].length;
        const headingText = trimmed.replace(/^#+\s*/, '');
        const cleanHeading = headingText.replace(/\*\*(.*?)\*\*/g, '$1');
        return (
          <h3 key={idx} className="text-sm font-bold text-blue-300 mt-3 mb-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block"></span>
            <span>{cleanHeading}</span>
          </h3>
        );
      }

      // Handle Bullet points (* or -)
      let isBullet = false;
      if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || /^\d+\.\s/.test(trimmed)) {
        isBullet = true;
        trimmed = trimmed.replace(/^[\*\-\d\.]+\s*/, '');
      }

      // Process inline bold **text**
      const boldParts = trimmed.split(/(\*\*.*?\*\*)/g);
      const formattedLine = boldParts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={pIdx} className="bg-slate-800 text-cyan-300 font-mono text-[11px] px-1.5 py-0.5 rounded border border-slate-700">{part.slice(1, -1)}</code>;
        }
        return part;
      });

      if (isBullet) {
        return (
          <div key={idx} className="flex items-start space-x-2 my-1.5 pl-2">
            <span className="text-blue-400 mt-1">•</span>
            <span className="text-sm md:text-base text-slate-200 font-medium">{formattedLine}</span>
          </div>
        );
      }

      return (
        <p key={idx} className="text-sm md:text-base text-slate-200 font-medium leading-relaxed my-1.5">
          {formattedLine}
        </p>
      );
    });
  };

  return (
    <div className="space-y-3 font-sans">
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return <div key={index}>{renderFormattedText(part.value)}</div>;
        }

        if (part.type === 'code') {
          return (
            <div key={index} className="my-3 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-lg">
              {/* Code Block Header */}
              <div className="bg-slate-900 px-3.5 py-2 border-b border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-xs text-blue-400 font-mono">
                  <Code className="w-3.5 h-3.5" />
                  <span className="font-semibold uppercase tracking-wider text-[10px]">SQL QUERY</span>
                </div>
                <button
                  onClick={() => handleCopy(part.value, part.id)}
                  className="flex items-center space-x-1 text-[11px] text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded transition"
                >
                  {copiedCode === part.id ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400 font-semibold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>

              {/* Code Editor Content */}
              <pre className="p-4 text-xs font-mono text-cyan-300 bg-slate-950 overflow-x-auto leading-relaxed">
                <code>{part.value}</code>
              </pre>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
