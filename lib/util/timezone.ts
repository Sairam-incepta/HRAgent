// Auto-detect timezone utilities
const getUserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.warn('Could not detect timezone, falling back to America/Los_Angeles');
    return 'America/Los_Angeles';
  }
};

const getLocalTimezoneDate = (date: Date = new Date()): Date => {
  // Create a date in user's detected timezone
  const timezone = getUserTimezone();
  return new Date(date.toLocaleString("en-US", { timeZone: timezone }));
};

export const getLocalDateString = (date: Date = new Date()): string => {
  // Get date string in user's timezone
  const localDate = getLocalTimezoneDate(date);
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getLocalStartOfDay = (date: Date = new Date()): Date => {
  const localDate = getLocalTimezoneDate(date);
  localDate.setHours(0, 0, 0, 0);
  return localDate;
};

export const getLocalEndOfDay = (date: Date = new Date()): Date => {
  const localDate = getLocalTimezoneDate(date);
  localDate.setHours(23, 59, 59, 999);
  return localDate;
};

export const getLocalStartOfWeek = (date: Date = new Date()): Date => {
  const localDate = getLocalTimezoneDate(date);
  const day = localDate.getDay();
  const diff = localDate.getDate() - day; // Sunday is 0
  localDate.setDate(diff);
  localDate.setHours(0, 0, 0, 0);
  return localDate;
};

export const getLocalEndOfWeek = (date: Date = new Date()): Date => {
  const localDate = getLocalTimezoneDate(date);
  const day = localDate.getDay();
  const diff = localDate.getDate() - day + 6; // Saturday is 6
  localDate.setDate(diff);
  localDate.setHours(23, 59, 59, 999);
  return localDate;
};

// Debug utility to log timezone information
export const logTimezoneInfo = () => {
  const now = new Date();
  const localDate = getLocalTimezoneDate(now);
  const userTimezone = getUserTimezone();
  console.log('🌍 Timezone Debug Info:');
  console.log('  Server time:', now.toString());
  console.log('  UTC time:', now.toISOString());
  console.log('  Local time:', localDate.toString());
  console.log('  Local date string:', getLocalDateString(now));
  console.log('  UTC date string:', now.toISOString().split('T')[0]);
  console.log('  Server timezone offset:', now.getTimezoneOffset(), 'minutes');
  console.log('  Detected user timezone:', userTimezone);
};