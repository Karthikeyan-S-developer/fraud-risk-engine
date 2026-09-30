// Centralized API configuration supporting local development and AWS Cloud Deployment
export const API_BASE_URL = 
  import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : 'http://13.126.41.84:8000');
