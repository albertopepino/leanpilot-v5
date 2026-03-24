'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Building2, Users, ClipboardCheck, Lightbulb, MapPin, ChevronRight, Gauge } from 'lucide-react';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

interface SiteOee {
  siteId: string;
  siteName: string;
  location: string | null;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  totalProduced: number;
  totalScrap: number;
}

interface ConsolidatedOee {
  overallOee: number;
  totalProduced: number;
  totalScrap: number;
  sites: SiteOee[];
}

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
  const router = useRouter();
  const [data, setData] = useState<CorporateOverview | null>(null);
  const [oee, setOee] = useState<ConsolidatedOee | null>(null);
  const [loading, setLoading] = useState(true);
  const [oeeLoading, setOeeLoading] = useState(true);

  useEffect(() => {
    api.get<CorporateOverview>('/corporate/overview')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));

    api.get<ConsolidatedOee>('/corporate/oee')
      .then(setOee)
      .catch(console.error)
      .finally(() => setOeeLoading(false));
  }, []);

  if (loading) {
    return (
      <SkeletonList count={3} />
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
          <Card key={site.id} onClick={() => router.push(`/corporate/${site.id}`)} padding="lg">
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
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  site.isActive
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  {site.isActive ? 'Active' : 'Inactive'}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
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
          </Card>
        ))}
      </div>

      {/* Consolidated OEE */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Gauge className="w-5 h-5 text-brand-600" />
          OEE Across Sites
        </h2>

        {oeeLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : oee ? (
          <div className="space-y-4">
            {/* Overall OEE */}
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Overall OEE</p>
                  <p className={`text-3xl font-bold ${
                    oee.overallOee >= 85 ? 'text-green-600' : oee.overallOee >= 60 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {oee.overallOee}%
                  </p>
                </div>
                <div className="flex gap-6 text-center">
                  <div>
                    <p className="text-sm text-gray-400">Produced</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{oee.totalProduced.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Scrap</p>
                    <p className="text-lg font-bold text-red-600">{oee.totalScrap.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Per-site comparison bars */}
            {oee.sites.length > 0 && (
              <Card>
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">Site Comparison</h3>
                <div className="space-y-3">
                  {oee.sites.map(s => (
                    <div key={s.siteId}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{s.siteName}</span>
                        <span className={`text-sm font-bold ${
                          s.oee >= 85 ? 'text-green-600' : s.oee >= 60 ? 'text-yellow-600' : 'text-red-600'
                        }`}>{s.oee}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all ${
                            s.oee >= 85 ? 'bg-green-500' : s.oee >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(100, s.oee)}%` }}
                        />
                      </div>
                      <div className="flex gap-4 mt-1 text-xs text-gray-400">
                        <span>A: {s.availability}%</span>
                        <span>P: {s.performance}%</span>
                        <span>Q: {s.quality}%</span>
                        <span className="ml-auto">{s.totalProduced} pcs</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Failed to load OEE data</p>
        )}
      </div>
    </div>
  );
}
