import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Context Providers
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Components
import ProtectedRoute from './components/ProtectedRoute';
import LoadingSpinner from './components/LoadingSpinner';

// Lazy load pages for better performance
const Login = React.lazy(() => import('./pages/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Customers = React.lazy(() => import('./pages/Customers'));
const CustomerProfile = React.lazy(() => import('./pages/CustomerProfile'));
const Accounts = React.lazy(() => import('./pages/Accounts'));
const FD = React.lazy(() => import('./pages/FD'));
const RD = React.lazy(() => import('./pages/RD'));
const Loans = React.lazy(() => import('./pages/Loans'));
const Transactions = React.lazy(() => import('./pages/Transactions'));
const Reports = React.lazy(() => import('./pages/Reports'));
const Employees = React.lazy(() => import('./pages/Employees'));
const EmailQueue = React.lazy(() => import('./pages/EmailQueue'));
const Settings = React.lazy(() => import('./pages/Settings'));
const Profile = React.lazy(() => import('./pages/Profile'));
const AuditLog = React.lazy(() => import('./pages/AuditLog'));

// Layout component
const Layout = React.lazy(() => import('./components/Layout'));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
    <div className="clay-card p-8 text-center">
      <LoadingSpinner size="lg" />
      <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
    </div>
  </div>
);

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="App">
            {/* Toast notifications */}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                className: 'clay-toast',
                success: {
                  className: 'clay-toast-success',
                  iconTheme: {
                    primary: '#22c55e',
                    secondary: '#ffffff',
                  },
                },
                error: {
                  className: 'clay-toast-error',
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#ffffff',
                  },
                },
                loading: {
                  className: 'clay-toast-info',
                },
              }}
            />

            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />
                
                {/* Protected routes with layout */}
                <Route path="/" element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }>
                  {/* Dashboard */}
                  <Route index element={<Dashboard />} />
                  
                  {/* Customer Management */}
                  <Route path="customers" element={<Customers />} />
                  <Route path="customers/:id" element={<CustomerProfile />} />
                  
                  {/* Account Management */}
                  <Route path="accounts" element={<Accounts />} />
                  
                  {/* Fixed Deposits */}
                  <Route path="fd" element={<FD />} />
                  
                  {/* Recurring Deposits */}
                  <Route path="rd" element={<RD />} />
                  
                  {/* Loans */}
                  <Route path="loans" element={<Loans />} />
                  
                  {/* Transactions */}
                  <Route path="transactions" element={<Transactions />} />
                  
                  {/* Reports */}
                  <Route path="reports" element={<Reports />} />
                  
                  {/* Employee Management (Admin only) */}
                  <Route path="employees" element={
                    <ProtectedRoute requiredRole="admin">
                      <Employees />
                    </ProtectedRoute>
                  } />
                  
                  {/* Email Queue */}
                  <Route path="email-queue" element={<EmailQueue />} />
                  
                  {/* Settings (Admin only) */}
                  <Route path="settings" element={
                    <ProtectedRoute requiredRole="admin">
                      <Settings />
                    </ProtectedRoute>
                  } />
                  
                  {/* Profile */}
                  <Route path="profile" element={<Profile />} />
                  
                  {/* Audit Log (Admin only) */}
                  <Route path="audit-log" element={
                    <ProtectedRoute requiredRole="admin">
                      <AuditLog />
                    </ProtectedRoute>
                  } />
                </Route>
                
                {/* Catch all route - redirect to dashboard */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;