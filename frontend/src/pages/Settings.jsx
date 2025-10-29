import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { apiHelpers, endpoints } from '../api/axios';
import LoadingSpinner from '../components/LoadingSpinner';

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  
  // Settings state
  const [settings, setSettings] = useState({
    // General settings
    company_name: '',
    company_address: '',
    company_phone: '',
    company_email: '',
    company_website: '',
    
    // Interest rates
    savings_interest_rate: '',
    current_interest_rate: '',
    fd_interest_rate: '',
    rd_interest_rate: '',
    loan_interest_rate: '',
    
    // Fees and charges
    account_opening_fee: '',
    minimum_balance_fee: '',
    transaction_fee: '',
    loan_processing_fee: '',
    
    // Email settings
    smtp_host: '',
    smtp_port: '',
    smtp_username: '',
    smtp_password: '',
    smtp_encryption: 'tls',
    
    // System settings
    backup_frequency: 'daily',
    session_timeout: '30',
    max_login_attempts: '3',
    password_expiry_days: '90'
  });

  // Fetch current settings
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await apiHelpers.get(endpoints.settings.get);
      
      if (response.success) {
        setSettings(prev => ({
          ...prev,
          ...response.settings
        }));
      } else {
        toast.error('Failed to fetch settings');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Save settings
  const handleSave = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      const response = await apiHelpers.post(endpoints.settings.update, settings);
      
      if (response.success) {
        toast.success('Settings saved successfully');
      } else {
        toast.error(response.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Test email configuration
  const testEmailConfig = async () => {
    try {
      const response = await apiHelpers.post(endpoints.settings.test, {
        type: 'email'
      });
      
      if (response.success) {
        toast.success('Email configuration test successful');
      } else {
        toast.error(response.error || 'Email configuration test failed');
      }
    } catch (error) {
      console.error('Error testing email config:', error);
      toast.error('Email configuration test failed');
    }
  };

  // Create backup
  const createBackup = async () => {
    try {
      const response = await apiHelpers.post(endpoints.settings.backup);
      
      if (response.success) {
        toast.success('Backup created successfully');
      } else {
        toast.error(response.error || 'Failed to create backup');
      }
    } catch (error) {
      console.error('Error creating backup:', error);
      toast.error('Failed to create backup');
    }
  };

  // Load settings on component mount
  useEffect(() => {
    fetchSettings();
  }, []);

  const tabs = [
    { id: 'general', name: 'General', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
    { id: 'rates', name: 'Interest Rates', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1' },
    { id: 'fees', name: 'Fees & Charges', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v2a2 2 0 002 2z' },
    { id: 'email', name: 'Email', icon: 'M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    { id: 'system', name: 'System', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="clay-card-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              System Settings
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Configure system preferences and parameters
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={createBackup}
              className="btn-secondary"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              Create Backup
            </button>
          </div>
        </div>
      </div>

      <div className="clay-card overflow-hidden">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <form onSubmit={handleSave} className="p-6">
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                  Company Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Company Name
                    </label>
                    <input
                      type="text"
                      name="company_name"
                      value={settings.company_name}
                      onChange={handleInputChange}
                      className="input-field"
                      placeholder="Enter company name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      name="company_phone"
                      value={settings.company_phone}
                      onChange={handleInputChange}
                      className="input-field"
                      placeholder="Enter phone number"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      name="company_email"
                      value={settings.company_email}
                      onChange={handleInputChange}
                      className="input-field"
                      placeholder="Enter email address"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Website
                    </label>
                    <input
                      type="url"
                      name="company_website"
                      value={settings.company_website}
                      onChange={handleInputChange}
                      className="input-field"
                      placeholder="Enter website URL"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Address
                  </label>
                  <textarea
                    name="company_address"
                    value={settings.company_address}
                    onChange={handleInputChange}
                    rows={3}
                    className="input-field"
                    placeholder="Enter complete address"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Interest Rates */}
          {activeTab === 'rates' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                  Default Interest Rates (% per annum)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Savings Account
                    </label>
                    <input
                      type="number"
                      name="savings_interest_rate"
                      value={settings.savings_interest_rate}
                      onChange={handleInputChange}
                      step="0.1"
                      min="0"
                      max="15"
                      className="input-field"
                      placeholder="4.0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Current Account
                    </label>
                    <input
                      type="number"
                      name="current_interest_rate"
                      value={settings.current_interest_rate}
                      onChange={handleInputChange}
                      step="0.1"
                      min="0"
                      max="15"
                      className="input-field"
                      placeholder="3.5"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Fixed Deposit
                    </label>
                    <input
                      type="number"
                      name="fd_interest_rate"
                      value={settings.fd_interest_rate}
                      onChange={handleInputChange}
                      step="0.1"
                      min="0"
                      max="15"
                      className="input-field"
                      placeholder="6.5"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Recurring Deposit
                    </label>
                    <input
                      type="number"
                      name="rd_interest_rate"
                      value={settings.rd_interest_rate}
                      onChange={handleInputChange}
                      step="0.1"
                      min="0"
                      max="15"
                      className="input-field"
                      placeholder="6.0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Loan Interest
                    </label>
                    <input
                      type="number"
                      name="loan_interest_rate"
                      value={settings.loan_interest_rate}
                      onChange={handleInputChange}
                      step="0.1"
                      min="0"
                      max="50"
                      className="input-field"
                      placeholder="12.0"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Fees & Charges */}
          {activeTab === 'fees' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                  Default Fees & Charges (₹)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Account Opening Fee
                    </label>
                    <input
                      type="number"
                      name="account_opening_fee"
                      value={settings.account_opening_fee}
                      onChange={handleInputChange}
                      min="0"
                      step="10"
                      className="input-field"
                      placeholder="500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Minimum Balance Fee
                    </label>
                    <input
                      type="number"
                      name="minimum_balance_fee"
                      value={settings.minimum_balance_fee}
                      onChange={handleInputChange}
                      min="0"
                      step="10"
                      className="input-field"
                      placeholder="100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Transaction Fee
                    </label>
                    <input
                      type="number"
                      name="transaction_fee"
                      value={settings.transaction_fee}
                      onChange={handleInputChange}
                      min="0"
                      step="1"
                      className="input-field"
                      placeholder="10"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Loan Processing Fee (%)
                    </label>
                    <input
                      type="number"
                      name="loan_processing_fee"
                      value={settings.loan_processing_fee}
                      onChange={handleInputChange}
                      min="0"
                      max="10"
                      step="0.1"
                      className="input-field"
                      placeholder="2.0"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Email Settings */}
          {activeTab === 'email' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    SMTP Configuration
                  </h3>
                  <button
                    type="button"
                    onClick={testEmailConfig}
                    className="btn-secondary"
                  >
                    Test Configuration
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      SMTP Host
                    </label>
                    <input
                      type="text"
                      name="smtp_host"
                      value={settings.smtp_host}
                      onChange={handleInputChange}
                      className="input-field"
                      placeholder="smtp.gmail.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      SMTP Port
                    </label>
                    <input
                      type="number"
                      name="smtp_port"
                      value={settings.smtp_port}
                      onChange={handleInputChange}
                      className="input-field"
                      placeholder="587"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      name="smtp_username"
                      value={settings.smtp_username}
                      onChange={handleInputChange}
                      className="input-field"
                      placeholder="your-email@gmail.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      name="smtp_password"
                      value={settings.smtp_password}
                      onChange={handleInputChange}
                      className="input-field"
                      placeholder="Enter password"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Encryption
                    </label>
                    <select
                      name="smtp_encryption"
                      value={settings.smtp_encryption}
                      onChange={handleInputChange}
                      className="input-field"
                    >
                      <option value="tls">TLS</option>
                      <option value="ssl">SSL</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* System Settings */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                  System Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Backup Frequency
                    </label>
                    <select
                      name="backup_frequency"
                      value={settings.backup_frequency}
                      onChange={handleInputChange}
                      className="input-field"
                    >
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Session Timeout (minutes)
                    </label>
                    <input
                      type="number"
                      name="session_timeout"
                      value={settings.session_timeout}
                      onChange={handleInputChange}
                      min="5"
                      max="480"
                      className="input-field"
                      placeholder="30"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Max Login Attempts
                    </label>
                    <input
                      type="number"
                      name="max_login_attempts"
                      value={settings.max_login_attempts}
                      onChange={handleInputChange}
                      min="1"
                      max="10"
                      className="input-field"
                      placeholder="3"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Password Expiry (days)
                    </label>
                    <input
                      type="number"
                      name="password_expiry_days"
                      value={settings.password_expiry_days}
                      onChange={handleInputChange}
                      min="30"
                      max="365"
                      className="input-field"
                      placeholder="90"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
            >
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;
