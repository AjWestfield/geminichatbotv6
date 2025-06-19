import React from 'react';
import { cn } from '@/lib/utils';

interface TableData {
  headers: string[];
  rows: string[][];
}

interface EnhancedTableProps {
  data: TableData;
  className?: string;
}

export function EnhancedTable({ data, className }: EnhancedTableProps) {
  if (!data || !data.headers || !data.rows || data.rows.length === 0) {
    return null;
  }

  return (
    <div className={cn("my-4 w-full", className)}>
      <div className="rounded-lg border border-gray-700 dark:border-gray-700 bg-gray-900/50 dark:bg-gray-900/50 backdrop-blur-sm">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700 dark:border-gray-700 bg-gray-800/50 dark:bg-gray-800/50">
                {data.headers.map((header, index) => (
                  <th
                    key={index}
                    className={cn(
                      "px-3 py-2 text-left text-xs sm:text-sm font-medium text-gray-300 dark:text-gray-300 whitespace-normal",
                      index === 0 ? "min-w-[100px] sm:min-w-[140px]" : "min-w-[120px] sm:min-w-[180px]"
                    )}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={cn(
                    "border-b border-gray-800 dark:border-gray-800 transition-colors",
                    "hover:bg-gray-800/30 dark:hover:bg-gray-800/30",
                    rowIndex === data.rows.length - 1 && "border-b-0"
                  )}
                >
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={cn(
                        "px-3 py-2.5 text-xs sm:text-sm",
                        cellIndex === 0 
                          ? "font-medium text-gray-200 dark:text-gray-200" 
                          : "text-gray-300 dark:text-gray-300"
                      )}
                    >
                      <div className="break-words">
                        {cell}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Helper function to parse table from markdown
export function parseTableFromMarkdown(content: string): TableData | null {
  // Look for table in markdown format
  const tableMatch = content.match(/\|(.+)\|[\s\S]*?\n\|[-:\s|]+\|[\s\S]*?\n((?:\|.+\|\n?)+)/);
  
  if (!tableMatch) {
    // Also try to match tables that might have extra formatting
    const altTableMatch = content.match(/#+\s*Summary Table[\s\S]*?\n\n((?:\|.+\|\n?)+)/i);
    if (!altTableMatch) return null;
    
    const lines = altTableMatch[1].trim().split('\n').filter(line => line.includes('|'));
    if (lines.length < 3) return null; // Need at least header, separator, and one row
    
    const headers = lines[0].split('|').filter(cell => cell.trim()).map(cell => cell.trim());
    const rows = lines.slice(2).map(line => 
      line.split('|').filter(cell => cell.trim()).map(cell => cell.trim())
    );
    
    return { headers, rows };
  }
  
  const lines = tableMatch[0].trim().split('\n');
  if (lines.length < 3) return null;
  
  // Parse headers
  const headers = lines[0].split('|').filter(cell => cell.trim()).map(cell => cell.trim());
  
  // Skip separator line and parse rows
  const rows = lines.slice(2).map(line => 
    line.split('|').filter(cell => cell.trim()).map(cell => cell.trim())
  );
  
  return { headers, rows };
}
