"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff, AlertTriangle } from "lucide-react";

export function ConnectionStatus() {
  // Temporarily disabled to prevent UI freezing issues
  // TODO: Re-enable once backend health endpoint issues are resolved
  return null;

  const [isOnline, setIsOnline] = useState(true);
  const [backendReachable, setBackendReachable] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const checkConnection = async () => {
      // Prevent concurrent checks
      if (isChecking) return;
      setIsChecking(true);
      
      try {
        // Get the API base URL from environment
        const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
        // Use a shorter timeout and don't block the UI
        const response = await fetch(`${apiBase}/health`, {
          method: 'GET', // Backend doesn't support HEAD, use GET
          signal: AbortSignal.timeout(3000), // Shorter timeout
          cache: 'no-cache',
        });
        setBackendReachable(response.ok);
      } catch (error) {
        console.warn('Connection check failed:', error);
        setBackendReachable(false);
      } finally {
        setLastCheck(new Date());
        setIsChecking(false);
      }
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // Delayed initial check to not block page load
    const initialCheckTimeout = setTimeout(checkConnection, 2000);

    // Set up event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check backend connectivity every 5 minutes (much less aggressive)
    const interval = setInterval(checkConnection, 300000);

    // Check on visibility change (debounced)
    let visibilityTimeout: NodeJS.Timeout;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        clearTimeout(visibilityTimeout);
        visibilityTimeout = setTimeout(checkConnection, 1000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(initialCheckTimeout);
      clearTimeout(visibilityTimeout);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [isChecking]);

  // Don't show anything if everything is working
  if (isOnline && backendReachable) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 shadow-lg">
        <div className="flex items-center gap-2">
          {!isOnline ? (
            <WifiOff className="w-5 h-5 text-red-500" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
          )}
          <div className="flex-1">
            <h4 className="text-sm font-medium text-yellow-800">
              {!isOnline ? 'No Internet Connection' : 'Server Connection Issue'}
            </h4>
            <p className="text-xs text-yellow-700">
              {!isOnline 
                ? 'Check your internet connection'
                : 'Unable to reach the server. Some features may not work.'
              }
            </p>
            <p className="text-xs text-yellow-600 mt-1">
              Last checked: {lastCheck.toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}