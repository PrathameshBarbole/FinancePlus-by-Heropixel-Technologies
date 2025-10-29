import React from 'react';

const LoadingSpinner = ({ 
  size = 'md', 
  color = 'primary', 
  className = '',
  text = null 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  const colorClasses = {
    primary: 'text-primary-500',
    secondary: 'text-gray-500',
    success: 'text-success-500',
    warning: 'text-warning-500',
    error: 'text-error-500',
    white: 'text-white',
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div
        className={`
          ${sizeClasses[size]} 
          ${colorClasses[color]} 
          animate-spin
        `}
      >
        <svg 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          className="w-full h-full"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="31.416"
            strokeDashoffset="31.416"
            className="opacity-25"
          />
          <path
            d="M12 2a10 10 0 0 1 10 10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="opacity-75"
          />
        </svg>
      </div>
      {text && (
        <p className={`mt-2 text-sm ${colorClasses[color]} opacity-75`}>
          {text}
        </p>
      )}
    </div>
  );
};

// Preset loading components
export const PageLoader = ({ text = 'Loading...' }) => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
    <div className="clay-card p-8 text-center">
      <LoadingSpinner size="lg" text={text} />
    </div>
  </div>
);

export const InlineLoader = ({ text = 'Loading...' }) => (
  <div className="flex items-center justify-center py-8">
    <LoadingSpinner size="md" text={text} />
  </div>
);

export const ButtonLoader = ({ size = 'sm' }) => (
  <LoadingSpinner size={size} color="white" />
);

export const CardLoader = ({ text = 'Loading...' }) => (
  <div className="clay-card p-6 text-center">
    <LoadingSpinner size="md" text={text} />
  </div>
);

export default LoadingSpinner;