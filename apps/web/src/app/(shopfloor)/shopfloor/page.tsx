'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, auth } from '@/lib/api';
import {
  Factory, ArrowLeft, Play, AlertTriangle, Wrench, Pause,
  Clock, ShieldAlert, CalendarOff, Flag, ChevronRight,
  Plus, Minus, Send, X, CheckCircle2, Loader2,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────

interface Workstation {
  id: string;
  name: string;
  code: string;
  type: string;
  area: string;
  isActive?: boolean;
  currentStatus: string;
  statusSince: string;
  currentPO?: { poNumber: string; productName: string; phaseName: string; produced: number };
}

interface AvailablePO {
  phaseId: string;
  sequence: number;
  phaseName: string;
  cycleTimeSeconds: number;
  poNumber: string;
  productName: string;
  targetQuantity: number;
  unit: string;
  priority: string;
  dueDate?: string;
  producedQuantity: number;
  scrapQuantity: number;
}

interface ActiveRun {
  id: string;
  phaseId: string;
  startedAt: string;
  producedQuantity: number;
  scrapQuantity: number;
  phase: {
    name: string;
    cycleTimeSeconds: number;
    order: { poNumber: string; productName: string; targetQuantity: number; unit: string };
  };
  events: Array<{ eventType: string; status?: string; reasonCode?: string; notes?: string; timestamp: string }>;
}

interface ReasonCode {
  id: string;
  category: string;
  code: string;
  label: string;
  color: string;
}

// ── Constants ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  running:      { label: 'Running',       color: 'bg-green-600 active:bg-green-700',     icon: Play },
  breakdown:    { label: 'Breakdown',     color: 'bg-red-600 active:bg-red-700',         icon: AlertTriangle },
  changeover:   { label: 'Changeover',    color: 'bg-yellow-500 active:bg-yellow-600',   icon: Wrench },
  quality_hold: { label: 'Quality Hold',  color: 'bg-purple-600 active:bg-purple-700',   icon: ShieldAlert },
  idle:         { label: 'Idle',          color: 'bg-gray-500 active:bg-gray-600',       icon: Pause },
  maintenance:  { label: 'Maintenance',   color: 'bg-blue-600 active:bg-blue-700',       icon: Clock },
  planned_stop: { label: 'Planned Stop',  color: 'bg-orange-500 active:bg-orange-600',   icon: CalendarOff },
};

type Step = 'workstation' | 'po' | 'board' | 'close';

// ── Helpers ────────────────────────────────────────────────────────────

