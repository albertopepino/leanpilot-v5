'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ShopfloorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/login');
      return;
    }
    setChecked(true);
  }, [router]);

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
      {children}
    </div>
  );
}
