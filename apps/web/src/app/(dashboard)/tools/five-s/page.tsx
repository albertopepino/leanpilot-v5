'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Plus, ClipboardCheck } from 'lucide-react';

export default function FiveSPage() {
  const [audits, setAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<any[]>('/tools/five-s')
      .then(setAudits)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">5S / 6S Audit</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Workplace organization audits: Sort, Set in Order, Shine, Standardize, Sustain, Safety
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />
          New Audit
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        </div>
      ) : audits.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <ClipboardCheck className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No audits yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md mx-auto">
            Start your first 5S audit to assess workplace organization. Walk the shop floor, score each category 0-5, and track improvement over time.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {audits.map(audit => (
            <div
              key={audit.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-center justify-between hover:shadow-sm transition-shadow cursor-pointer"
            >
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">{audit.area}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {audit.auditor.firstName} {audit.auditor.lastName} — {new Date(audit.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {audit.status === 'completed' && (
                  <span className={`text-lg font-bold ${
                    audit.percentage >= 80 ? 'text-green-600' :
                    audit.percentage >= 60 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {audit.percentage}%
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  audit.status === 'completed'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                }`}>
                  {audit.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
