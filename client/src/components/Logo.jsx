import React from 'react';

/**
 * Custom DataMind stacked layers logo component matching design spec
 */
export default function Logo({
  iconSize = "w-8 h-8",
  textSize = "text-lg font-black text-white tracking-tight",
  showText = true,
  onClick,
  className = ""
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center space-x-2.5 select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      <div className={`${iconSize} rounded-xl bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-900 p-[1.5px] shadow-lg flex items-center justify-center shrink-0`}>
        <div className="w-full h-full bg-[#121318] rounded-[10.5px] flex items-center justify-center border border-zinc-700/60">
          <svg
            className="w-4 h-4 text-slate-100"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Stacked Data Layers Icon */}
            <path d="M12 3L3 7.5L12 12L21 7.5L12 3Z" />
            <path d="M3 12L12 16.5L21 12" />
            <path d="M3 16.5L12 21L21 16.5" />
            <circle cx="12" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
          </svg>
        </div>
      </div>
      {showText && <span className={textSize}>DataMind</span>}
    </div>
  );
}
