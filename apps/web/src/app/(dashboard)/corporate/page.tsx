'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Building2, Users, ClipboardCheck, Lightbulb, MapPin } from 'lucide-react';

interface CorporateOverview {
  id: string;
  name: string;
  totalUsers: number;
  totalSites: number;
  sites: {
    id: string;
    name: string;
    location: string | null;
    userCount: number;
    auditCount: number;
    kaizenCount: number;
    isActive: boolean;
  }[];
}

export default function CorporatePage() {
  const [data, setData] = useState<CorporateOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<CorporateOverview>('/corporate/overview')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return <p className="text-gray-500">Failed to load corporate data.</p>;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {data.name}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Corporate Overview — {data.totalSites} sites, {data.totalUsers} users
        </p>
      </div>

      {/* Site Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.sites.map(site => (
          <div
            key={site.id}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {site.name}
                </h3>
                {site.location && (
                  <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {site.location}
                  </div>
                )}
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                site.isActive
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              }`}>
                {site.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <Users className="w-4 h-4 mx-auto text-blue-500 mb-1" />
                <p className="text-lg font-bold text-gray-900 dark:text-white">{site.userCount}</p>
                <p className="text-xs text-gray-400">Users</p>
              </div>
              <div className="text-center">
                <ClipboardCheck className="w-4 h-4 mx-auto text-green-500 mb-1" />
                <p className="text-lg font-bold text-gray-900 dark:text-white">{site.auditCount}</p>
                <p className="text-xs text-gray-400">Audits</p>
              </div>
              <div className="text-center">
                <Lightbulb className="w-4 h-4 mx-auto text-yellow-500 mb-1" />
                <p className="text-lg font-bold text-gray-900 dark:text-white">{site.kaizenCount}</p>
                <p className="text-xs text-gray-400">Kaizen</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
