import React from 'react';

/**
 * Custom, original copyright-free logo component for DataMind
 */
export default function Logo({
  iconSize = "w-7 h-7",
  textSize = "text-lg font-extrabold text-white tracking-tight",
  showText = true,
  onClick
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center space-x-2.5 select-none ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className={`${iconSize} rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-indigo-400 p-[1.5px] shadow-md flex items-center justify-center shrink-0`}>
        <div className="w-full h-full bg-[#18181b] rounded-[10.5px] flex items-center justify-center">
          <svg
            className="w-4 h-4 text-indigo-300"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Custom geometric DataMind node matrix icon */}
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          </svg>
        </div>
      </div>
      {showText && <span className={textSize}>DataMind</span>}
    </div>
  );
}
