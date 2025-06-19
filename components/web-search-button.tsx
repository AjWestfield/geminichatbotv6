import React from 'react';

interface WebSearchButtonProps {
  onClick: () => void;
  isSearching: boolean;
}

export function WebSearchButton({ onClick, isSearching }: WebSearchButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isSearching}
      className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors"
      title={isSearching ? "Searching..." : "Search the web for current information"}
    >
      {isSearching ? (
        <span className="flex items-center gap-1">
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Searching...
        </span>
      ) : (
        <span className="flex items-center gap-1">
          🌐 Search Web
        </span>
      )}
    </button>
  );
}
