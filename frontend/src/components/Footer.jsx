import React from 'react';

const Footer = () => {
  return (
    <footer className="mt-12 py-6 border-t border-gray-200/50 dark:border-gray-700/50">
      <div className="text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Built by{' '}
          <span className="font-medium text-primary-600 dark:text-primary-400">
            Heropixel Technologies
          </span>
          {' '}© 2025
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          FinancePlus - Offline-first Finance Management Software
        </p>
      </div>
    </footer>
  );
};

export default Footer;