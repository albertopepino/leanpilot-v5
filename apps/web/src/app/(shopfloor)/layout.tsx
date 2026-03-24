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

  if (!checked) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {children}
    </div>
  );
}
