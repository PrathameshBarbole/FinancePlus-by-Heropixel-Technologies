import React, { useState } from 'react';

const NotificationBell = () => {
  const [notifications] = useState([
    { id: 1, message: 'System is running offline', type: 'info', time: '2 min ago' },
    { id: 2, message: '5 emails queued for sending', type: 'warning', time: '5 min ago' },
  ]);
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadCount = notifications.length;

  return (
    <div className="relative">
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="p-2 rounded-clay hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
        title="Notifications"
      >
        <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-error-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showNotifications && (
        <div className="absolute right-0 mt-2 w-80 clay-card border border-gray-200/50 dark:border-gray-700/50 max-h-96 overflow-y-auto">
          <div className="p-4 border-b border-gray-200/50 dark:border-gray-700/50">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Notifications
            </h3>
          </div>
          
          {notifications.length > 0 ? (
            <div className="divide-y divide-gray-200/50 dark:divide-gray-700/50">
              {notifications.map((notification) => (
                <div key={notification.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <div className="flex items-start space-x-3">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      notification.type === 'info' ? 'bg-primary-500' :
                      notification.type === 'warning' ? 'bg-warning-500' :
                      notification.type === 'error' ? 'bg-error-500' :
                      'bg-success-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {notification.time}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <svg className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No notifications
              </p>
            </div>
          )}
          
          {notifications.length > 0 && (
            <div className="p-4 border-t border-gray-200/50 dark:border-gray-700/50">
              <button className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
                Mark all as read
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;