'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Plus, Lightbulb, ArrowRight } from 'lucide-react';

const STATUS_COLS = [
  { key: 'submitted', label: 'Submitted', color: 'border-gray-300' },
  { key: 'under_review', label: 'Under Review', color: 'border-blue-400' },
  { key: 'approved', label: 'Approved', color: 'border-green-400' },
  { key: 'in_progress', label: 'In Progress', color: 'border-yellow-400' },
  { key: 'completed', label: 'Completed', color: 'border-emerald-500' },
];

const IMPACT_BADGE: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function KaizenPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<any[]>('/tools/kaizen')
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kaizen Board</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Continuous improvement: submit ideas, review, implement, verify
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />
          New Idea
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Lightbulb className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Kaizen suggestions yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md mx-auto">
            Kaizen means "change for better." Submit your first improvement idea — even small changes compound into big results.
          </p>
        </div>
      ) : (
        /* Kanban-style board */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUS_COLS.map(col => {
            const colItems = items.filter(i => i.status === col.key);
            return (
              <div key={col.key} className="flex-shrink-0 w-64">
                <div className={`border-t-2 ${col.color} bg-gray-50 dark:bg-gray-800/50 rounded-t-lg px-3 py-2`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{col.label}</span>
                    <span className="text-xs text-gray-400 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
                      {colItems.length}
                    </span>
                  </div>
                </div>
                <div className="space-y-2 mt-2">
                  {colItems.map(item => (
                    <div
                      key={item.id}
                      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 cursor-pointer hover:shadow-sm transition-shadow"
                    >
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1 line-clamp-2">
                        {item.title}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
                        {item.problem}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${IMPACT_BADGE[item.expectedImpact] || ''}`}>
                          {item.expectedImpact}
                        </span>
                        <span className="text-xs text-gray-400">
                          {item.submittedBy.firstName} {item.submittedBy.lastName?.[0]}.
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
