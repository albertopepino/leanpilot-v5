'use client';

import { useEffect, useState } from 'react';
import { api, auth } from '@/lib/api';
import { Users, ClipboardCheck, Lightbulb, TrendingUp } from 'lucide-react';

interface KPIs {
  users: number;
  audits: { total: number; averageScore: number; recent: any[] };
  kaizen: { total: number; completed: number; completionRate: number };
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const user = auth.getUser();

  useEffect(() => {
    api.get<KPIs>('/dashboard/site')
      .then(setKpis)
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back, {user?.firstName}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {user?.siteName} — Site Dashboard
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard
          title="Active Users"
          value={kpis?.users ?? 0}
          icon={Users}
          color="blue"
        />
        <KPICard
          title="5S Audits"
          value={kpis?.audits.total ?? 0}
          subtitle={`Avg score: ${kpis?.audits.averageScore ?? 0}%`}
          icon={ClipboardCheck}
          color="green"
        />
        <KPICard
          title="Kaizen Ideas"
          value={kpis?.kaizen.total ?? 0}
          subtitle={`${kpis?.kaizen.completed ?? 0} completed`}
          icon={Lightbulb}
          color="yellow"
        />
        <KPICard
          title="Completion Rate"
          value={`${kpis?.kaizen.completionRate ?? 0}%`}
          icon={TrendingUp}
          color="purple"
        />
      </div>

      {/* Recent 5S Audits */}
      {kpis?.audits.recent && kpis.audits.recent.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recent 5S Audits
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="pb-2 font-medium">Area</th>
                  <th className="pb-2 font-medium">Score</th>
                  <th className="pb-2 font-medium">Auditor</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {kpis.audits.recent.map((audit: any) => (
                  <tr key={audit.id}>
                    <td className="py-3 text-gray-900 dark:text-white">{audit.area}</td>
                    <td className="py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        audit.percentage >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        audit.percentage >= 60 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {audit.percentage}%
                      </span>
                    </td>
                    <td className="py-3 text-gray-600 dark:text-gray-300">
                      {audit.auditor.firstName} {audit.auditor.lastName}
                    </td>
                    <td className="py-3 text-gray-500 dark:text-gray-400">
                      {new Date(audit.completedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({ title, value, subtitle, icon: Icon, color }: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: any;
  color: 'blue' | 'green' | 'yellow' | 'purple';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">{title}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}
