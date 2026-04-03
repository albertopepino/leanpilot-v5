'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { registerServiceWorker, useOfflineQueue } from '@/lib/offline-queue';

export default function ShopfloorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const queueCount = useOfflineQueue();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login');
      return;
    }
    setChecked(true);
  }, [router]);

  // Register service worker and add manifest link on mount
  useEffect(() => {
    registerServiceWorker();

    // Inject manifest link
    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/manifest.json';
      document.head.appendChild(link);
    }

    // Inject theme-color meta
    if (!document.querySelector('meta[name="theme-color"]')) {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = '#2563eb';
      document.head.appendChild(meta);
    }
  }, []);

  // Set viewport meta to prevent zoom on tablets
  useEffect(() => {
    let meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    const content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
    if (meta) {
      meta.setAttribute('content', content);
    } else {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = content;
      document.head.appendChild(meta);
    }
    // Restore default viewport on unmount
    return () => {
      const m = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
      if (m) m.setAttribute('content', 'width=device-width, initial-scale=1');
    };
  }, []);

  if (!checked) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {queueCount > 0 && (
        <div className="fixed top-2 right-2 z-50 flex items-center gap-2 rounded-full bg-yellow-600 px-3 py-1 text-xs font-medium text-white shadow-lg">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
          {queueCount} offline {queueCount === 1 ? 'action' : 'actions'} queued
        </div>
      )}
      {children}
    </div>
  );
}
