import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8100/api';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds (increased from 10s for better reliability)
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // For HttpOnly cookies
});

// Request interceptor - attach JWT token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    console.log('Token from localStorage:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('Authorization header set');
    } else {
      console.log('No token found in localStorage');
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors globally
axiosInstance.interceptors.response.use(
  (response) => {
    console.log('Response interceptor:', {
      url: response.config.url,
      status: response.status,
      hasSuccess: response.data?.success !== undefined,
      hasTokens: response.data?.tokens !== undefined,
      data: response.data
    });
    
    // Unwrap backend response format: {success, message, data}
    if (response.data && response.data.success && response.data.data !== undefined) {
      // Return unwrapped data so callers can use response.data directly
      return { ...response, data: response.data.data };
    }
    return response;
  },
  (error) => {
    const { response } = error;

    if (response) {
      switch (response.status) {
        case 401:
          // Unauthorized - only clear auth if on a protected route
          // Don't auto-clear on first 401, let the app handle it
          console.warn('401 Unauthorized:', response.config.url);
          console.warn('Current token exists:', !!localStorage.getItem('accessToken'));
          
          // Only redirect if we're not already on the login page
          // and the request was to an auth-required endpoint
          if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
            // Don't immediately clear - this could be a race condition
            // Let the user's session naturally expire
            console.warn('401 on protected route, but not clearing token yet');
          }
          break;
        case 403:
          // Forbidden - redirect to unauthorized page
          console.error('Access forbidden:', response.data?.error?.message || response.data?.message);
          break;
        case 404:
          console.error('Resource not found:', response.data?.error?.message || response.data?.message);
          break;
        case 500:
          console.error('Server error:', response.data?.error?.message || response.data?.message);
          break;
        default:
          console.error('API error:', response.data?.error?.message || response.data?.message);
      }
    } else if (error.request) {
      // Network error
      console.error('Network error - no response received');
    } else {
      console.error('Error:', error.message);
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
