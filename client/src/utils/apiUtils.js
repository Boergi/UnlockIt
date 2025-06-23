// API and URL configuration utilities

// Get the base URL for API calls
export const getApiBaseUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    // In production, use relative URLs (same domain)
    return '';
  }
  // In development, use the proxy or explicit localhost
  return process.env.REACT_APP_API_URL || '';
};

// Get the full frontend URL (for links, etc.)
export const getFrontendUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.REACT_APP_FRONTEND_URL || window.location.origin;
  }
  return process.env.REACT_APP_FRONTEND_URL || 'http://localhost:3000';
};

// Get the full backend URL (for images, uploads, etc.)
export const getBackendUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.REACT_APP_BACKEND_URL || window.location.origin;
  }
  return process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
};

// Helper to build image URLs
export const getImageUrl = (imagePath) => {
  if (!imagePath) return '';
  if (imagePath.startsWith('http')) return imagePath; // Already absolute URL
  return `${getBackendUrl()}${imagePath}`;
};

// Helper to build frontend URLs
export const buildFrontendUrl = (path) => {
  return `${getFrontendUrl()}${path}`;
}; 