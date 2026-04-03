'use client';
import { useState, useEffect } from 'react';

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('/sw.js').catch((err) => {
    console.warn('SW registration failed:', err);
  });
}

export function useOfflineQueue() {
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'QUEUE_UPDATED') {
        setQueueCount(event.data.count);
      }
    };

    navigator.serviceWorker.addEventListener('message', handler);

    // Replay when back online
    const onOnline = () => {
      navigator.serviceWorker.ready.then((reg) => {
        reg.active?.postMessage('REPLAY_QUEUE');
      });
    };
    window.addEventListener('online', onOnline);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handler);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  return queueCount;
}
