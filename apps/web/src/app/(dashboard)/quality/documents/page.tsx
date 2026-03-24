'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import FileUpload from '@/components/FileUpload';
import {
  Plus, FileText, Search, ChevronRight, X, Upload,
  CheckCircle, Clock, AlertTriangle, Archive, Download,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';

// ===== TYPES =====
interface DocumentRevision {
  id: string;
  version: number;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  changeNotes: string | null;
  uploadedBy: { firstName: string; lastName: string };
  createdAt: string;
}

interface Document {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  currentVersion: number;
  createdBy: { firstName: string; lastName: string };
  approvedBy: { firstName: string; lastName: string } | null;
  approvedAt: string | null;
  revisions?: DocumentRevision[];
  _count?: { revisions: number };
  createdAt: string;
  updatedAt: string;
}

// ===== CONSTANTS =====
const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'policy', label: 'Policies', emoji: '📜' },
  { key: 'procedure', label: 'Procedures', emoji: '📋' },
  { key: 'form', label: 'Forms', emoji: '📝' },
  { key: 'specification', label: 'Specifications', emoji: '📐' },
];

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  review: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  obsolete: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

const STATUS_ICON: Record<string, typeof Clock> = {
  draft: Clock,
  review: AlertTriangle,
  approved: CheckCircle,
  obsolete: Archive,
};

const NEXT_STATUS: Record<string, string[]> = {
  draft: ['review'],
  review: ['approved', 'draft'],
  approved: ['review', 'obsolete'],
  obsolete: [],
};

