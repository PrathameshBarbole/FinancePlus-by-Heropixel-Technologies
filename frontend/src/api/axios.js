import axios from 'axios';
import toast from 'react-hot-toast';

// Create axios instance
const api = axios.create({
  baseURL: '/api',
  timeout: 30000, // 30 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add request timestamp for debugging
    config.metadata = { startTime: new Date() };
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common responses
api.interceptors.response.use(
  (response) => {
    // Calculate request duration
    const duration = new Date() - response.config.metadata.startTime;
    
    // Log slow requests in development
    if (import.meta.env.DEV && duration > 2000) {
      console.warn(`Slow API request: ${response.config.url} took ${duration}ms`);
    }
    
    // Handle token refresh
    const newToken = response.headers['x-new-token'];
    if (newToken) {
      localStorage.setItem('token', newToken);
      console.log('Token refreshed automatically');
    }
    
    return response;
  },
  (error) => {
    const { response, request, config } = error;
    
    // Calculate request duration if available
    if (config?.metadata?.startTime) {
      const duration = new Date() - config.metadata.startTime;
      console.error(`Failed API request: ${config.url} took ${duration}ms`);
    }
    
    // Handle different error scenarios
    if (response) {
      // Server responded with error status
      const { status, data } = response;
      
      switch (status) {
        case 401:
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          
          // Only show toast if not already on login page
          if (!window.location.pathname.includes('/login')) {
            toast.error('Session expired. Please login again.');
            window.location.href = '/login';
          }
          break;
          
        case 403:
          // Forbidden
          toast.error(data?.message || 'Access denied. Insufficient permissions.');
          break;
          
        case 404:
          // Not found
          toast.error(data?.message || 'Resource not found.');
          break;
          
        case 422:
          // Validation error
          if (data?.errors && Array.isArray(data.errors)) {
            data.errors.forEach(err => toast.error(err));
          } else {
            toast.error(data?.message || 'Validation error occurred.');
          }
          break;
          
        case 429:
          // Rate limit exceeded
          toast.error('Too many requests. Please try again later.');
          break;
          
        case 500:
          // Internal server error
          toast.error('Server error occurred. Please try again.');
          break;
          
        default:
          // Other errors
          toast.error(data?.message || `Request failed with status ${status}`);
      }
    } else if (request) {
      // Network error or no response
      if (error.code === 'ECONNABORTED') {
        toast.error('Request timeout. Please check your connection.');
      } else {
        toast.error('Network error. Please check your internet connection.');
      }
    } else {
      // Request setup error
      toast.error('Request configuration error.');
    }
    
    return Promise.reject(error);
  }
);

// API helper functions
export const apiHelpers = {
  // Generic GET request
  get: async (url, params = {}) => {
    try {
      const response = await api.get(url, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  // Generic POST request
  post: async (url, data = {}) => {
    try {
      const response = await api.post(url, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  // Generic PUT request
  put: async (url, data = {}) => {
    try {
      const response = await api.put(url, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  // Generic DELETE request
  delete: async (url) => {
    try {
      const response = await api.delete(url);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  // Upload file
  upload: async (url, formData, onUploadProgress = null) => {
    try {
      const response = await api.post(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  // Download file
  download: async (url, filename = null) => {
    try {
      const response = await api.get(url, {
        responseType: 'blob',
      });
      
      // Create download link
      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

// Connection status monitoring
export const connectionMonitor = {
  isOnline: navigator.onLine,
  listeners: [],
  
  init() {
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  },
  
  handleOnline() {
    this.isOnline = true;
    toast.success('Connection restored');
    this.notifyListeners('online');
  },
  
  handleOffline() {
    this.isOnline = false;
    toast.error('Connection lost. Working offline.');
    this.notifyListeners('offline');
  },
  
  addListener(callback) {
    this.listeners.push(callback);
  },
  
  removeListener(callback) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  },
  
  notifyListeners(status) {
    this.listeners.forEach(callback => callback(status));
  }
};

// Initialize connection monitoring
connectionMonitor.init();

// API endpoints
export const endpoints = {
  // Authentication
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    profile: '/auth/profile',
    changePassword: '/auth/change-password',
    verify: '/auth/verify',
    refresh: '/auth/refresh',
    stats: '/auth/stats',
  },
  
  // Customers
  customers: {
    list: '/customers',
    create: '/customers',
    get: (id) => `/customers/${id}`,
    update: (id) => `/customers/${id}`,
    delete: (id) => `/customers/${id}`,
    search: '/customers/search',
    searchByAccount: (accountNumber) => `/customers/search/account/${accountNumber}`,
    summary: (id) => `/customers/${id}/summary`,
    stats: '/customers/stats/overview',
    export: '/customers/bulk/export',
  },
  
  // Accounts
  accounts: {
    list: '/accounts',
    create: '/accounts',
    get: (id) => `/accounts/${id}`,
    getByNumber: (accountNumber) => `/accounts/number/${accountNumber}`,
    deposit: (id) => `/accounts/${id}/deposit`,
    withdraw: (id) => `/accounts/${id}/withdraw`,
    transfer: '/accounts/transfer',
    applyInterest: (id) => `/accounts/${id}/apply-interest`,
    transactions: (id) => `/accounts/${id}/transactions`,
    statement: (id) => `/accounts/${id}/statement`,
    delete: (id) => `/accounts/${id}`,
    stats: '/accounts/stats/overview',
    bulkInterest: '/accounts/bulk/apply-interest',
  },
  
  // Fixed Deposits
  fd: {
    list: '/fd',
    create: '/fd',
    get: (id) => `/fd/${id}`,
    getByNumber: (fdNumber) => `/fd/number/${fdNumber}`,
    update: (id) => `/fd/${id}`,
    close: (id) => `/fd/${id}/close`,
    transactions: (id) => `/fd/${id}/transactions`,
    maturityList: '/fd/maturity-list',
    stats: '/fd/stats/overview',
  },
  
  // Recurring Deposits
  rd: {
    list: '/rd',
    create: '/rd',
    get: (id) => `/rd/${id}`,
    getByNumber: (rdNumber) => `/rd/number/${rdNumber}`,
    update: (id) => `/rd/${id}`,
    payInstallment: (id) => `/rd/${id}/pay-installment`,
    close: (id) => `/rd/${id}/close`,
    transactions: (id) => `/rd/${id}/transactions`,
    schedule: (id) => `/rd/${id}/schedule`,
    maturityList: '/rd/maturity-list',
    dueInstallments: '/rd/due-installments',
    stats: '/rd/stats/overview',
  },
  
  // Loans
  loans: {
    list: '/loans',
    create: '/loans',
    get: (id) => `/loans/${id}`,
    getByNumber: (loanNumber) => `/loans/number/${loanNumber}`,
    update: (id) => `/loans/${id}`,
    makePayment: (id) => `/loans/${id}/make-payment`,
    foreclose: (id) => `/loans/${id}/foreclose`,
    transactions: (id) => `/loans/${id}/transactions`,
    schedule: (id) => `/loans/${id}/emi-schedule`,
    dueEmis: '/loans/due-emis',
    stats: '/loans/stats/overview',
  },
  
  // Transactions
  transactions: {
    list: '/transactions',
    get: (id) => `/transactions/${id}`,
    getByTransactionId: (transactionId) => `/transactions/txn/${transactionId}`,
    today: '/transactions/today',
    stats: '/transactions/stats',
    trend: '/transactions/trend',
    byType: '/transactions/by-type',
    customerSummary: (customerId) => `/transactions/customer/${customerId}/summary`,
    search: '/transactions/search',
    volume: '/transactions/volume',
  },
  
  // Reports
  reports: {
    generate: '/reports/generate',
    list: '/reports',
    download: (id) => `/reports/${id}/download`,
    delete: (id) => `/reports/${id}`,
  },
  
  // Employees (Admin only)
  employees: {
    list: '/employees',
    create: '/employees',
    get: (id) => `/employees/${id}`,
    update: (id) => `/employees/${id}`,
    delete: (id) => `/employees/${id}`,
    activate: (id) => `/employees/${id}/activate`,
    deactivate: (id) => `/employees/${id}/deactivate`,
    stats: '/employees/stats',
  },
  
  // Email Queue
  emailQueue: {
    list: '/email-queue',
    get: (id) => `/email-queue/${id}`,
    retry: (id) => `/email-queue/${id}/retry`,
    retryAll: '/email-queue/retry-all',
    delete: (id) => `/email-queue/${id}`,
    bulkDelete: '/email-queue/bulk-delete',
    stats: '/email-queue/stats',
    process: '/email-queue/process',
  },
  
  // Settings (Admin only)
  settings: {
    get: '/settings',
    update: '/settings',
    backup: '/settings/backup',
    restore: '/settings/restore',
    test: '/settings/test',
  },
  
  // Audit Log (Admin only)
  auditLog: {
    list: '/audit-log',
    get: (id) => `/audit-log/${id}`,
    stats: '/audit-log/stats',
    export: '/audit-log/export',
    cleanup: '/audit-log/cleanup',
  },
};

export default api;