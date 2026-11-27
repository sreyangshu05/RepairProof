import { useEffect, useState } from 'react';

const OFFLINE_SESSION_KEY = 'repairproof.network-offline';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined'
      ? true
      : navigator.onLine && !readOfflineSessionFlag(),
  );

  useEffect(() => {
    const online = () => {
      writeOfflineSessionFlag(false);
      setIsOnline(true);
    };
    const offline = () => {
      writeOfflineSessionFlag(true);
      setIsOnline(false);
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    if (!navigator.onLine) offline();
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  return isOnline;
}

function readOfflineSessionFlag() {
  try {
    return window.sessionStorage.getItem(OFFLINE_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeOfflineSessionFlag(isOffline: boolean) {
  try {
    if (isOffline) window.sessionStorage.setItem(OFFLINE_SESSION_KEY, 'true');
    else window.sessionStorage.removeItem(OFFLINE_SESSION_KEY);
  } catch {
    // Network status still works when session storage is unavailable.
  }
}
