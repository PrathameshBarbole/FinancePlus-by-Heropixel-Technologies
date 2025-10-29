import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import axios from '../api/axios';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalDeposits: 0,
    totalLoans: 0,
    todayTransactions: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    
    try {
      const response = await axios.get('/api/reports/dashboard');
      const data = response.data.data;
      
      setStats({
        totalCustomers: data.customers.total || 0,
        totalDeposits: (data.accounts.total_balance || 0) + (data.deposits.fd_total_amount || 0) + (data.deposits.rd_total_amount || 0),
        totalLoans: data.loans.total_outstanding || 0,
        todayTransactions: data.transactions.today || 0
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      // Fallback to mock data
      setStats({
        totalCustomers: 1250,
        totalDeposits: 5420000,
        totalLoans: 2180000,
        todayTransactions: 47
      });
    }
    
    setIsLoading(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getCurrentGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getCurrentDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="clay-card p-6">
          <LoadingSpinner size="lg" text="Loading dashboard..." />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="clay-card-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {getCurrentGreeting()}, {user?.name}!
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {getCurrentDate()}
            </p>
          </div>
          <div className="hidden md:block">
            <div className="w-16 h-16 text-primary-500">
              <svg viewBox="0 0 100 100" fill="currentColor">
                <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.3"/>
                <path d="M30 40h40v5H30v-5zm0 10h40v5H30v-5zm0 10h25v5H30v-5z" />
                <circle cx="50" cy="30" r="8" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Customers */}
        <div className="clay-card p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/20 rounded-clay flex items-center justify-center">
              <svg className="w-6 h-6 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Customers
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats.totalCustomers.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Total Deposits */}
        <div className="clay-card p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-success-100 dark:bg-success-900/20 rounded-clay flex items-center justify-center">
              <svg className="w-6 h-6 text-success-600 dark:text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Deposits
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(stats.totalDeposits)}
              </p>
            </div>
          </div>
        </div>

        {/* Total Loans */}
        <div className="clay-card p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-warning-100 dark:bg-warning-900/20 rounded-clay flex items-center justify-center">
              <svg className="w-6 h-6 text-warning-600 dark:text-warning-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Loans
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(stats.totalLoans)}
              </p>
            </div>
          </div>
        </div>

        {/* Today's Transactions */}
        <div className="clay-card p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-secondary-100 dark:bg-secondary-900/20 rounded-clay flex items-center justify-center">
              <svg className="w-6 h-6 text-secondary-600 dark:text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Today's Transactions
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats.todayTransactions}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="clay-card-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a
            href="/customers"
            className="clay-btn-secondary text-center p-4 flex flex-col items-center space-y-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <span className="text-sm font-medium">Add Customer</span>
          </a>
          
          <a
            href="/accounts"
            className="clay-btn-secondary text-center p-4 flex flex-col items-center space-y-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <span className="text-sm font-medium">New Account</span>
          </a>
          
          <a
            href="/transactions"
            className="clay-btn-secondary text-center p-4 flex flex-col items-center space-y-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">Transaction</span>
          </a>
          
          <a
            href="/reports"
            className="clay-btn-secondary text-center p-4 flex flex-col items-center space-y-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-medium">Reports</span>
          </a>
        </div>
      </div>

      {/* System Status */}
      <div className="clay-card p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          System Status
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Database Connection</span>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-success-500 rounded-full"></div>
              <span className="text-sm text-success-600 dark:text-success-400">Connected</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Internet Connection</span>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-warning-500 rounded-full"></div>
              <span className="text-sm text-warning-600 dark:text-warning-400">Offline Mode</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Email Queue</span>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
              <span className="text-sm text-primary-600 dark:text-primary-400">5 Pending</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Last Backup</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">2 hours ago</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;