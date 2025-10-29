import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiHelpers, endpoints } from '../api/axios';
import LoadingSpinner from '../components/LoadingSpinner';

const Loans = () => {
  const [loans, setLoans] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0
  });

  // Form state for adding new loan
  const [newLoan, setNewLoan] = useState({
    customer_id: '',
    loan_type: 'personal',
    principal_amount: '',
    interest_rate: '',
    tenure_months: '',
    purpose: '',
    guarantor_name: '',
    guarantor_contact: '',
    guarantor_address: ''
  });

  // Fetch loans
  const fetchLoans = async (search = '', offset = 0) => {
    try {
      setLoading(true);
      const params = {
        search,
        limit: pagination.limit,
        offset
      };
      
      const response = await apiHelpers.get(endpoints.loans.list, params);
      
      if (response.success) {
        setLoans(response.loans);
        setPagination(prev => ({
          ...prev,
          total: response.total,
          offset: response.offset
        }));
      } else {
        toast.error('Failed to fetch loans');
      }
    } catch (error) {
      console.error('Error fetching loans:', error);
      toast.error('Failed to fetch loans');
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
      fetchLoans(value, 0);
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewLoan(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Calculate EMI
  const calculateEMI = (principal, rate, tenure) => {
    const monthlyRate = rate / 100 / 12;
    const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenure)) / 
                (Math.pow(1 + monthlyRate, tenure) - 1);
    return isNaN(emi) ? 0 : emi;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await apiHelpers.post(endpoints.loans.create, newLoan);
      
      if (response.success) {
        toast.success('Loan created successfully');
        setShowAddModal(false);
        setNewLoan({
          customer_id: '',
          loan_type: 'personal',
          principal_amount: '',
          interest_rate: '',
          tenure_months: '',
          purpose: '',
          guarantor_name: '',
          guarantor_contact: '',
          guarantor_address: ''
        });
        fetchLoans(searchTerm, pagination.offset);
      } else {
        toast.error(response.error || 'Failed to create loan');
      }
    } catch (error) {
      console.error('Error creating loan:', error);
      toast.error('Failed to create loan');
    }
  };

  // Handle pagination
  const handlePrevPage = () => {
    const newOffset = Math.max(0, pagination.offset - pagination.limit);
    fetchLoans(searchTerm, newOffset);
  };

  const handleNextPage = () => {
    const newOffset = pagination.offset + pagination.limit;
    if (newOffset < pagination.total) {
      fetchLoans(searchTerm, newOffset);
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchLoans();
    fetchCustomers();
  }, []);

  // Get status badge color
  const getStatusBadge = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
      defaulted: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    };
    return colors[status] || colors.pending;
  };

  if (loading && loans.length === 0) {
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
              Loan Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage customer loans and EMI payments
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create Loan
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
                placeholder="Search loans by customer name, loan number, or phone..."
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

      {/* Loans Table */}
      <div className="clay-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Loan Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Amount & EMI
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Progress
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {loans.map((loan) => (
                <tr key={loan.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {loan.loan_number}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {loan.loan_type?.charAt(0).toUpperCase() + loan.loan_type?.slice(1)} Loan
                      </div>
                      <div className="text-xs text-gray-400">
                        {loan.tenure_months} months @ {loan.interest_rate}%
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {loan.customer_name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {loan.customer_phone}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      ₹{loan.principal_amount?.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      EMI: ₹{loan.emi_amount?.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-400">
                      Outstanding: ₹{loan.outstanding_amount?.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(loan.status)}`}>
                      {loan.status?.charAt(0).toUpperCase() + loan.status?.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {loan.paid_emis}/{loan.tenure_months} EMIs
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                      <div 
                        className="bg-primary-600 h-2 rounded-full" 
                        style={{ width: `${(loan.paid_emis / loan.tenure_months) * 100}%` }}
                      ></div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 mr-4">
                      Pay EMI
                    </button>
                    <button className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loans.length === 0 && !loading && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v2a2 2 0 002 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No loans found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {searchTerm ? 'Try adjusting your search terms.' : 'Get started by creating a new loan.'}
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

      {/* Add Loan Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Create New Loan
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
                      value={newLoan.customer_id}
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
                      Loan Type *
                    </label>
                    <select
                      name="loan_type"
                      value={newLoan.loan_type}
                      onChange={handleInputChange}
                      required
                      className="input-field"
                    >
                      <option value="personal">Personal Loan</option>
                      <option value="business">Business Loan</option>
                      <option value="home">Home Loan</option>
                      <option value="vehicle">Vehicle Loan</option>
                      <option value="education">Education Loan</option>
                      <option value="gold">Gold Loan</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Principal Amount *
                    </label>
                    <input
                      type="number"
                      name="principal_amount"
                      value={newLoan.principal_amount}
                      onChange={handleInputChange}
                      required
                      min="1000"
                      step="100"
                      className="input-field"
                      placeholder="Enter loan amount"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Interest Rate (% per annum) *
                    </label>
                    <input
                      type="number"
                      name="interest_rate"
                      value={newLoan.interest_rate}
                      onChange={handleInputChange}
                      required
                      min="1"
                      max="50"
                      step="0.1"
                      className="input-field"
                      placeholder="Enter interest rate"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tenure (Months) *
                    </label>
                    <input
                      type="number"
                      name="tenure_months"
                      value={newLoan.tenure_months}
                      onChange={handleInputChange}
                      required
                      min="1"
                      max="360"
                      className="input-field"
                      placeholder="Enter tenure in months"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      EMI Amount (Calculated)
                    </label>
                    <input
                      type="text"
                      value={`₹${calculateEMI(
                        parseFloat(newLoan.principal_amount) || 0,
                        parseFloat(newLoan.interest_rate) || 0,
                        parseInt(newLoan.tenure_months) || 0
                      ).toLocaleString()}`}
                      readOnly
                      className="input-field bg-gray-50 dark:bg-gray-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Purpose of Loan
                  </label>
                  <textarea
                    name="purpose"
                    value={newLoan.purpose}
                    onChange={handleInputChange}
                    rows={2}
                    className="input-field"
                    placeholder="Enter purpose of loan"
                  />
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">
                    Guarantor Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Guarantor Name
                      </label>
                      <input
                        type="text"
                        name="guarantor_name"
                        value={newLoan.guarantor_name}
                        onChange={handleInputChange}
                        className="input-field"
                        placeholder="Enter guarantor name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Guarantor Contact
                      </label>
                      <input
                        type="tel"
                        name="guarantor_contact"
                        value={newLoan.guarantor_contact}
                        onChange={handleInputChange}
                        pattern="[6-9][0-9]{9}"
                        className="input-field"
                        placeholder="10-digit mobile number"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Guarantor Address
                    </label>
                    <textarea
                      name="guarantor_address"
                      value={newLoan.guarantor_address}
                      onChange={handleInputChange}
                      rows={2}
                      className="input-field"
                      placeholder="Enter guarantor address"
                    />
                  </div>
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
                    Create Loan
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

export default Loans;
