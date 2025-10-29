import React, { useState, useEffect } from 'react';

const LiveClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="hidden md:flex flex-col items-end text-right">
      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
        {formatTime(time)}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {formatDate(time)}
      </div>
    </div>
  );
};

export default LiveClock;