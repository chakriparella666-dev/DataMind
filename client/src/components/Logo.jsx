import React from 'react';

/**
 * Custom DataMind "D" logo component
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
      <div className={`${iconSize} rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-600 p-[1.5px] shadow-md shadow-indigo-500/20 flex items-center justify-center shrink-0`}>
        <div className="w-full h-full bg-[#111318] rounded-[10.5px] flex items-center justify-center border border-indigo-500/30">
          <svg
            className="w-4 h-4 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Bold Stylized DataMind "D" Emblem */}
            <path
              d="M6 4h6a7 7 0 0 1 7 7v0a7 7 0 0 1-7 7H6V4z"
              fill="url(#d-gradient-fill)"
              stroke="url(#d-gradient-stroke)"
              strokeWidth="2.2"
            />
            <path
              d="M10 8.5h2.2a2.5 2.5 0 0 1 2.5 2.5v0a2.5 2.5 0 0 1-2.5 2.5H10V8.5z"
              fill="#111318"
              stroke="none"
            />
            <circle cx="12.2" cy="11" r="1.2" fill="#818cf8" stroke="none" />
            <defs>
              <linearGradient id="d-gradient-fill" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="d-gradient-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#c084fc" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
      {showText && <span className={textSize}>DataMind</span>}
    </div>
  );
}