type View = 'list' | 'detail' | 'create';

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [selected, setSelected] = useState<Document | null>(null);
  const [error, setError] = useState('');
  const { toast } = useToast();

  // Filters
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');

  // Create form
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('policy');
  const [newFileUrl, setNewFileUrl] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [creating, setCreating] = useState(false);

  // Revision upload
  const [revFileUrl, setRevFileUrl] = useState('');
  const [revFileName, setRevFileName] = useState('');
  const [revNotes, setRevNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showRevisionForm, setShowRevisionForm] = useState(false);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== 'all') params.set('category', category);
      if (search.trim()) params.set('search', search.trim());
      const qs = params.toString();
      const data = await api.get<Document[]>(`/documents${qs ? `?${qs}` : ''}`);
      setDocs(Array.isArray(data) ? data : []);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const openDetail = async (doc: Document) => {
    try {
      const full = await api.get<Document>(`/documents/${doc.id}`);
      setSelected(full);
      setView('detail');
    } catch {
      toast('error', 'Failed to load document');
    }
  };

  const createDocument = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    setError('');
    try {
      const doc = await api.post<Document>('/documents', {
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        category: newCategory,
        fileUrl: newFileUrl || undefined,
        fileName: newFileName || undefined,
      });
      setDocs(prev => [doc, ...prev]);
      setView('list');
      setNewTitle(''); setNewDesc(''); setNewCategory('policy'); setNewFileUrl(''); setNewFileName('');
      toast('success', 'Document created');
    } catch (e: any) {
      setError(e.message || 'Failed to create document');
    } finally {
      setCreating(false);
    }
  };

  const changeStatus = async (docId: string, newStatus: string) => {
    try {
      const updated = await api.patch<Document>(`/documents/${docId}/status`, { status: newStatus });
      setDocs(prev => prev.map(d => d.id === updated.id ? updated : d));
      if (selected?.id === docId) {
        const full = await api.get<Document>(`/documents/${docId}`);
        setSelected(full);
      }
      toast('success', `Status changed to ${newStatus}`);
    } catch (e: any) {
      toast('error', e.message || 'Failed to change status');
    }
  };

  const uploadRevision = async () => {
    if (!selected || !revFileUrl) return;
    setUploading(true);
    try {
      const updated = await api.post<Document>(`/documents/${selected.id}/revisions`, {
        fileUrl: revFileUrl,
        fileName: revFileName || 'document',
        fileSize: 0,
        changeNotes: revNotes.trim() || undefined,
      });
      setSelected(updated);
      setDocs(prev => prev.map(d => d.id === updated.id ? { ...d, currentVersion: updated.currentVersion, status: updated.status } : d));
      setShowRevisionForm(false);
      setRevFileUrl(''); setRevFileName(''); setRevNotes('');
      toast('success', `Revision v${updated.currentVersion} uploaded`);
    } catch (e: any) {
      toast('error', e.message || 'Failed to upload revision');
    } finally {
      setUploading(false);
    }
  };

  // ===== LIST VIEW =====
  if (view === 'list') {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-brand-600" />
              Document Library
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              ISO 9001 Clause 7.5 — Documented information control
            </p>
          </div>
          <button
            onClick={() => { setView('create'); setError(''); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> New Document
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search documents..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex gap-1">
            {CATEGORIES.map(c => (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  category === c.key
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {c.emoji ? `${c.emoji} ` : ''}{c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Document list */}
        {loading ? (
          <SkeletonList count={3} />
        ) : docs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents yet"
            description="Upload your first quality document — policies, procedures, forms, or specifications."
            actionLabel="New Document"
            onAction={() => setView('create')}
          />
        ) : (
          <div className="space-y-2">
            {docs.map(doc => {
              const StatusIcon = STATUS_ICON[doc.status] || Clock;
              return (
                <Card key={doc.id} onClick={() => openDetail(doc)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-xl">{CATEGORIES.find(c => c.key === doc.category)?.emoji || '📄'}</div>
                      <div className="min-w-0">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">{doc.title}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {doc.createdBy.firstName} {doc.createdBy.lastName} — v{doc.currentVersion} — {new Date(doc.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[doc.status] || ''}`}>
                        <StatusIcon className="w-3 h-3" />
                        {doc.status}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ===== CREATE VIEW =====
  if (view === 'create') {
    return (
      <div>
        <Breadcrumb items={[
          { label: 'Documents', onClick: () => setView('list') },
          { label: 'New Document' },
        ]} />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">New Document</h1>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-xl">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
              <span className="text-sm text-red-700 dark:text-red-400 flex-1">{error}</span>
              <button onClick={() => setError('')}><X className="w-4 h-4 text-red-400" /></button>
            </div>
          )}

          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Title *</span>
            <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
              placeholder="e.g. Quality Policy QP-001"
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500"
            />
          </label>

          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Category *</span>
            <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="policy">📜 Policy</option>
              <option value="procedure">📋 Procedure / SOP</option>
              <option value="form">📝 Form / Template</option>
              <option value="specification">📐 Specification</option>
            </select>
          </label>

          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</span>
            <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={3}
              placeholder="Brief description of this document..."
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500"
            />
          </label>

          <div className="mb-6">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">File (optional — can upload later)</span>
            <FileUpload
              func="documents"
              label="Upload document file"
              value={newFileUrl}
              onUpload={(url) => { setNewFileUrl(url); setNewFileName(url.split('/').pop() || 'document'); }}
              onClear={() => { setNewFileUrl(''); setNewFileName(''); }}
            />
          </div>

          <button onClick={createDocument} disabled={creating || !newTitle.trim()}
            className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {creating ? 'Creating...' : 'Create Document'}
          </button>
        </div>
      </div>
    );
  }

  // ===== DETAIL VIEW =====
  if (view === 'detail' && selected) {
    const nextStatuses = NEXT_STATUS[selected.status] || [];
    const StatusIcon = STATUS_ICON[selected.status] || Clock;

    return (
      <div>
        <Breadcrumb items={[
          { label: 'Documents', onClick: () => { setView('list'); setSelected(null); setShowRevisionForm(false); } },
          { label: selected.title },
        ]} />

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-xl">{CATEGORIES.find(c => c.key === selected.category)?.emoji || '📄'}</span>
              {selected.title}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              {selected.createdBy.firstName} {selected.createdBy.lastName} — Created {new Date(selected.createdAt).toLocaleDateString()}
              {selected.description && <> — {selected.description}</>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium capitalize ${STATUS_BADGE[selected.status] || ''}`}>
              <StatusIcon className="w-4 h-4" />
              {selected.status}
            </span>
            {selected.status !== 'obsolete' && (
              <button
                onClick={() => setShowRevisionForm(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Upload className="w-4 h-4" /> New Revision
              </button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left: Info + Status Actions */}
          <div className="space-y-4">
            <Card>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Details</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500">Category</dt><dd className="text-gray-900 dark:text-white capitalize">{selected.category}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Version</dt><dd className="text-gray-900 dark:text-white">v{selected.currentVersion}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Revisions</dt><dd className="text-gray-900 dark:text-white">{selected.revisions?.length || 0}</dd></div>
                {selected.approvedBy && (
                  <div className="flex justify-between"><dt className="text-gray-500">Approved by</dt><dd className="text-gray-900 dark:text-white">{selected.approvedBy.firstName} {selected.approvedBy.lastName}</dd></div>
                )}
                {selected.approvedAt && (
                  <div className="flex justify-between"><dt className="text-gray-500">Approved</dt><dd className="text-gray-900 dark:text-white">{new Date(selected.approvedAt).toLocaleDateString()}</dd></div>
                )}
              </dl>
            </Card>

            {nextStatuses.length > 0 && (
              <Card>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Change Status</h3>
                <div className="flex flex-col gap-2">
                  {nextStatuses.map(ns => {
                    const Icon = STATUS_ICON[ns] || Clock;
                    return (
                      <button key={ns} onClick={() => changeStatus(selected.id, ns)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all hover:shadow-sm capitalize ${
                          ns === 'obsolete'
                            ? 'border-red-300 dark:border-red-700 text-red-600 dark:text-red-400'
                            : ns === 'approved'
                              ? 'border-green-300 dark:border-green-700 text-green-600 dark:text-green-400'
                              : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <Icon className="w-4 h-4" /> {ns}
                      </button>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>

          {/* Right: Revision History */}
          <div className="md:col-span-2">
            {/* Revision upload form */}
            {showRevisionForm && (
              <Card className="mb-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">Upload New Revision</h3>
                <div className="space-y-3">
                  <FileUpload
                    func="documents"
                    label="Upload new version"
                    value={revFileUrl}
                    onUpload={(url) => { setRevFileUrl(url); setRevFileName(url.split('/').pop() || 'document'); }}
                    onClear={() => { setRevFileUrl(''); setRevFileName(''); }}
                  />
                  <input type="text" value={revNotes} onChange={e => setRevNotes(e.target.value)}
                    placeholder="Change notes (what changed in this version?)"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                  />
                  <div className="flex gap-2">
                    <button onClick={uploadRevision} disabled={uploading || !revFileUrl}
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium"
                    >
                      {uploading ? 'Uploading...' : 'Upload Revision'}
                    </button>
                    <button onClick={() => { setShowRevisionForm(false); setRevFileUrl(''); setRevNotes(''); }}
                      className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </Card>
            )}

            {/* Revision timeline */}
            <Card>
              <h3 className="font-medium text-gray-900 dark:text-white mb-4">Revision History</h3>
              {(!selected.revisions || selected.revisions.length === 0) ? (
                <p className="text-sm text-gray-400">No file revisions yet. Upload the first version above.</p>
              ) : (
                <div className="space-y-3">
                  {selected.revisions.map((rev, i) => (
                    <div key={rev.id} className={`flex items-start gap-3 py-3 ${i > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        i === 0 ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                        v{rev.version}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{rev.fileName}</p>
                          <a href={rev.fileUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-brand-600 hover:underline shrink-0"
                          >
                            <Download className="w-3 h-3" /> Download
                          </a>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {rev.uploadedBy.firstName} {rev.uploadedBy.lastName} — {new Date(rev.createdAt).toLocaleString()}
                          {rev.fileSize > 0 && <> — {(rev.fileSize / 1024).toFixed(0)} KB</>}
                        </p>
                        {rev.changeNotes && (
                          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 italic">{rev.changeNotes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  setView('list');
  setSelected(null);
  return null;
}
