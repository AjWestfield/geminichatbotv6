import { format, isToday, isYesterday, differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns';

/**
 * Format a date for chat sidebar display
 * Shows relative time for recent chats, absolute time for older ones
 */
export function formatChatDate(date: Date | string): string {
  const chatDate = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  
  // For very recent times (less than an hour)
  const minutesAgo = differenceInMinutes(now, chatDate);
  if (minutesAgo < 1) {
    return 'Just now';
  }
  if (minutesAgo < 60) {
    return `${minutesAgo}m ago`;
  }
  
  // For times today (less than 24 hours)
  const hoursAgo = differenceInHours(now, chatDate);
  if (hoursAgo < 24 && isToday(chatDate)) {
    if (hoursAgo < 2) {
      return '1h ago';
    }
    return `${hoursAgo}h ago`;
  }
  
  // Yesterday
  if (isYesterday(chatDate)) {
    return 'Yesterday';
  }
  
  // Within the last week
  const daysAgo = differenceInDays(now, chatDate);
  if (daysAgo < 7) {
    return format(chatDate, 'EEEE'); // Monday, Tuesday, etc.
  }
  
  // Within the last month
  if (daysAgo < 30) {
    return format(chatDate, 'MMM d'); // Jan 5, Feb 12, etc.
  }
  
  // Older than a month
  return format(chatDate, 'MMM d, yyyy'); // Jan 5, 2024
}

/**
 * Format message count for display
 * Makes it clear these are user messages
 */
export function formatMessageCount(count: number): string {
  if (count === 0) return 'No messages';
  if (count === 1) return '1 message';
  return `${count} messages`;
}
