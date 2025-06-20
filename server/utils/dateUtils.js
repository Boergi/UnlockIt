// Backend utility functions for date handling

// Convert ISO date string to MySQL DATETIME format
const formatDateForMySQL = (isoDateString) => {
  if (!isoDateString) return null;
  
  try {
    const date = new Date(isoDateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }
    
    // Format as YYYY-MM-DD HH:MM:SS (MySQL DATETIME format)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.error('Error formatting date for MySQL:', error);
    return null;
  }
};

// Convert MySQL DATETIME to ISO string
const formatDateFromMySQL = (mysqlDateString) => {
  if (!mysqlDateString) return null;
  
  try {
    const date = new Date(mysqlDateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }
    
    return date.toISOString();
  } catch (error) {
    console.error('Error formatting date from MySQL:', error);
    return null;
  }
};

module.exports = {
  formatDateForMySQL,
  formatDateFromMySQL
}; 