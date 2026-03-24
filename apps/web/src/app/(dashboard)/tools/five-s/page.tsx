'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Plus, ClipboardCheck, ChevronLeft, CheckCircle, X, Star } from 'lucide-react';

interface FiveSScore {
  id: string;
  category: string;
  score: number;
  notes: string | null;
  photoUrl: string | null;
}

interface FiveSAudit {
  id: string;
  area: string;
  status: 'in_progress' | 'completed';
  totalScore: number;
  percentage: number;
  notes: string | null;
  createdAt: string;
  auditor: { firstName: string; lastName: string };
  scores: FiveSScore[];
}

const CATEGORIES = [
  { key: 'sort', label: 'Sort (Seiri)', desc: 'Remove unnecessary items', emoji: '🗂️' },
  { key: 'set_in_order', label: 'Set in Order (Seiton)', desc: 'Organize remaining items', emoji: '📐' },
  { key: 'shine', label: 'Shine (Seiso)', desc: 'Clean the workspace', emoji: '✨' },
  { key: 'standardize', label: 'Standardize (Seiketsu)', desc: 'Create consistent processes', emoji: '📋' },
  { key: 'sustain', label: 'Sustain (Shitsuke)', desc: 'Maintain discipline', emoji: '🔄' },
  { key: 'safety', label: 'Safety', desc: 'Hazard identification & PPE', emoji: '🦺' },
];

type View = 'list' | 'create' | 'detail' | 'scoring';