function elapsed(since: string): string {
  if (!since) return '—';
  const ms = Date.now() - new Date(since).getTime();
  if (isNaN(ms)) return '—';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function statusColor(s: string): string {
  const map: Record<string, string> = {
    running: 'border-green-500', breakdown: 'border-red-500', changeover: 'border-yellow-500',
    quality_hold: 'border-purple-500', idle: 'border-gray-400', maintenance: 'border-blue-500',
    planned_stop: 'border-orange-500',
  };
  return map[s] || 'border-gray-600';
}

// ── Main Page ──────────────────────────────────────────────────────────

export default function ShopFloorPage() {
  const [step, setStep] = useState<Step>('workstation');
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [selectedWs, setSelectedWs] = useState<Workstation | null>(null);
  const [availablePOs, setAvailablePOs] = useState<AvailablePO[]>([]);
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);
  const [reasonCodes, setReasonCodes] = useState<ReasonCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Close shift state
  const [produced, setProduced] = useState(0);
  const [scrap, setScrap] = useState(0);
  const [closeNote, setCloseNote] = useState('');

  // Reason code picker
  const [showReasons, setShowReasons] = useState(false);
  const [pendingStatus, setPendingStatus] = useState('');

  // Flag modal
  const [showFlag, setShowFlag] = useState(false);
  const [flagNote, setFlagNote] = useState('');

  // Numpad modal
  const [numpadTarget, setNumpadTarget] = useState<'produced' | 'scrap' | null>(null);
  const [numpadValue, setNumpadValue] = useState('');

  // ── Data fetching ──────────────────────────────────────────────────

  const loadWorkstations = useCallback(async () => {
    setLoading(true);
    try {
      const ws = await api.get<Workstation[]>('/workstations');
      setWorkstations(Array.isArray(ws) ? ws.filter(w => w.isActive !== false) : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPOsForWorkstation = useCallback(async (wsId: string) => {
    setLoading(true);
    try {
      const [pos, run] = await Promise.all([
        api.get<AvailablePO[]>(`/shopfloor/workstation/${wsId}/pos`),
        api.get<ActiveRun>(`/shopfloor/workstation/${wsId}/active-run`).catch(() => null),
      ]);
      setAvailablePOs(Array.isArray(pos) ? pos : []);
      setActiveRun(run);
      if (run) {
        setProduced(run.producedQuantity);
        setScrap(run.scrapQuantity);
        setStep('board');
      } else {
        setStep('po');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReasonCodes = useCallback(async (category: string) => {
    try {
      const codes = await api.get<ReasonCode[]>(`/shopfloor/reason-codes?category=${category}`);
      setReasonCodes(Array.isArray(codes) ? codes : []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadWorkstations();
  }, [loadWorkstations]);

  // Re-render every minute for elapsed time updates
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 60000);
    return () => clearInterval(t);
  }, []);

  // ── Actions ────────────────────────────────────────────────────────

  const selectWorkstation = (ws: Workstation) => {
    setSelectedWs(ws);
    loadPOsForWorkstation(ws.id);
  };

  const startRun = async (po: AvailablePO) => {
    if (!selectedWs) return;
    try {
      setLoading(true);
      await api.post('/shopfloor/start-run', { phaseId: po.phaseId, workstationId: selectedWs.id });
      await loadPOsForWorkstation(selectedWs.id);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const changeStatus = async (status: string, reasonCode?: string, notes?: string) => {
    if (!selectedWs) return;
    try {
      await api.post('/shopfloor/status-change', {
        workstationId: selectedWs.id,
        status,
        ...(reasonCode ? { reasonCode } : {}),
        ...(notes ? { notes } : {}),
      });
      // Refresh active run
      const run = await api.get<ActiveRun>(`/shopfloor/workstation/${selectedWs.id}/active-run`).catch(() => null);
      setActiveRun(run);
      setShowReasons(false);
      setPendingStatus('');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleStatusClick = (status: string) => {
    // Running doesn't need a reason code
    if (status === 'running') {
      changeStatus(status);
      return;
    }
    // Others need a reason code
    setPendingStatus(status);
    const categoryMap: Record<string, string> = {
      breakdown: 'breakdown', changeover: 'changeover', quality_hold: 'quality',
      idle: 'idle', maintenance: 'maintenance', planned_stop: 'planned_stop',
    };
    loadReasonCodes(categoryMap[status] || status);
    setShowReasons(true);
  };

  const sendFlag = async () => {
    if (!selectedWs || !flagNote.trim()) return;
    try {
      await api.post('/shopfloor/flag', { workstationId: selectedWs.id, notes: flagNote });
      setShowFlag(false);
      setFlagNote('');
      // Refresh
      const run = await api.get<ActiveRun>(`/shopfloor/workstation/${selectedWs.id}/active-run`).catch(() => null);
      setActiveRun(run);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const closeRun = async () => {
    if (!activeRun) return;
    try {
      setLoading(true);
      await api.post(`/shopfloor/close-run/${activeRun.id}`, {
        producedQuantity: produced,
        scrapQuantity: scrap,
        notes: closeNote || undefined,
      });
      setActiveRun(null);
      setStep('po');
      setCloseNote('');
      // Refresh POs
      if (selectedWs) {
        const pos = await api.get<AvailablePO[]>(`/shopfloor/workstation/${selectedWs.id}/pos`);
        setAvailablePOs(Array.isArray(pos) ? pos : []);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (step === 'close') { setStep('board'); return; }
    if (step === 'board' || step === 'po') { setStep('workstation'); setSelectedWs(null); setActiveRun(null); return; }
  };

  // ── Current run info ───────────────────────────────────────────────

  const currentPO = activeRun?.phase.order;
  const target = currentPO?.targetQuantity || 0;
  const progress = target > 0 ? Math.min(100, Math.round((produced / target) * 100)) : 0;
  // events are returned newest-first (ORDER BY timestamp DESC) from the API
  const currentStatus = activeRun?.events?.find(e => e.status)?.status || 'running';

  // ── Render ─────────────────────────────────────────────────────────

  if (loading && step === 'workstation' && workstations.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white select-none">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          {step !== 'workstation' && (
            <button onClick={goBack} className="p-2 rounded-lg active:bg-gray-700" aria-label="Back">
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}
          <Factory className="w-6 h-6 text-blue-400" />
          <span className="font-bold text-lg">Shop Floor</span>
        </div>
        {selectedWs && (
          <div className="text-right">
            <div className="text-sm text-gray-400">{selectedWs.code}</div>
            <div className="font-semibold">{selectedWs.name}</div>
          </div>
        )}
      </header>

      {/* Error toast */}
      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-900/50 border border-red-700 rounded-lg flex items-center justify-between">
          <span className="text-sm text-red-200">{error}</span>
          <button onClick={() => setError('')} aria-label="Dismiss error"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── STEP 1: Workstation Select ──────────────────────────────── */}
      {step === 'workstation' && (
        <div className="p-4">
          <h2 className="text-xl font-bold mb-4">Select Your Workstation</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {workstations.map(ws => (
              <button
                key={ws.id}
                onClick={() => selectWorkstation(ws)}
                className={`p-4 rounded-xl border-l-4 ${statusColor(ws.currentStatus)} bg-gray-800 text-left active:bg-gray-700 transition-colors`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-lg">{ws.name}</div>
                    <div className="text-sm text-gray-400">{ws.code} · {ws.area}</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_CONFIG[ws.currentStatus]?.color.split(' ')[0] || 'bg-gray-500'}`} />
                  <span className="text-sm capitalize">{STATUS_CONFIG[ws.currentStatus]?.label || ws.currentStatus}</span>
                  <span className="text-xs text-gray-500 ml-auto">{elapsed(ws.statusSince)}</span>
                </div>
                {ws.currentPO && (
                  <div className="mt-2 text-sm text-gray-400">
                    {ws.currentPO.poNumber} — {ws.currentPO.productName}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 2: PO Select ───────────────────────────────────────── */}
      {step === 'po' && (
        <div className="p-4">
          <h2 className="text-xl font-bold mb-4">Select Production Order</h2>
          {availablePOs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CalendarOff className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No orders assigned to this workstation</p>
            </div>
          ) : (
            <div className="space-y-3">
              {availablePOs.map(po => {
                const poProg = po.targetQuantity > 0 ? Math.round((po.producedQuantity / po.targetQuantity) * 100) : 0;
                return (
                  <button
                    key={po.phaseId}
                    onClick={() => startRun(po)}
                    className="w-full p-4 rounded-xl bg-gray-800 text-left active:bg-gray-700 border border-gray-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-lg">{po.poNumber}</div>
                        <div className="text-sm text-gray-400">{po.productName}</div>
                      </div>
                      {po.priority === 'urgent' && (
                        <span className="px-2 py-1 bg-red-900/50 text-red-300 text-xs font-bold rounded">URGENT</span>
                      )}
                      {po.priority === 'high' && (
                        <span className="px-2 py-1 bg-yellow-900/50 text-yellow-300 text-xs font-bold rounded">HIGH</span>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-gray-400">
                      Phase {po.sequence}: {po.phaseName} · Cycle: {po.cycleTimeSeconds}s
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${poProg}%` }} />
                      </div>
                      <span className="text-sm font-medium">{po.producedQuantity}/{po.targetQuantity} {po.unit}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: Status Board ────────────────────────────────────── */}
      {step === 'board' && activeRun && (
        <div className="p-4 space-y-4">
          {/* Current STATUS banner — big, visible, color-coded */}
          {(() => {
            const cfg = STATUS_CONFIG[currentStatus];
            const Icon = cfg?.icon || Play;
            const statusEvent = activeRun.events?.find(e => e.status);
            const statusSince = statusEvent?.timestamp || activeRun.startedAt;
            return (
              <div className={`p-4 rounded-xl flex items-center justify-between ${cfg?.color.split(' ')[0] || 'bg-green-600'}`}>
                <div className="flex items-center gap-3">
                  <Icon className="w-8 h-8" />
                  <div>
                    <div className="text-2xl font-black tracking-wide">{(cfg?.label || 'RUNNING').toUpperCase()}</div>
                    {statusEvent?.reasonCode && (
                      <div className="text-sm opacity-80">Reason: {statusEvent.reasonCode}</div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold tabular-nums">{elapsed(statusSince)}</div>
                  <div className="text-xs opacity-70">in this status</div>
                </div>
              </div>
            );
          })()}

          {/* Current PO info bar */}
          <div className="p-4 rounded-xl bg-gray-800 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-sm text-gray-400">Current Order</span>
                <div className="font-bold text-xl">{currentPO?.poNumber}</div>
                <div className="text-sm text-gray-400">{currentPO?.productName} — {activeRun.phase.name}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-400">{produced}<span className="text-sm text-gray-500">/{target}</span></div>
                <div className="text-xs text-gray-500">{currentPO?.unit}</div>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${progress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-500">
              <span>{progress}% complete</span>
              <span>Running {elapsed(activeRun.startedAt)}</span>
            </div>
          </div>

          {/* Status buttons - BIG, glove-friendly */}
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon;
              const isActive = currentStatus === key;
              return (
                <button
                  key={key}
                  onClick={() => handleStatusClick(key)}
                  className={`flex items-center gap-3 p-4 rounded-xl font-bold text-lg transition-all
                    ${isActive ? cfg.color + ' ring-2 ring-white/30 scale-[1.02]' : 'bg-gray-800 border border-gray-700 active:scale-95'}
                  `}
                  style={{ minHeight: 64 }}
                >
                  <Icon className="w-7 h-7 flex-shrink-0" />
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>

          {/* Flag button */}
          <button
            onClick={() => setShowFlag(true)}
            className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-amber-600 active:bg-amber-700 font-bold text-lg"
            style={{ minHeight: 64 }}
          >
            <Flag className="w-7 h-7" />
            Flag Issue
          </button>

          {/* Close shift button */}
          <button
            onClick={() => setStep('close')}
            className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-gray-700 active:bg-gray-600 font-bold text-lg border border-gray-600"
            style={{ minHeight: 64 }}
          >
            <CheckCircle2 className="w-7 h-7" />
            Close Shift / End Run
          </button>
        </div>
      )}

      {/* ── STEP 4: Close Shift ─────────────────────────────────────── */}
      {step === 'close' && (
        <div className="p-4 space-y-6">
          <h2 className="text-xl font-bold">Close Run</h2>

          {/* Produced counter */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <label className="text-sm text-gray-400 block mb-3">Total Produced</label>
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => setProduced(p => Math.max(0, p - 1))}
                className="w-16 h-16 rounded-xl bg-gray-700 active:bg-gray-600 flex items-center justify-center"
              >
                <Minus className="w-8 h-8" />
              </button>
              <button
                onClick={() => { setNumpadTarget('produced'); setNumpadValue(String(produced)); }}
                className="text-5xl font-bold tabular-nums min-w-[120px] text-center hover:bg-gray-700 rounded-xl py-2 transition-colors"
              >
                {produced}
              </button>
              <button
                onClick={() => setProduced(p => p + 1)}
                className="w-16 h-16 rounded-xl bg-green-700 active:bg-green-600 flex items-center justify-center"
              >
                <Plus className="w-8 h-8" />
              </button>
            </div>
          </div>

          {/* Scrap counter */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <label className="text-sm text-gray-400 block mb-3">Total Scrap</label>
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => setScrap(s => Math.max(0, s - 1))}
                className="w-16 h-16 rounded-xl bg-gray-700 active:bg-gray-600 flex items-center justify-center"
              >
                <Minus className="w-8 h-8" />
              </button>
              <button
                onClick={() => { setNumpadTarget('scrap'); setNumpadValue(String(scrap)); }}
                className="text-5xl font-bold tabular-nums text-red-400 min-w-[120px] text-center hover:bg-gray-700 rounded-xl py-2 transition-colors"
              >
                {scrap}
              </button>
              <button
                onClick={() => setScrap(s => s + 1)}
                className="w-16 h-16 rounded-xl bg-red-700 active:bg-red-600 flex items-center justify-center"
              >
                <Plus className="w-8 h-8" />
              </button>
            </div>
          </div>

          {/* Note */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <label className="text-sm text-gray-400 block mb-2">Note for next shift (optional)</label>
            <textarea
              value={closeNote}
              onChange={e => setCloseNote(e.target.value)}
              className="w-full bg-gray-700 rounded-lg p-3 text-white border-none resize-none focus:ring-2 focus:ring-blue-500 outline-none"
              rows={3}
              placeholder="Any handover notes..."
            />
          </div>

          {/* Submit */}
          <button
            onClick={closeRun}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-blue-600 active:bg-blue-700 font-bold text-lg disabled:opacity-50"
            style={{ minHeight: 64 }}
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
            Confirm & Close Run
          </button>
        </div>
      )}

      {/* ── Reason Code Picker Modal ────────────────────────────────── */}
      {showReasons && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-lg bg-gray-800 rounded-t-2xl sm:rounded-2xl p-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">
                Select Reason — {STATUS_CONFIG[pendingStatus]?.label}
              </h3>
              <button onClick={() => { setShowReasons(false); setPendingStatus(''); }} className="p-2" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              {reasonCodes.map(rc => (
                <button
                  key={rc.id}
                  onClick={() => changeStatus(pendingStatus, rc.code)}
                  className="w-full p-4 rounded-xl bg-gray-700 active:bg-gray-600 text-left flex items-center gap-3"
                  style={{ minHeight: 56 }}
                >
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: rc.color.startsWith('#') ? rc.color : ({ red:'#ef4444',orange:'#f97316',yellow:'#eab308',green:'#22c55e',blue:'#3b82f6',purple:'#a855f7',gray:'#6b7280' })[rc.color] || rc.color }} />
                  <div>
                    <div className="font-bold">{rc.code}</div>
                    <div className="text-sm text-gray-400">{rc.label}</div>
                  </div>
                </button>
              ))}
              {reasonCodes.length === 0 && (
                <button
                  onClick={() => changeStatus(pendingStatus)}
                  className="w-full p-4 rounded-xl bg-gray-700 active:bg-gray-600 text-center font-bold"
                >
                  Continue without reason code
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Flag Modal ──────────────────────────────────────────────── */}
      {showFlag && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-lg bg-gray-800 rounded-t-2xl sm:rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Flag className="w-5 h-5 text-amber-400" /> Flag Issue
              </h3>
              <button onClick={() => { setShowFlag(false); setFlagNote(''); }} className="p-2" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              value={flagNote}
              onChange={e => setFlagNote(e.target.value)}
              className="w-full bg-gray-700 rounded-lg p-3 text-white border-none resize-none focus:ring-2 focus:ring-amber-500 outline-none"
              rows={4}
              placeholder="Describe the issue..."
              autoFocus
            />
            <button
              onClick={sendFlag}
              disabled={!flagNote.trim()}
              className="w-full mt-3 p-4 rounded-xl bg-amber-600 active:bg-amber-700 font-bold text-lg disabled:opacity-50"
              style={{ minHeight: 56 }}
            >
              Send Flag
            </button>
          </div>
        </div>
      )}

      {/* ── Numpad Modal ────────────────────────────────────────────── */}
      {numpadTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-sm bg-gray-800 rounded-t-2xl sm:rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold">
                {numpadTarget === 'produced' ? 'Total Produced' : 'Total Scrap'}
              </h3>
              <button onClick={() => setNumpadTarget(null)} className="p-2" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Display */}
            <div className={`text-center text-5xl font-bold tabular-nums py-4 rounded-xl bg-gray-900 mb-3 ${numpadTarget === 'scrap' ? 'text-red-400' : 'text-white'}`}>
              {numpadValue || '0'}
            </div>
            {/* Numpad grid */}
            <div className="grid grid-cols-3 gap-2">
              {['1','2','3','4','5','6','7','8','9','DEL','0','OK'].map(key => (
                <button
                  key={key}
                  onClick={() => {
                    if (key === 'DEL') {
                      setNumpadValue(prev => prev.slice(0, -1));
                    } else if (key === 'OK') {
                      const val = Math.max(0, parseInt(numpadValue || '0', 10));
                      if (numpadTarget === 'produced') setProduced(val);
                      else setScrap(val);
                      setNumpadTarget(null);
                    } else {
                      setNumpadValue(prev => {
                        const next = prev === '0' ? key : prev + key;
                        return next.length <= 6 ? next : prev;
                      });
                    }
                  }}
                  className={`h-16 rounded-xl font-bold text-2xl transition-colors ${
                    key === 'OK'
                      ? 'bg-blue-600 active:bg-blue-700 text-white'
                      : key === 'DEL'
                      ? 'bg-gray-600 active:bg-gray-500 text-white'
                      : 'bg-gray-700 active:bg-gray-600 text-white'
                  }`}
                >
                  {key === 'DEL' ? '⌫' : key}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
