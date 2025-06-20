// Utility functions for consistent date and time handling

// Format date for datetime-local input (handles timezone conversion)
export const formatDateTimeLocal = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  // Get timezone offset in minutes and convert to milliseconds
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  // Create a new date adjusted for timezone
  const localDate = new Date(date.getTime() - timezoneOffset);
  // Return in the format expected by datetime-local input
  return localDate.toISOString().slice(0, 16);
};

// Format date for display in German locale
export const formatDateTimeDisplay = (dateString, options = {}) => {
  if (!dateString) return 'Ungültiges Datum';
  
  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Ungültiges Datum';
    }
    
    const defaultOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Berlin', // German timezone
      ...options
    };
    
    return date.toLocaleString('de-DE', defaultOptions);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Ungültiges Datum';
  }
};

// Format date only (without time)
export const formatDateOnly = (dateString) => {
  return formatDateTimeDisplay(dateString, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

// Format time only
export const formatTimeOnly = (dateString) => {
  return formatDateTimeDisplay(dateString, {
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Check if date is valid
export const isValidDate = (dateString) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime());
};

// Get timezone-aware current date for datetime-local input
export const getCurrentDateTimeLocal = () => {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60000;
  const localDate = new Date(now.getTime() - timezoneOffset);
  return localDate.toISOString().slice(0, 16);
};

// Convert datetime-local input value to UTC for API
export const convertLocalToUTC = (localDateTimeString) => {
  if (!localDateTimeString) return null;
  // datetime-local input gives us local time, convert to UTC for API
  const localDate = new Date(localDateTimeString);
  return localDate.toISOString();
}; 