'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  FileBarChart, Plus, X, ChevronRight, Loader2, ArrowLeft,
  Clock, CheckCircle2, Send, Eye, Edit3,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';

// ── Types ──────────────────────────────────────────────────────────────

interface A3Report {
  id: string;
  title: string;
  status: 'draft' | 'in_progress' | 'review' | 'completed';
  background?: string;
  currentCondition?: string;
  targetCondition?: string;
  gapAnalysis?: string;
  rootCauseAnalysis?: string;
  countermeasures?: string;
  implementationPlan?: string;
  confirmationMethod?: string;
  followUp?: string;
  linkedFiveWhyId?: string;
  linkedIshikawaId?: string;
  author?: { firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

// ── Constants ──────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  review: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const STATUS_ICON: Record<string, typeof Clock> = {
  draft: Edit3,
  in_progress: Clock,
  review: Eye,
  completed: CheckCircle2,
};

const STATUSES = ['draft', 'in_progress', 'review', 'completed'] as const;

const LEFT_SECTIONS = [
  { key: 'background', label: 'Background', placeholder: 'Describe the context and reason for this A3...' },
  { key: 'currentCondition', label: 'Current Condition', placeholder: 'What is the current situation?' },
  { key: 'targetCondition', label: 'Target Condition', placeholder: 'What is the desired state?' },
  { key: 'gapAnalysis', label: 'Gap Analysis', placeholder: 'What is the gap between current and target?' },
  { key: 'rootCauseAnalysis', label: 'Root Cause Analysis', placeholder: 'What are the root causes? Link to 5-Why or Ishikawa...' },
] as const;

const RIGHT_SECTIONS = [
  { key: 'countermeasures', label: 'Countermeasures', placeholder: 'What actions will address the root causes?' },
  { key: 'implementationPlan', label: 'Implementation Plan', placeholder: 'Who, what, when, where...' },
  { key: 'confirmationMethod', label: 'Confirmation Method', placeholder: 'How will you verify the countermeasures worked?' },
  { key: 'followUp', label: 'Follow-up', placeholder: 'Remaining actions, standardization, horizontal deployment...' },
] as const;

type View = 'list' | 'detail' | 'create';

// ── Page ───────────────────────────────────────────────────────────────

export default function A3Page() {
  const [reports, setReports] = useState<A3Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<A3Report | null>(null);
  const [view, setView] = useState<View>('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { toast } = useToast();

  // Create form
  const [createTitle, setCreateTitle] = useState('');
  const [createBackground, setCreateBackground] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit state
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<any>('/a3');
      setReports(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const openReport = async (id: string) => {
    try {
      setLoading(true);
      const detail = await api.get<A3Report>(`/a3/${id}`);
      setSelectedReport(detail);
      setView('detail');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const createReport = async () => {
    if (!createTitle.trim()) return;
    setSubmitting(true);
    try {
      const report = await api.post<A3Report>('/a3', {
        title: createTitle.trim(),
        background: createBackground.trim() || undefined,
      });
      setCreateTitle('');
      setCreateBackground('');
      toast('success', 'A3 report created');
      await openReport(report.id);
      await loadReports();
    } catch (e: any) {
      toast('error', e.message || 'Failed to create A3 report');
    } finally {
      setSubmitting(false);
    }
  };

  const saveSection = async (field: string, value: string) => {
    if (!selectedReport) return;
    setSaving(true);
    try {
      await api.patch(`/a3/${selectedReport.id}`, { [field]: value.trim() });
      setSelectedReport(prev => prev ? { ...prev, [field]: value.trim() } : null);
      setEditField(null);
      setEditValue('');
      toast('success', 'Section saved');
    } catch (e: any) {
      toast('error', e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (status: string) => {
    if (!selectedReport) return;
    try {
      await api.patch(`/a3/${selectedReport.id}/status`, { status });
      setSelectedReport(prev => prev ? { ...prev, status: status as A3Report['status'] } : null);
      toast('success', `Status updated to ${status.replace('_', ' ')}`);
      await loadReports();
    } catch (e: any) {
      toast('error', e.message || 'Failed to update status');
    }
  };

  const startEdit = (field: string, currentValue: string | undefined) => {
    setEditField(field);
    setEditValue(currentValue || '');
  };

  const renderSection = (section: { key: string; label: string; placeholder: string }, value: string | undefined) => {
    const isEditing = editField === section.key;
    const isCompleted = selectedReport?.status === 'completed';

    return (
      <div key={section.key} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800/50 px-3 py-2 flex items-center justify-between">
          <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">{section.label}</h4>
          {!isCompleted && !isEditing && (
            <button
              onClick={() => startEdit(section.key, value)}
              className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium"
            >
              Edit
            </button>
          )}
        </div>
        <div className="p-3 bg-white dark:bg-gray-800">
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none"
                rows={4}
                placeholder={section.placeholder}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setEditField(null); setEditValue(''); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => saveSection(section.key, editValue)}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : value ? (
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{value}</p>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">{section.placeholder}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Breadcrumb */}
      {view !== 'list' && (
        <Breadcrumb items={[
          { label: 'A3 Reports', onClick: () => { setView('list'); setSelectedReport(null); setEditField(null); } },
          ...(view === 'detail' ? [{ label: selectedReport?.title || 'Report' }] : []),
          ...(view === 'create' ? [{ label: 'New Report' }] : []),
        ]} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileBarChart className="w-6 h-6 text-brand-600" />
            {view === 'list' ? 'A3 Problem Solving' : view === 'create' ? 'New A3 Report' : selectedReport?.title || 'A3 Report'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {view === 'list' ? 'Structured one-page problem solving' : view === 'create' ? 'Start a new A3 analysis' : `Status: ${selectedReport?.status.replace('_', ' ')}`}
          </p>
        </div>
        {view === 'list' && (
          <button
            onClick={() => setView('create')}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium text-sm"
          >
            <Plus className="w-4 h-4" /> New A3
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
          <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
          <button onClick={() => setError('')} aria-label="Dismiss error"><X className="w-4 h-4 text-red-400" /></button>
        </div>
      )}

      {loading && view !== 'create' && <SkeletonList count={3} />}

      {/* Report List */}
      {view === 'list' && !loading && (
        <div className="space-y-2">
          {reports.length === 0 ? (
            <EmptyState
              icon={FileBarChart}
              title="No A3 reports yet"
              description="Create your first A3 to start structured problem solving with the team."
              actionLabel="New A3"
              onAction={() => setView('create')}
            />
          ) : (
            reports.map(report => {
              const SIcon = STATUS_ICON[report.status] || Clock;
              return (
                <Card key={report.id} onClick={() => openReport(report.id)} padding="sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        report.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
                      }`}>
                        <SIcon className={`w-5 h-5 ${report.status === 'completed' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`} />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{report.title}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${STATUS_BADGE[report.status]}`}>
                            {report.status.replace('_', ' ')}
                          </span>
                          {report.author && (
                            <span className="text-xs text-gray-500">
                              {report.author.firstName} {report.author.lastName}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {new Date(report.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Create Form */}
      {view === 'create' && (
        <div className="max-w-xl space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
            <input
              type="text"
              value={createTitle}
              onChange={e => setCreateTitle(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder="Problem statement or title..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Background</label>
            <textarea
              value={createBackground}
              onChange={e => setCreateBackground(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none"
              rows={4}
              placeholder="Describe the context and reason for this A3..."
            />
          </div>
          <button
            onClick={createReport}
            disabled={!createTitle.trim() || submitting}
            className="w-full flex items-center justify-center gap-2 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium disabled:opacity-50 transition-colors"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create A3 Report
          </button>
        </div>
      )}

      {/* A3 Detail — Two-Column Layout */}
      {view === 'detail' && selectedReport && !loading && (
        <div className="space-y-4">
          {/* Status Workflow */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Status Workflow</label>
            <div className="flex gap-2 flex-wrap">
              {STATUSES.map((s, idx) => {
                const SIcon = STATUS_ICON[s];
                const isCurrent = selectedReport.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => updateStatus(s)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium capitalize border transition-colors ${
                      isCurrent
                        ? `${STATUS_BADGE[s]} border-current ring-1 ring-current/20`
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <SIcon className="w-3.5 h-3.5" />
                    {s.replace('_', ' ')}
                    {idx < STATUSES.length - 1 && <ChevronRight className="w-3 h-3 text-gray-300 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* A3 Two-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left Column */}
            <div className="space-y-3">
              {LEFT_SECTIONS.map(section =>
                renderSection(section, selectedReport[section.key as keyof A3Report] as string | undefined)
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              {RIGHT_SECTIONS.map(section =>
                renderSection(section, selectedReport[section.key as keyof A3Report] as string | undefined)
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="text-xs text-gray-400 flex items-center gap-4">
            <span>Created {new Date(selectedReport.createdAt).toLocaleDateString()}</span>
            <span>Last updated {new Date(selectedReport.updatedAt).toLocaleDateString()}</span>
            {selectedReport.author && (
              <span>By {selectedReport.author.firstName} {selectedReport.author.lastName}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