export default function FiveSPage() {
  const [audits, setAudits] = useState<FiveSAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [selected, setSelected] = useState<FiveSAudit | null>(null);
  const [error, setError] = useState('');

  // Create form
  const [newArea, setNewArea] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [creating, setCreating] = useState(false);

  // Scoring state
  const [scores, setScores] = useState<Record<string, number>>({});
  const [scoreNotes, setScoreNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const loadAudits = useCallback(() => {
    api.get<FiveSAudit[]>('/tools/five-s')
      .then(data => setAudits(Array.isArray(data) ? data : []))
      .catch(() => setAudits([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadAudits(); }, [loadAudits]);

  const createAudit = async () => {
    if (!newArea.trim()) return;
    setCreating(true);
    setError('');
    try {
      const audit = await api.post<FiveSAudit>('/tools/five-s', {
        area: newArea.trim(),
        notes: newNotes.trim() || undefined,
      });
      setAudits(prev => [audit, ...prev]);
      setSelected(audit);
      // Pre-fill scores
      const s: Record<string, number> = {};
      const n: Record<string, string> = {};
      (audit.scores || []).forEach(sc => {
        s[sc.category] = sc.score;
        n[sc.category] = sc.notes || '';
      });
      CATEGORIES.forEach(c => { if (s[c.key] === undefined) s[c.key] = 0; });
      setScores(s);
      setScoreNotes(n);
      setView('scoring');
      setNewArea('');
      setNewNotes('');
    } catch (e: any) {
      setError(e.message || 'Failed to create audit');
    } finally {
      setCreating(false);
    }
  };

  const openDetail = (audit: FiveSAudit) => {
    setSelected(audit);
    // Load full detail
    api.get<FiveSAudit>(`/tools/five-s/${audit.id}`)
      .then(full => {
        setSelected(full);
        const s: Record<string, number> = {};
        const n: Record<string, string> = {};
        (full.scores || []).forEach(sc => {
          s[sc.category] = sc.score;
          n[sc.category] = sc.notes || '';
        });
        CATEGORIES.forEach(c => { if (s[c.key] === undefined) s[c.key] = 0; });
        setScores(s);
        setScoreNotes(n);
      })
      .catch(() => {});
    setView('detail');
  };

  const saveScores = async () => {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      const payload = CATEGORIES.map(c => ({
        category: c.key,
        score: scores[c.key] || 0,
        notes: scoreNotes[c.key] || undefined,
      }));
      const updated = await api.patch<FiveSAudit>(`/tools/five-s/${selected.id}/scores`, { scores: payload });
      setSelected(updated);
      setAudits(prev => prev.map(a => a.id === updated.id ? updated : a));
    } catch (e: any) {
      setError(e.message || 'Failed to save scores');
    } finally {
      setSaving(false);
    }
  };

  const completeAudit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await api.patch<FiveSAudit>(`/tools/five-s/${selected.id}/complete`, {});
      setSelected(updated);
      setAudits(prev => prev.map(a => a.id === updated.id ? updated : a));
      setView('detail');
    } catch (e: any) {
      setError(e.message || 'Failed to complete audit');
    } finally {
      setSaving(false);
    }
  };

  // Simple radar chart as SVG
  const RadarChart = ({ auditScores }: { auditScores: FiveSScore[] }) => {
    const size = 200;
    const cx = size / 2;
    const cy = size / 2;
    const maxR = 80;
    const cats = CATEGORIES.map(c => ({
      ...c,
      score: auditScores.find(s => s.category === c.key)?.score || 0,
    }));
    const n = cats.length;
    const getPoint = (i: number, val: number) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const r = (val / 5) * maxR;
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    };
    const gridLevels = [1, 2, 3, 4, 5];
    const dataPoints = cats.map((c, i) => getPoint(i, c.score));
    const polygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

    return (
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[280px] mx-auto">
        {/* Grid */}
        {gridLevels.map(level => {
          const pts = Array.from({ length: n }, (_, i) => getPoint(i, level));
          return (
            <polygon
              key={level}
              points={pts.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="currentColor"
              className="text-gray-200 dark:text-gray-700"
              strokeWidth={level === 5 ? 1.5 : 0.5}
            />
          );
        })}
        {/* Axes */}
        {cats.map((_, i) => {
          const p = getPoint(i, 5);
          return (
            <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y}
              stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth={0.5}
            />
          );
        })}
        {/* Data polygon */}
        <polygon points={polygon} fill="rgba(59,130,246,0.2)" stroke="#3b82f6" strokeWidth={2} />
        {/* Data dots */}
        {dataPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="#3b82f6" />
        ))}
        {/* Labels */}
        {cats.map((c, i) => {
          const p = getPoint(i, 6.2);
          return (
            <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
              className="fill-gray-600 dark:fill-gray-400 text-[8px]"
            >
              {c.emoji}
            </text>
          );
        })}
      </svg>
    );
  };

  // Score selector (0-5 stars)
  const ScoreInput = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(v => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v === value ? 0 : v)}
          className="p-0.5 transition-colors"
          aria-label={`Score ${v}`}
        >
          <Star className={`w-6 h-6 ${v <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`} />
        </button>
      ))}
      <span className="ml-2 text-sm font-mono text-gray-500 dark:text-gray-400 self-center">{value}/5</span>
    </div>
  );

  // ===== LIST VIEW =====
  if (view === 'list') {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">5S / 6S Audit</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Workplace organization audits — Sort, Set in Order, Shine, Standardize, Sustain, Safety
            </p>
          </div>
          <button
            onClick={() => setView('create')}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Audit
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          </div>
        ) : audits.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <ClipboardCheck className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No audits yet</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md mx-auto">
              Start your first 5S audit to assess workplace organization.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {audits.map(audit => (
              <button
                key={audit.id}
                onClick={() => openDetail(audit)}
                className="w-full text-left bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-center justify-between hover:shadow-sm hover:border-brand-300 dark:hover:border-brand-600 transition-all"
              >
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">{audit.area}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {audit.auditor?.firstName} {audit.auditor?.lastName} — {new Date(audit.createdAt).toLocaleDateString()}
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
                    {audit.status === 'completed' ? 'Completed' : 'In Progress'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ===== CREATE VIEW =====
  if (view === 'create') {
    return (
      <div>
        <button onClick={() => setView('list')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4">
          <ChevronLeft className="w-4 h-4" /> Back to audits
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">New 5S Audit</h1>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-lg">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
              <span className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</span>
              <button onClick={() => setError('')} aria-label="Dismiss error"><X className="w-4 h-4 text-red-400" /></button>
            </div>
          )}
          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Area / Zone *</span>
            <input
              type="text"
              value={newArea}
              onChange={e => setNewArea(e.target.value)}
              placeholder="e.g. Assembly Line 1, Warehouse Bay C"
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </label>
          <label className="block mb-6">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Notes (optional)</span>
            <textarea
              value={newNotes}
              onChange={e => setNewNotes(e.target.value)}
              rows={3}
              placeholder="Audit context, focus areas..."
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </label>
          <button
            onClick={createAudit}
            disabled={creating || !newArea.trim()}
            className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {creating ? 'Creating...' : 'Start Audit & Score'}
          </button>
        </div>
      </div>
    );
  }

  // ===== SCORING VIEW =====
  if (view === 'scoring' && selected) {
    const total = CATEGORIES.reduce((s, c) => s + (scores[c.key] || 0), 0);
    const maxTotal = CATEGORIES.length * 5;
    const pct = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;

    return (
      <div>
        <button onClick={() => setView('detail')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4">
          <ChevronLeft className="w-4 h-4" /> Back to detail
        </button>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Score: {selected.area}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Rate each category 0-5 stars</p>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
              {pct}%
            </div>
            <div className="text-xs text-gray-400">{total}/{maxTotal}</div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
            <span className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</span>
            <button onClick={() => setError('')} aria-label="Dismiss error"><X className="w-4 h-4 text-red-400" /></button>
          </div>
        )}

        <div className="space-y-4 mb-6">
          {CATEGORIES.map(cat => (
            <div key={cat.key} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">{cat.emoji} {cat.label}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{cat.desc}</p>
                </div>
                <ScoreInput value={scores[cat.key] || 0} onChange={v => setScores(p => ({ ...p, [cat.key]: v }))} />
              </div>
              <input
                type="text"
                value={scoreNotes[cat.key] || ''}
                onChange={e => setScoreNotes(p => ({ ...p, [cat.key]: e.target.value }))}
                placeholder="Notes for this category..."
                className="w-full px-3 py-1.5 rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-sm text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-brand-500"
              />
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={saveScores}
            disabled={saving}
            className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? 'Saving...' : 'Save Scores'}
          </button>
          {selected.status !== 'completed' && (
            <button
              onClick={async () => {
                setSaving(true);
                try { await saveScores(); await completeAudit(); } catch {} finally { setSaving(false); }
              }}
              disabled={saving || total === 0}
              className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save & Complete'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ===== DETAIL VIEW =====
  if (view === 'detail' && selected) {
    return (
      <div>
        <button onClick={() => { setView('list'); setSelected(null); }} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4">
          <ChevronLeft className="w-4 h-4" /> Back to audits
        </button>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{selected.area}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              {selected.auditor?.firstName} {selected.auditor?.lastName} — {new Date(selected.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              selected.status === 'completed'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            }`}>
              {selected.status === 'completed' ? 'Completed' : 'In Progress'}
            </span>
            {selected.status !== 'completed' && (
              <button
                onClick={() => setView('scoring')}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Edit Scores
              </button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Radar Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-medium text-gray-900 dark:text-white mb-4 text-center">Radar Overview</h3>
            <RadarChart auditScores={selected.scores || []} />
            <div className="text-center mt-3">
              <span className={`text-3xl font-bold ${
                selected.percentage >= 80 ? 'text-green-600' :
                selected.percentage >= 60 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {selected.percentage}%
              </span>
              <span className="text-gray-400 text-sm ml-2">({selected.totalScore}/{CATEGORIES.length * 5})</span>
            </div>
          </div>

          {/* Category breakdown */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-medium text-gray-900 dark:text-white mb-4">Category Scores</h3>
            <div className="space-y-3">
              {CATEGORIES.map(cat => {
                const sc = (selected.scores || []).find(s => s.category === cat.key);
                const val = sc?.score || 0;
                return (
                  <div key={cat.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{cat.emoji} {cat.label}</span>
                      <span className="text-sm font-mono font-medium text-gray-900 dark:text-white">{val}/5</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          val >= 4 ? 'bg-green-500' : val >= 3 ? 'bg-yellow-500' : val >= 1 ? 'bg-red-500' : 'bg-gray-300'
                        }`}
                        style={{ width: `${(val / 5) * 100}%` }}
                      />
                    </div>
                    {sc?.notes && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">{sc.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {selected.notes && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">Audit Notes</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{selected.notes}</p>
          </div>
        )}
      </div>
    );
  }

  // Fallback: reset to list if state is inconsistent
  setView('list');
  setSelected(null);
  return null;
}
