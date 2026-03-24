'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import {
  Users, Wrench, ClipboardCheck, Lightbulb, MapPin, Building2,
} from 'lucide-react';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Card } from '@/components/ui/Card';
import { SkeletonList } from '@/components/ui/Skeleton';

interface SiteDetail {
  id: string;
  name: string;
  location: string | null;
  isActive: boolean;
  userCount: number;
  workstationCount: number;
  users: Array<{ id: string; firstName: string; lastName: string; email: string; role: string; isActive: boolean }>;
  workstations: Array<{ id: string; name: string; code: string; type: string | null; area: string | null; isActive: boolean }>;
  recentAudits: Array<{ id: string; area: string; status: string; percentage: number; createdAt: string; auditor: { firstName: string; lastName: string } }>;
  recentKaizen: Array<{ id: string; title: string; status: string; expectedImpact: string; createdAt: string; submittedBy: { firstName: string; lastName: string } }>;
}

const ROLE_COLORS: Record<string, string> = {
  corporate_admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  site_admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  manager: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  operator: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  viewer: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

type Tab = 'overview' | 'users' | 'workstations';

export default function SiteDetailPage() {
  const params = useParams();
  const siteId = params.siteId as string;
  const [site, setSite] = useState<SiteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    api.get<SiteDetail>(`/corporate/sites/${siteId}`)
      .then(setSite)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [siteId]);

  if (loading) return <SkeletonList count={4} />;
  if (!site) return <p className="text-gray-500">Failed to load site data.</p>;

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'users', label: 'Users', count: site.userCount },
    { key: 'workstations', label: 'Workstations', count: site.workstationCount },
  ];

  return (
    <div>
      <Breadcrumb items={[
        { label: 'Corporate', onClick: () => window.history.back() },
        { label: site.name },
      ]} />

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-brand-600" />
            {site.name}
          </h1>
          {site.location && (
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> {site.location}
            </p>
          )}
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          site.isActive
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
        }`}>
          {site.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card padding="sm">
          <div className="text-center">
            <Users className="w-5 h-5 mx-auto text-blue-500 mb-1" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{site.userCount}</p>
            <p className="text-xs text-gray-400">Users</p>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-center">
            <Wrench className="w-5 h-5 mx-auto text-orange-500 mb-1" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{site.workstationCount}</p>
            <p className="text-xs text-gray-400">Workstations</p>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-center">
            <ClipboardCheck className="w-5 h-5 mx-auto text-green-500 mb-1" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{site.recentAudits.length}</p>
            <p className="text-xs text-gray-400">Recent Audits</p>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-center">
            <Lightbulb className="w-5 h-5 mx-auto text-yellow-500 mb-1" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{site.recentKaizen.length}</p>
            <p className="text-xs text-gray-400">Recent Kaizen</p>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="ml-1.5 text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">Recent 5S Audits</h3>
            {site.recentAudits.length === 0 ? (
              <p className="text-sm text-gray-400">No audits yet</p>
            ) : (
              <div className="space-y-2">
                {site.recentAudits.map(a => (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{a.area}</p>
                      <p className="text-xs text-gray-400">{a.auditor.firstName} {a.auditor.lastName} — {new Date(a.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.status === 'completed' && (
                        <span className={`text-sm font-bold ${a.percentage >= 80 ? 'text-green-600' : a.percentage >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {a.percentage}%
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        a.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>{a.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">Recent Kaizen Ideas</h3>
            {site.recentKaizen.length === 0 ? (
              <p className="text-sm text-gray-400">No Kaizen ideas yet</p>
            ) : (
              <div className="space-y-2">
                {site.recentKaizen.map(k => (
                  <div key={k.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{k.title}</p>
                      <p className="text-xs text-gray-400">{k.submittedBy.firstName} {k.submittedBy.lastName} — {new Date(k.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                      k.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : k.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>{k.status.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Users tab */}
      {tab === 'users' && (
        <Card padding="sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Name</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Email</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Role</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {site.users.map(u => (
                  <tr key={u.id} className="border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                    <td className="py-3 px-4 text-gray-900 dark:text-white font-medium">{u.firstName} {u.lastName}</td>
                    <td className="py-3 px-4 text-gray-500 dark:text-gray-400">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${ROLE_COLORS[u.role] || ROLE_COLORS.viewer}`}>
                        {u.role.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`w-2 h-2 rounded-full inline-block mr-1.5 ${u.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {u.isActive ? 'Active' : 'Inactive'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Workstations tab */}
      {tab === 'workstations' && (
        <Card padding="sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Code</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Name</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Type</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Area</th>
                  <th className="text-left py-3 px-4 text-gray-500 dark:text-gray-400 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {site.workstations.map(ws => (
                  <tr key={ws.id} className="border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                    <td className="py-3 px-4 font-mono text-gray-900 dark:text-white">{ws.code}</td>
                    <td className="py-3 px-4 text-gray-900 dark:text-white font-medium">{ws.name}</td>
                    <td className="py-3 px-4 text-gray-500 dark:text-gray-400 capitalize">{ws.type || '—'}</td>
                    <td className="py-3 px-4 text-gray-500 dark:text-gray-400">{ws.area || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`w-2 h-2 rounded-full inline-block mr-1.5 ${ws.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {ws.isActive ? 'Active' : 'Inactive'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
