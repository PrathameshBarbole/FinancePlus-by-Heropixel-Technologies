import React, { createContext, useContext, useReducer, useEffect } from 'react';

// Initial state
const initialState = {
  theme: 'light', // 'light' | 'dark' | 'system'
  isDark: false,
  language: 'en', // 'en' | 'mr' (Marathi)
};

// Action types
const actionTypes = {
  SET_THEME: 'SET_THEME',
  SET_LANGUAGE: 'SET_LANGUAGE',
  TOGGLE_THEME: 'TOGGLE_THEME',
};

// Reducer
const themeReducer = (state, action) => {
  switch (action.type) {
    case actionTypes.SET_THEME:
      return {
        ...state,
        theme: action.payload.theme,
        isDark: action.payload.isDark,
      };
      
    case actionTypes.SET_LANGUAGE:
      return {
        ...state,
        language: action.payload,
      };
      
    case actionTypes.TOGGLE_THEME:
      const newTheme = state.theme === 'light' ? 'dark' : 'light';
      return {
        ...state,
        theme: newTheme,
        isDark: newTheme === 'dark',
      };
      
    default:
      return state;
  }
};

// Create context
const ThemeContext = createContext();

// Custom hook to use theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Theme provider component
export const ThemeProvider = ({ children }) => {
  const [state, dispatch] = useReducer(themeReducer, initialState);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const initializeTheme = () => {
      try {
        // Get saved theme preference
        const savedTheme = localStorage.getItem('theme');
        const savedLanguage = localStorage.getItem('language');
        
        let theme = savedTheme || 'system';
        let isDark = false;
        
        // Determine if dark mode should be active
        if (theme === 'system') {
          isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        } else {
          isDark = theme === 'dark';
        }
        
        // Apply theme to document
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        
        // Set initial state
        dispatch({
          type: actionTypes.SET_THEME,
          payload: { theme, isDark }
        });
        
        // Set language
        if (savedLanguage) {
          dispatch({
            type: actionTypes.SET_LANGUAGE,
            payload: savedLanguage
          });
        }
      } catch (error) {
        console.error('Theme initialization error:', error);
      }
    };

    initializeTheme();
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = (e) => {
      if (state.theme === 'system') {
        const isDark = e.matches;
        
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        
        dispatch({
          type: actionTypes.SET_THEME,
          payload: { theme: 'system', isDark }
        });
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [state.theme]);

  // Set theme function
  const setTheme = (theme) => {
    try {
      let isDark = false;
      
      if (theme === 'system') {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      } else {
        isDark = theme === 'dark';
      }
      
      // Apply theme to document
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      
      // Save to localStorage
      localStorage.setItem('theme', theme);
      
      // Update state
      dispatch({
        type: actionTypes.SET_THEME,
        payload: { theme, isDark }
      });
    } catch (error) {
      console.error('Set theme error:', error);
    }
  };

  // Toggle theme function
  const toggleTheme = () => {
    const newTheme = state.theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };

  // Set language function
  const setLanguage = (language) => {
    try {
      // Save to localStorage
      localStorage.setItem('language', language);
      
      // Update state
      dispatch({
        type: actionTypes.SET_LANGUAGE,
        payload: language
      });
      
      // Update document language attribute
      document.documentElement.lang = language;
    } catch (error) {
      console.error('Set language error:', error);
    }
  };

  // Toggle language function
  const toggleLanguage = () => {
    const newLanguage = state.language === 'en' ? 'mr' : 'en';
    setLanguage(newLanguage);
  };

  // Get theme colors for charts and components
  const getThemeColors = () => {
    const isDark = state.isDark;
    
    return {
      primary: isDark ? '#60a5fa' : '#3b82f6',
      secondary: isDark ? '#94a3b8' : '#64748b',
      success: isDark ? '#4ade80' : '#22c55e',
      warning: isDark ? '#fbbf24' : '#f59e0b',
      error: isDark ? '#f87171' : '#ef4444',
      background: isDark ? '#111827' : '#ffffff',
      surface: isDark ? '#1f2937' : '#f9fafb',
      text: isDark ? '#f3f4f6' : '#111827',
      textSecondary: isDark ? '#9ca3af' : '#6b7280',
      border: isDark ? '#374151' : '#e5e7eb',
    };
  };

  // Get current theme info
  const getThemeInfo = () => {
    return {
      theme: state.theme,
      isDark: state.isDark,
      isLight: !state.isDark,
      isSystem: state.theme === 'system',
      language: state.language,
      isEnglish: state.language === 'en',
      isMarathi: state.language === 'mr',
    };
  };

  // Apply theme-specific styles to components
  const getComponentStyles = (component) => {
    const isDark = state.isDark;
    
    const styles = {
      card: isDark 
        ? 'bg-gray-800/80 border-gray-700/50' 
        : 'bg-white/80 border-gray-200/50',
      
      input: isDark 
        ? 'bg-gray-800/80 border-gray-700/50 text-gray-100' 
        : 'bg-white/80 border-gray-200/50 text-gray-900',
      
      button: {
        primary: isDark 
          ? 'bg-blue-600 hover:bg-blue-700 text-white' 
          : 'bg-blue-500 hover:bg-blue-600 text-white',
        secondary: isDark 
          ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' 
          : 'bg-gray-200 hover:bg-gray-300 text-gray-800',
      },
      
      text: {
        primary: isDark ? 'text-gray-100' : 'text-gray-900',
        secondary: isDark ? 'text-gray-400' : 'text-gray-600',
        muted: isDark ? 'text-gray-500' : 'text-gray-500',
      },
      
      background: {
        primary: isDark ? 'bg-gray-900' : 'bg-gray-50',
        secondary: isDark ? 'bg-gray-800' : 'bg-white',
      },
    };
    
    return styles[component] || styles;
  };

  // Context value
  const value = {
    // State
    theme: state.theme,
    isDark: state.isDark,
    language: state.language,
    
    // Actions
    setTheme,
    toggleTheme,
    setLanguage,
    toggleLanguage,
    
    // Helpers
    getThemeColors,
    getThemeInfo,
    getComponentStyles,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};