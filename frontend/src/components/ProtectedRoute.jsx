import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

const ProtectedRoute = ({ children, requiredRole = null }) => {
  const { isAuthenticated, isLoading, user, hasRole } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="clay-card p-8 text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Verifying authentication...
          </p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role-based access
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="clay-card-lg max-w-md w-full text-center p-8">
          <div className="w-16 h-16 mx-auto mb-4 text-error-500">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 15v2m0 0v2m0-2h2m-2 0H10m9-7a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You don't have permission to access this page. 
            {requiredRole && (
              <span className="block mt-2 text-sm">
                Required role: <span className="font-medium capitalize">{requiredRole}</span>
              </span>
            )}
          </p>
          <div className="space-y-3">
            <button
              onClick={() => window.history.back()}
              className="clay-btn-secondary w-full"
            >
              Go Back
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="clay-btn-primary w-full"
            >
              Go to Dashboard
            </button>
          </div>
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-clay">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Current user: <span className="font-medium">{user?.name}</span>
              <br />
              Role: <span className="font-medium capitalize">{user?.role}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render protected content
  return children;
};

export default ProtectedRoute;