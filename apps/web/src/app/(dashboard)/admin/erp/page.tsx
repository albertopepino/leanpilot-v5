'use client';

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import {
  Database, Plug, Upload, Download, RefreshCw, CheckCircle2, XCircle,
  AlertTriangle, Loader2, Clock, ArrowUpDown, FileSpreadsheet,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

type ErpConnection = {
  id: string;
  provider: string;
  name: string;
  baseUrl: string | null;
  apiKey: string | null;
  username: string | null;
  password: string | null;
  syncEnabled: boolean;
  syncInterval: number;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncMessage: string | null;
  config: string | null;
};

type SyncLog = {
  id: string;
  direction: string;
  entityType: string;
  recordCount: number;
  status: string;
  message: string | null;
  startedAt: string;
  completedAt: string | null;
};

const PROVIDERS = [
  { value: 'sap', label: 'SAP S/4HANA' },
  { value: 'oracle', label: 'Oracle EBS' },
  { value: 'custom_api', label: 'Custom REST API' },
  { value: 'csv_import', label: 'CSV Import/Export' },
];

const SYNC_INTERVALS = [
  { value: 15, label: 'Every 15 minutes' },
  { value: 30, label: 'Every 30 minutes' },
  { value: 60, label: 'Every hour' },
  { value: 120, label: 'Every 2 hours' },
];

export default function ErpIntegrationPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Connection state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [form, setForm] = useState({
    provider: 'csv_import',
    name: 'ERP Connection',
    baseUrl: '',
    apiKey: '',
    username: '',
    password: '',
    syncEnabled: false,
    syncInterval: 60,
    config: '',
  });

  // Import/Export state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[]; message?: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ exported: number } | null>(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);

  // Sync logs
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);

  const isApiProvider = form.provider !== 'csv_import';

  useEffect(() => {
    loadConnection();
    loadSyncLogs();
  }, []);

  async function loadConnection() {
    try {
      const conn = await api.get<ErpConnection | null>('/erp/connection');
      if (conn) {
        setForm({
          provider: conn.provider,
          name: conn.name || 'ERP Connection',
          baseUrl: conn.baseUrl || '',
          apiKey: conn.apiKey || '',
          username: conn.username || '',
          password: conn.password || '',
          syncEnabled: conn.syncEnabled,
          syncInterval: conn.syncInterval,
          config: conn.config || '',
        });
      }
    } catch {
      // No connection yet
    } finally {
      setLoading(false);
    }
  }

  async function loadSyncLogs() {
    try {
      const res = await api.get<{ data: SyncLog[] }>('/erp/sync-logs?limit=10');
      setSyncLogs(res.data || []);
    } catch {
      // ignore
    }
  }

  async function saveConnection() {
    setSaving(true);
    try {
      await api.post('/erp/connection', form);
      toast('success', 'ERP connection saved');
    } catch (e: any) {
      toast('error', e.message || 'Failed to save connection');
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.post<{ success: boolean; message: string }>('/erp/test');
      setTestResult(result);
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || 'Test failed' });
    } finally {
      setTesting(false);
    }
  }

  async function importOrders() {
    setImporting(true);
    setImportResult(null);
    try {
      const result = await api.post<{ imported: number; skipped: number; errors: string[]; message?: string }>('/erp/import-orders');
      setImportResult(result);
      loadSyncLogs();
      toast('success', `Import complete: ${result.imported} orders`);
    } catch (e: any) {
      toast('error', e.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCsv(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const res = await fetch('/api/erp/import-csv', {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(body.message || 'Upload failed');
      }

      const result = await res.json();
      setImportResult(result);
      loadSyncLogs();
      toast('success', `CSV import: ${result.imported} orders imported`);
    } catch (e: any) {
      toast('error', e.message || 'CSV upload failed');
    } finally {
      setUploadingCsv(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function exportResults() {
    setExporting(true);
    setExportResult(null);
    try {
      const result = await api.post<{ exported: number }>('/erp/export-results');
      setExportResult(result);
      loadSyncLogs();
      toast('success', `Exported ${result.exported} results`);
    } catch (e: any) {
      toast('error', e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  async function downloadCsv() {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const res = await fetch('/api/erp/export-results/download', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `production-results-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast('error', e.message || 'Download failed');
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ERP Integration</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Connect to your ERP system to sync production orders and results
        </p>
      </div>

      {/* ── Connection Setup ────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Plug className="w-5 h-5 text-indigo-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Connection Setup</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Provider */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Provider</label>
            <select
              value={form.provider}
              onChange={e => { setForm(f => ({ ...f, provider: e.target.value })); setTestResult(null); }}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              {PROVIDERS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Connection Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* API-provider fields */}
          {isApiProvider && (
            <>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Base URL</label>
                <input
                  type="url"
                  value={form.baseUrl}
                  onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))}
                  placeholder="https://erp.example.com/api/v1"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">API Key / Token</label>
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
                  placeholder="Enter API key"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Username</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {form.provider === 'custom_api' && (
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Custom Headers (JSON)</label>
                  <textarea
                    value={form.config}
                    onChange={e => setForm(f => ({ ...f, config: e.target.value }))}
                    rows={3}
                    placeholder='{"X-Custom-Header": "value"}'
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              )}
            </>
          )}

          {!isApiProvider && (
            <div className="md:col-span-2 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
              <p className="text-sm text-indigo-700 dark:text-indigo-300">
                CSV mode does not require connection details. Use the Import/Export section below to upload CSV files or download results.
              </p>
            </div>
          )}

          {/* Auto-sync */}
          <div className="md:col-span-2 flex items-center gap-4 pt-2 border-t border-gray-100 dark:border-gray-700">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.syncEnabled}
                onChange={e => setForm(f => ({ ...f, syncEnabled: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Enable Auto-Sync</span>
            </label>

            {form.syncEnabled && (
              <select
                value={form.syncInterval}
                onChange={e => setForm(f => ({ ...f, syncInterval: parseInt(e.target.value) }))}
                className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {SYNC_INTERVALS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Test result */}
        {testResult && (
          <div className={`mt-4 p-3 rounded-lg border text-sm flex items-center gap-2
            ${testResult.success
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
            }`}>
            {testResult.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
            {testResult.message}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          {isApiProvider && (
            <button
              onClick={testConnection}
              disabled={testing}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50 transition-colors"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
              Test Connection
            </button>
          )}
          <button
            onClick={saveConnection}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            Save Connection
          </button>
        </div>
      </div>

      {/* ── Import / Export ────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Import card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Upload className="w-5 h-5 text-green-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Import Orders</h2>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Pull production orders from your ERP system into LeanPilot.
          </p>

          <div className="space-y-3">
            {isApiProvider && (
              <button
                onClick={importOrders}
                disabled={importing}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Import from ERP
              </button>
            )}

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="hidden"
                id="csv-upload"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingCsv}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-green-300 dark:border-green-600 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {uploadingCsv ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                Import from CSV
              </button>
            </div>
          </div>

          {importResult && (
            <div className={`mt-4 p-3 rounded-lg border text-sm space-y-1
              ${importResult.errors.length === 0
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'}`}>
              <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
                {importResult.errors.length === 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                )}
                {importResult.imported} imported, {importResult.skipped} skipped
              </div>
              {importResult.message && (
                <p className="text-gray-600 dark:text-gray-400">{importResult.message}</p>
              )}
              {importResult.errors.length > 0 && (
                <ul className="text-xs text-red-600 dark:text-red-400 list-disc list-inside max-h-32 overflow-y-auto">
                  {importResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* CSV format hint */}
          <details className="mt-4">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300">
              CSV format reference
            </summary>
            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs font-mono text-gray-600 dark:text-gray-400 overflow-x-auto">
              <p className="font-sans font-medium text-gray-700 dark:text-gray-300 mb-1">Required columns:</p>
              <p>PO Number, Product Name, Target Quantity</p>
              <p className="font-sans font-medium text-gray-700 dark:text-gray-300 mt-2 mb-1">Optional columns:</p>
              <p>Unit, Due Date, Priority, Phase Name, Workstation Code, Cycle Time (s)</p>
              <p className="font-sans text-gray-500 mt-2">
                Multiple rows with the same PO Number create multiple phases for that order.
              </p>
            </div>
          </details>
        </div>

        {/* Export card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Download className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Export Results</h2>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Push completed production data back to your ERP or download as CSV.
          </p>

          <div className="space-y-3">
            <button
              onClick={exportResults}
              disabled={exporting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpDown className="w-4 h-4" />}
              {isApiProvider ? 'Export to ERP' : 'Generate Export'}
            </button>

            <button
              onClick={downloadCsv}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Results CSV
            </button>
          </div>

          {exportResult && (
            <div className="mt-4 p-3 rounded-lg border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-sm">
              <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
                <CheckCircle2 className="w-4 h-4 text-blue-500" />
                {exportResult.exported} production records exported
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Sync History ────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Sync History</h2>
          </div>
          <button
            onClick={loadSyncLogs}
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {syncLogs.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No sync history yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="pb-2 font-medium">Time</th>
                  <th className="pb-2 font-medium">Direction</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Records</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {syncLogs.map(log => (
                  <tr key={log.id}>
                    <td className="py-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {new Date(log.startedAt).toLocaleString()}
                    </td>
                    <td className="py-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize
                        ${log.direction === 'import'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                        {log.direction}
                      </span>
                    </td>
                    <td className="py-2 text-gray-600 dark:text-gray-300 capitalize">
                      {log.entityType.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2 text-gray-600 dark:text-gray-300">{log.recordCount}</td>
                    <td className="py-2">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium
                        ${log.status === 'success' ? 'text-green-600 dark:text-green-400' :
                          log.status === 'error' ? 'text-red-600 dark:text-red-400' :
                          'text-yellow-600 dark:text-yellow-400'}`}>
                        {log.status === 'success' ? <CheckCircle2 className="w-3 h-3" /> :
                         log.status === 'error' ? <XCircle className="w-3 h-3" /> :
                         <AlertTriangle className="w-3 h-3" />}
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2 text-gray-500 dark:text-gray-400 text-xs max-w-[200px] truncate">
                      {log.message || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
