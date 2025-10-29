import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { apiHelpers, endpoints } from '../api/axios';
import LoadingSpinner from '../components/LoadingSpinner';

const FD = () => {
  const [fds, setFds] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0
  });

  // Form state for adding new FD
  const [newFD, setNewFD] = useState({
    customer_id: '',
    principal_amount: '',
    interest_rate: '',
    tenure_months: '',
    fd_type: 'regular',
    auto_renewal: false,
    nominee_name: '',
    nominee_relation: ''
  });

  // Fetch FDs
  const fetchFDs = async (search = '', offset = 0) => {
    try {
      setLoading(true);
      const params = {
        search,
        limit: pagination.limit,
        offset
      };
      
      const response = await apiHelpers.get(endpoints.fd.list, params);
      
      if (response.success) {
        setFds(response.fds);
        setPagination(prev => ({
          ...prev,
          total: response.total,
          offset: response.offset
        }));
      } else {
        toast.error('Failed to fetch FDs');
      }
    } catch (error) {
      console.error('Error fetching FDs:', error);
      toast.error('Failed to fetch FDs');
    } finally {
      setLoading(false);
    }
  };

  // Fetch customers for dropdown
  const fetchCustomers = async () => {
    try {
      const response = await apiHelpers.get(endpoints.customers.list, { limit: 1000 });
      if (response.success) {
        setCustomers(response.customers);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  // Handle search
  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    // Debounce search
    const timeoutId = setTimeout(() => {
      fetchFDs(value, 0);
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewFD(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Calculate maturity amount
  const calculateMaturityAmount = (principal, rate, tenure) => {
    const maturityAmount = principal * Math.pow(1 + (rate / 100 / 4), (tenure / 3)); // Quarterly compounding
    return isNaN(maturityAmount) ? 0 : maturityAmount;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await apiHelpers.post(endpoints.fd.create, newFD);
      
      if (response.success) {
        toast.success('Fixed Deposit created successfully');
        setShowAddModal(false);
        setNewFD({
          customer_id: '',
          principal_amount: '',
          interest_rate: '',
          tenure_months: '',
          fd_type: 'regular',
          auto_renewal: false,
          nominee_name: '',
          nominee_relation: ''
        });
        fetchFDs(searchTerm, pagination.offset);
      } else {
        toast.error(response.error || 'Failed to create FD');
      }
    } catch (error) {
      console.error('Error creating FD:', error);
      toast.error('Failed to create FD');
    }
  };

  // Handle pagination
  const handlePrevPage = () => {
    const newOffset = Math.max(0, pagination.offset - pagination.limit);
    fetchFDs(searchTerm, newOffset);
  };

  const handleNextPage = () => {
    const newOffset = pagination.offset + pagination.limit;
    if (newOffset < pagination.total) {
      fetchFDs(searchTerm, newOffset);
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchFDs();
    fetchCustomers();
  }, []);

  // Get status badge color
  const getStatusBadge = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      matured: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
      premature: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    };
    return colors[status] || colors.active;
  };

  // Calculate days to maturity
  const getDaysToMaturity = (maturityDate) => {
    const today = new Date();
    const maturity = new Date(maturityDate);
    const diffTime = maturity - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading && fds.length === 0) {
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
              Fixed Deposits (FD)
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage customer fixed deposits and maturity tracking
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create FD
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="clay-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search FDs by customer name, FD number, or phone..."
                value={searchTerm}
                onChange={handleSearch}
                className="input-field pl-10 w-full"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* FDs Table */}
      <div className="clay-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  FD Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Amount & Interest
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Maturity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {fds.map((fd) => (
                <tr key={fd.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {fd.fd_number}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {fd.fd_type?.charAt(0).toUpperCase() + fd.fd_type?.slice(1)} FD
                      </div>
                      <div className="text-xs text-gray-400">
                        {fd.tenure_months} months @ {fd.interest_rate}%
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {fd.customer_name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {fd.customer_phone}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      ₹{fd.principal_amount?.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Maturity: ₹{fd.maturity_amount?.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-400">
                      Interest: ₹{(fd.maturity_amount - fd.principal_amount)?.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {new Date(fd.maturity_date).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {getDaysToMaturity(fd.maturity_date) > 0 
                        ? `${getDaysToMaturity(fd.maturity_date)} days left`
                        : 'Matured'
                      }
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(fd.status)}`}>
                      {fd.status?.charAt(0).toUpperCase() + fd.status?.slice(1)}
                    </span>
                    {fd.auto_renewal && (
                      <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        Auto-renewal
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {fd.status === 'matured' && (
                      <button className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 mr-4">
                        Close FD
                      </button>
                    )}
                    <button className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {fds.length === 0 && !loading && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No FDs found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {searchTerm ? 'Try adjusting your search terms.' : 'Get started by creating a new Fixed Deposit.'}
            </p>
          </div>
        )}

        {/* Pagination */}
        {pagination.total > pagination.limit && (
          <div className="bg-white dark:bg-gray-900 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={handlePrevPage}
                disabled={pagination.offset === 0}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={handleNextPage}
                disabled={pagination.offset + pagination.limit >= pagination.total}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Showing <span className="font-medium">{pagination.offset + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(pagination.offset + pagination.limit, pagination.total)}
                  </span>{' '}
                  of <span className="font-medium">{pagination.total}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={handlePrevPage}
                    disabled={pagination.offset === 0}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button
                    onClick={handleNextPage}
                    disabled={pagination.offset + pagination.limit >= pagination.total}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add FD Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Create New Fixed Deposit
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Customer *
                    </label>
                    <select
                      name="customer_id"
                      value={newFD.customer_id}
                      onChange={handleInputChange}
                      required
                      className="input-field"
                    >
                      <option value="">Select Customer</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} - {customer.phone}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      FD Type *
                    </label>
                    <select
                      name="fd_type"
                      value={newFD.fd_type}
                      onChange={handleInputChange}
                      required
                      className="input-field"
                    >
                      <option value="regular">Regular FD</option>
                      <option value="senior_citizen">Senior Citizen FD</option>
                      <option value="tax_saver">Tax Saver FD</option>
                      <option value="flexi">Flexi FD</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Principal Amount *
                    </label>
                    <input
                      type="number"
                      name="principal_amount"
                      value={newFD.principal_amount}
                      onChange={handleInputChange}
                      required
                      min="1000"
                      step="100"
                      className="input-field"
                      placeholder="Enter deposit amount"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Interest Rate (% per annum) *
                    </label>
                    <input
                      type="number"
                      name="interest_rate"
                      value={newFD.interest_rate}
                      onChange={handleInputChange}
                      required
                      min="1"
                      max="15"
                      step="0.1"
                      className="input-field"
                      placeholder="Enter interest rate"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tenure (Months) *
                    </label>
                    <select
                      name="tenure_months"
                      value={newFD.tenure_months}
                      onChange={handleInputChange}
                      required
                      className="input-field"
                    >
                      <option value="">Select Tenure</option>
                      <option value="6">6 Months</option>
                      <option value="12">1 Year</option>
                      <option value="18">18 Months</option>
                      <option value="24">2 Years</option>
                      <option value="36">3 Years</option>
                      <option value="60">5 Years</option>
                      <option value="120">10 Years</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Maturity Amount (Calculated)
                    </label>
                    <input
                      type="text"
                      value={`₹${calculateMaturityAmount(
                        parseFloat(newFD.principal_amount) || 0,
                        parseFloat(newFD.interest_rate) || 0,
                        parseInt(newFD.tenure_months) || 0
                      ).toLocaleString()}`}
                      readOnly
                      className="input-field bg-gray-50 dark:bg-gray-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nominee Name
                    </label>
                    <input
                      type="text"
                      name="nominee_name"
                      value={newFD.nominee_name}
                      onChange={handleInputChange}
                      className="input-field"
                      placeholder="Enter nominee name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nominee Relation
                    </label>
                    <select
                      name="nominee_relation"
                      value={newFD.nominee_relation}
                      onChange={handleInputChange}
                      className="input-field"
                    >
                      <option value="">Select relation</option>
                      <option value="spouse">Spouse</option>
                      <option value="son">Son</option>
                      <option value="daughter">Daughter</option>
                      <option value="father">Father</option>
                      <option value="mother">Mother</option>
                      <option value="brother">Brother</option>
                      <option value="sister">Sister</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="auto_renewal"
                    checked={newFD.auto_renewal}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                    Enable auto-renewal on maturity
                  </label>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                  >
                    Create FD
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FD;
