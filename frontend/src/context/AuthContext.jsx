import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { apiHelpers, endpoints } from '../api/axios';
import toast from 'react-hot-toast';

// Initial state
const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

// Action types
const actionTypes = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  SET_LOADING: 'SET_LOADING',
  SET_USER: 'SET_USER',
  CLEAR_ERROR: 'CLEAR_ERROR',
};

// Reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case actionTypes.LOGIN_START:
      return {
        ...state,
        isLoading: true,
        error: null,
      };
      
    case actionTypes.LOGIN_SUCCESS:
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
      
    case actionTypes.LOGIN_FAILURE:
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };
      
    case actionTypes.LOGOUT:
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
      
    case actionTypes.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      };
      
    case actionTypes.SET_USER:
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        isLoading: false,
      };
      
    case actionTypes.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };
      
    default:
      return state;
  }
};

// Create context
const AuthContext = createContext();

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');

        if (token && userData) {
          const user = JSON.parse(userData);
          
          // Verify token with server
          try {
            const response = await apiHelpers.get(endpoints.auth.verify);
            if (response.success) {
              dispatch({
                type: actionTypes.LOGIN_SUCCESS,
                payload: { user: response.user, token }
              });
            } else {
              // Token is invalid, clear storage
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              dispatch({ type: actionTypes.LOGOUT });
            }
          } catch (error) {
            // Token verification failed, clear storage
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            dispatch({ type: actionTypes.LOGOUT });
          }
        } else {
          dispatch({ type: actionTypes.SET_LOADING, payload: false });
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        dispatch({ type: actionTypes.SET_LOADING, payload: false });
      }
    };

    initializeAuth();
  }, []);

  // Login function
  const login = async (email, password) => {
    try {
      dispatch({ type: actionTypes.LOGIN_START });

      const response = await apiHelpers.post(endpoints.auth.login, {
        email,
        password,
      });

      if (response.success) {
        const { user, token } = response;
        
        // Store in localStorage
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        dispatch({
          type: actionTypes.LOGIN_SUCCESS,
          payload: { user, token }
        });

        toast.success(`Welcome back, ${user.name}!`);
        return { success: true };
      } else {
        dispatch({
          type: actionTypes.LOGIN_FAILURE,
          payload: response.message || 'Login failed'
        });
        return { success: false, error: response.message };
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Login failed';
      dispatch({
        type: actionTypes.LOGIN_FAILURE,
        payload: errorMessage
      });
      return { success: false, error: errorMessage };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      // Call logout endpoint
      await apiHelpers.post(endpoints.auth.logout);
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      // Clear localStorage and state regardless of API call result
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      dispatch({ type: actionTypes.LOGOUT });
      toast.success('Logged out successfully');
    }
  };

  // Update profile function
  const updateProfile = async (profileData) => {
    try {
      const response = await apiHelpers.put(endpoints.auth.profile, profileData);
      
      if (response.success) {
        const updatedUser = response.user;
        
        // Update localStorage
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        dispatch({
          type: actionTypes.SET_USER,
          payload: updatedUser
        });

        toast.success('Profile updated successfully');
        return { success: true, user: updatedUser };
      } else {
        return { success: false, error: response.message };
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Profile update failed';
      return { success: false, error: errorMessage };
    }
  };

  // Change password function
  const changePassword = async (currentPassword, newPassword) => {
    try {
      const response = await apiHelpers.put(endpoints.auth.changePassword, {
        currentPassword,
        newPassword,
      });

      if (response.success) {
        toast.success('Password changed successfully');
        return { success: true };
      } else {
        return { success: false, error: response.message };
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Password change failed';
      return { success: false, error: errorMessage };
    }
  };

  // Check if user has required role
  const hasRole = (requiredRole) => {
    if (!state.user) return false;
    
    if (requiredRole === 'admin') {
      return state.user.role === 'admin';
    }
    
    if (requiredRole === 'employee') {
      return state.user.role === 'employee' || state.user.role === 'admin';
    }
    
    return true;
  };

  // Check if user has permission for specific action
  const hasPermission = (permission) => {
    if (!state.user) return false;
    
    // Admin has all permissions
    if (state.user.role === 'admin') return true;
    
    // Define employee permissions
    const employeePermissions = [
      'view_customers',
      'create_customers',
      'edit_own_customers',
      'view_accounts',
      'create_accounts',
      'manage_transactions',
      'view_fd_rd_loans',
      'create_fd_rd_loans',
      'view_reports',
      'view_own_profile',
      'edit_own_profile',
    ];
    
    if (state.user.role === 'employee') {
      return employeePermissions.includes(permission);
    }
    
    return false;
  };

  // Clear error function
  const clearError = () => {
    dispatch({ type: actionTypes.CLEAR_ERROR });
  };

  // Refresh user data
  const refreshUser = async () => {
    try {
      const response = await apiHelpers.get(endpoints.auth.profile);
      
      if (response.success) {
        const updatedUser = response.user;
        
        // Update localStorage
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        dispatch({
          type: actionTypes.SET_USER,
          payload: updatedUser
        });
        
        return { success: true, user: updatedUser };
      }
    } catch (error) {
      console.error('Refresh user error:', error);
      return { success: false, error: error.message };
    }
  };

  // Context value
  const value = {
    // State
    user: state.user,
    token: state.token,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    
    // Actions
    login,
    logout,
    updateProfile,
    changePassword,
    hasRole,
    hasPermission,
    clearError,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};