'use client';

import { useEffect, useState, useCallback, useRef, Component, type ReactNode, type ErrorInfo } from 'react';
import { api, auth } from '@/lib/api';
import {
  Factory, ArrowLeft, Play, AlertTriangle, Wrench, Pause,
  Clock, ShieldAlert, CalendarOff, Flag, ChevronRight,
  Plus, Minus, Send, X, CheckCircle2, Loader2, WifiOff, Wifi,
  LogOut, UserCircle, Camera,
} from 'lucide-react';
import { BarcodeScanner } from '@/components/ui/BarcodeScanner';
import { useTranslations } from 'next-intl';

// ── Error Boundary ────────────────────────────────────────────────────

interface ErrorBoundaryState { hasError: boolean; error: Error | null }

class ShopFloorErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ShopFloor] Render error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white p-8">
          <div className="relative">
            <div className="absolute inset-0 blur-2xl bg-red-500/20 rounded-full" />
            <AlertTriangle className="relative w-16 h-16 text-red-400 mb-4" />
          </div>
          <h1 className="text-2xl font-bold mb-2 mt-4">Something went wrong</h1>
          <p className="text-gray-400 mb-6 text-center max-w-md">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-4 bg-gradient-to-b from-blue-500 to-blue-700 active:from-blue-600 active:to-blue-800 rounded-2xl font-bold text-lg shadow-lg shadow-blue-500/25"
            style={{ minHeight: 56, touchAction: 'manipulation' }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── useOnlineStatus hook ──────────────────────────────────────────────

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showReconnected, setShowReconnected] = useState(false);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      if (wasOfflineRef.current) {
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3000);
      }
      wasOfflineRef.current = false;
    };
    const goOffline = () => {
      setIsOnline(false);
      wasOfflineRef.current = true;
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return { isOnline, showReconnected };
}

// ── Retry wrapper ─────────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error('Retry failed'); // unreachable, satisfies TS
}

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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; glow: string; gradient: string }> = {
  running:      { label: 'Running',       color: 'bg-green-600 active:bg-green-700',     icon: Play,           glow: 'shadow-[0_0_20px_rgba(34,197,94,0.3)]',   gradient: 'from-green-500 to-green-700' },
  breakdown:    { label: 'Breakdown',     color: 'bg-red-600 active:bg-red-700',         icon: AlertTriangle,  glow: 'shadow-[0_0_20px_rgba(239,68,68,0.4)]',   gradient: 'from-red-500 to-red-700' },
  changeover:   { label: 'Changeover',    color: 'bg-yellow-500 active:bg-yellow-600',   icon: Wrench,         glow: 'shadow-[0_0_20px_rgba(234,179,8,0.3)]',   gradient: 'from-yellow-400 to-yellow-600' },
  quality_hold: { label: 'Quality Hold',  color: 'bg-purple-600 active:bg-purple-700',   icon: ShieldAlert,    glow: 'shadow-[0_0_20px_rgba(168,85,247,0.3)]',  gradient: 'from-purple-500 to-purple-700' },
  idle:         { label: 'Idle',          color: 'bg-gray-500 active:bg-gray-600',       icon: Pause,          glow: 'shadow-[0_0_12px_rgba(107,114,128,0.3)]', gradient: 'from-gray-400 to-gray-600' },
  maintenance:  { label: 'Maintenance',   color: 'bg-blue-600 active:bg-blue-700',       icon: Clock,          glow: 'shadow-[0_0_20px_rgba(59,130,246,0.3)]',  gradient: 'from-blue-500 to-blue-700' },
  planned_stop: { label: 'Planned Stop',  color: 'bg-orange-500 active:bg-orange-600',   icon: CalendarOff,    glow: 'shadow-[0_0_20px_rgba(249,115,22,0.3)]',  gradient: 'from-orange-400 to-orange-600' },
};

type Step = 'workstation' | 'po' | 'board' | 'close';

// ── Helpers ────────────────────────────────────────────────────────────

function elapsed(since: string): string {
  if (!since) return '—';
  const ms = Date.now() - new Date(since).getTime();
  if (isNaN(ms) || ms < 0) return '0m';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function statusDotColor(s: string): string {
  const map: Record<string, string> = {
    running: 'bg-green-500', breakdown: 'bg-red-500', changeover: 'bg-yellow-500',
    quality_hold: 'bg-purple-500', idle: 'bg-gray-400', maintenance: 'bg-blue-500',
    planned_stop: 'bg-orange-500',
  };
  return map[s] || 'bg-gray-500';
}

function statusBorderGlow(s: string): string {
  const map: Record<string, string> = {
    running: 'border-green-500/50 shadow-[0_0_12px_rgba(34,197,94,0.2)]',
    breakdown: 'border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.2)]',
    changeover: 'border-yellow-500/50 shadow-[0_0_12px_rgba(234,179,8,0.2)]',
    quality_hold: 'border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.2)]',
    idle: 'border-gray-500/30',
    maintenance: 'border-blue-500/50 shadow-[0_0_12px_rgba(59,130,246,0.2)]',
    planned_stop: 'border-orange-500/50 shadow-[0_0_12px_rgba(249,115,22,0.2)]',
  };
  return map[s] || 'border-gray-600';
}

function resolveReasonColor(color: string): string {
  if (color.startsWith('#')) return color;
  const map: Record<string, string> = {
    red: '#ef4444', orange: '#f97316', yellow: '#eab308', green: '#22c55e',
    blue: '#3b82f6', purple: '#a855f7', gray: '#6b7280',
  };
  return map[color] || color;
}

// ── Main Page ──────────────────────────────────────────────────────────

export default function ShopFloorPage() {
  const t = useTranslations('shopfloor');
  const [step, setStep] = useState<Step>('workstation');
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [selectedWs, setSelectedWs] = useState<Workstation | null>(null);
  const [availablePOs, setAvailablePOs] = useState<AvailablePO[]>([]);
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);
  const [reasonCodes, setReasonCodes] = useState<ReasonCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Barcode scanner
  const [showScanner, setShowScanner] = useState(false);

  // Close shift state
  const [closePoClosed, setClosePoClosed] = useState(false);
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

  // ── Animations ─────────────────────────────────────────────────────
  const animStyle = `
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes pulseGlow { 0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); } 50% { box-shadow: 0 0 20px 4px rgba(239,68,68,0.2); } }
    @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
    @keyframes slideInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes errorSlideIn { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
  `;

  // ── Online status ─────────────────────────────────────────────────
  const { isOnline, showReconnected } = useOnlineStatus();

  // ── Screen Wake Lock ──────────────────────────────────────────────
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const acquireWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        wakeLockRef.current?.addEventListener('release', () => {
          wakeLockRef.current = null;
        });
      }
    } catch {
      // Wake Lock API not supported or permission denied — ignore
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release();
    wakeLockRef.current = null;
  }, []);

  // Acquire wake lock when on the board step, release otherwise
  useEffect(() => {
    if (step === 'board') {
      acquireWakeLock();
    } else {
      releaseWakeLock();
    }
    return () => releaseWakeLock();
  }, [step, acquireWakeLock, releaseWakeLock]);

  // Re-acquire wake lock on visibility change (tab focus)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && step === 'board') {
        acquireWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [step, acquireWakeLock]);

  // ── Auto-refresh active run every 30s while on board ──────────────
  useEffect(() => {
    if (step !== 'board' || !selectedWs) return;
    const interval = setInterval(async () => {
      try {
        const run = await api.get<ActiveRun>(`/shopfloor/workstation/${selectedWs.id}/active-run`).catch(() => null);
        if (run) {
          // Only update if counts changed to avoid unnecessary re-renders
          setActiveRun(prev => {
            if (!prev) return run;
            if (prev.producedQuantity !== run.producedQuantity || prev.scrapQuantity !== run.scrapQuantity || prev.events?.length !== run.events?.length) {
              return run;
            }
            return prev;
          });
          // Sync local counters if server has newer data
          setProduced(prev => run.producedQuantity !== prev ? run.producedQuantity : prev);
          setScrap(prev => run.scrapQuantity !== prev ? run.scrapQuantity : prev);
        }
      } catch {
        // Silently ignore refresh failures — will retry next interval
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [step, selectedWs]);

  // ── Data fetching ──────────────────────────────────────────────────

  const loadWorkstations = useCallback(async () => {
    setLoading(true);
    try {
      // TODO: Filter workstations by user assignment when implemented
      // For now, all site workstations are shown to all operators
      const wsRes = await api.get<any>('/workstations');
      const wsList = Array.isArray(wsRes) ? wsRes : wsRes?.data || [];
      setWorkstations(wsList.filter((w: any) => w.isActive !== false));
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
        api.get<any>(`/shopfloor/workstation/${wsId}/pos`),
        api.get<ActiveRun>(`/shopfloor/workstation/${wsId}/active-run`).catch(() => null),
      ]);
      setAvailablePOs(Array.isArray(pos) ? pos : pos?.data || []);
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
      const wsType = selectedWs?.type || '';
      const codes = await api.get<any>(`/shopfloor/reason-codes?category=${category}${wsType ? `&workstationType=${wsType}` : ''}`);
      setReasonCodes(Array.isArray(codes) ? codes : codes?.data || []);
    } catch { /* ignore */ }
  }, [selectedWs]);

  useEffect(() => {
    loadWorkstations();
  }, [loadWorkstations]);

  // Re-render every minute for elapsed time updates
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 60000);
    return () => clearInterval(t);
  }, []);

  // ── Browser back button support ────────────────────────────────────
  useEffect(() => {
    const onPopState = () => {
      // Browser back pressed — go to previous step instead of leaving page
      setStep(prev => {
        if (prev === 'close') return 'board';
        if (prev === 'board') {
          // Warn if there's an active run (activeRun is captured in closure via ref-like state)
          // We can't easily access activeRun here, so push state back and let goBack handle it
          setSelectedWs(null);
          setActiveRun(null);
          return 'workstation';
        }
        if (prev === 'po') {
          setSelectedWs(null);
          setActiveRun(null);
          return 'workstation';
        }
        return prev;
      });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Push history state on step changes so browser back works
  useEffect(() => {
    if (step !== 'workstation') {
      window.history.pushState({ step }, '', '/shopfloor');
    }
  }, [step]);

  // ── Actions ────────────────────────────────────────────────────────

  const selectWorkstation = (ws: Workstation) => {
    setSelectedWs(ws);
    loadPOsForWorkstation(ws.id);
  };

  const startRun = async (po: AvailablePO) => {
    if (!selectedWs) return;
    try {
      setLoading(true);
      await withRetry(() => api.post('/shopfloor/start-run', { phaseId: po.phaseId, workstationId: selectedWs.id }));
      await loadPOsForWorkstation(selectedWs.id);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const changeStatus = async (status: string, reasonCode?: string, notes?: string) => {
    if (!selectedWs) return;
    try {
      await withRetry(() => api.post('/shopfloor/status-change', {
        workstationId: selectedWs.id,
        status,
        ...(reasonCode ? { reasonCode } : {}),
        ...(notes ? { notes } : {}),
      }));
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
      await withRetry(() => api.post('/shopfloor/flag', { workstationId: selectedWs.id, notes: flagNote }));
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
      await withRetry(() => api.post(`/shopfloor/close-run/${activeRun.id}`, {
        producedQuantity: produced,
        scrapQuantity: scrap,
        notes: closeNote || undefined,
        completePo: closePoClosed,
      }));
      setActiveRun(null);
      setStep('po');
      setCloseNote('');
      // Refresh POs
      if (selectedWs) {
        const pos = await api.get<any>(`/shopfloor/workstation/${selectedWs.id}/pos`);
        setAvailablePOs(Array.isArray(pos) ? pos : pos?.data || []);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (step === 'close') { setStep('board'); return; }
    if (step === 'board' && activeRun) {
      const ok = window.confirm('You have an active run. Going back won\'t close it. Continue?');
      if (!ok) return;
    }
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-gray-800" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin" />
          <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-blue-400/50 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
        </div>
        <p className="mt-4 text-gray-500 text-sm font-medium tracking-wide">Loading workstations...</p>
      </div>
    );
  }

  return (
    <ShopFloorErrorBoundary>
    <style dangerouslySetInnerHTML={{ __html: animStyle }} />
    {/* touch-action: manipulation prevents double-tap zoom on all buttons */}
    {/* eslint-disable-next-line react/no-unknown-property */}
    <style>{`
      .shopfloor-root button, .shopfloor-root a, .shopfloor-root [role="button"] {
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
      }
      .shopfloor-root button { min-height: 48px; }
    `}</style>
    <div className="shopfloor-root min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white select-none">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      {/* Offline banner */}
      {!isOnline && (
        <div className="relative px-4 py-3 bg-gradient-to-r from-red-900/80 to-red-800/60 border-b border-red-700/50 flex items-center gap-3" style={{ animation: 'fadeIn 0.3s ease-out' }}>
          <WifiOff className="w-5 h-5 text-red-300 flex-shrink-0" />
          <span className="text-sm text-red-200 font-medium">No network connection — actions will retry when online</span>
        </div>
      )}
      {/* Reconnected banner */}
      {showReconnected && isOnline && (
        <div className="px-4 py-3 bg-gradient-to-r from-green-900/80 to-green-800/60 border-b border-green-700/50 flex items-center gap-3" style={{ animation: 'fadeIn 0.3s ease-out' }}>
          <Wifi className="w-5 h-5 text-green-300 flex-shrink-0" />
          <span className="text-sm text-green-200 font-medium">Reconnected</span>
        </div>
      )}

      {/* Header */}
      <header className="relative flex items-center justify-between px-4 py-3 bg-gray-900/80 border-b border-gray-800/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          {step !== 'workstation' && (
            <button onClick={goBack} className="p-2 rounded-xl active:bg-gray-700/50 hover:bg-gray-800/50 transition-colors" aria-label="Back">
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}
          <div className="relative">
            <Factory className="w-6 h-6 text-blue-400" />
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          </div>
          <span className="font-bold text-lg tracking-tight">Shop Floor</span>
        </div>
        <div className="flex items-center gap-3">
          {selectedWs && (
            <div className="text-right" style={{ animation: 'slideInRight 0.3s ease-out' }}>
              <div className="text-xs text-gray-500 font-medium tracking-wider uppercase">{selectedWs.code}</div>
              <div className="font-semibold">{selectedWs.name}</div>
            </div>
          )}
          {!selectedWs && (
            <div className="flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-gray-500" />
              <span className="text-sm text-gray-400">{auth.getUser()?.firstName || 'User'}</span>
            </div>
          )}
          <button
            onClick={() => {
              if (activeRun) {
                if (!window.confirm('You have an active run. Logging out won\'t close it. Continue?')) return;
              }
              auth.logout();
            }}
            className="p-2 rounded-xl active:bg-gray-700/50 hover:bg-gray-800/50 text-gray-500 hover:text-white transition-all"
            aria-label="Log out"
            title="Log out / Switch user"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Error toast */}
      {error && (
        <div
          className="mx-4 mt-3 p-3 bg-red-950/60 border border-red-800/50 border-l-4 border-l-red-500 rounded-2xl flex items-center justify-between backdrop-blur-sm"
          style={{ animation: 'errorSlideIn 0.3s ease-out' }}
        >
          <span className="text-sm text-red-200 font-medium">{error}</span>
          <button onClick={() => setError('')} className="p-1.5 rounded-lg hover:bg-red-900/50 transition-colors" aria-label="Dismiss error"><X className="w-4 h-4 text-red-400" /></button>
        </div>
      )}

      {/* ── STEP 1: Workstation Select ──────────────────────────────── */}
      {step === 'workstation' && (
        <div className="relative p-4">
          <h2 className="text-2xl font-bold mb-1 tracking-tight">{t('selectWorkstation')}</h2>
          <p className="text-sm text-gray-500 mb-5">Tap to start your shift</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {workstations.map((ws, idx) => (
              <button
                key={ws.id}
                onClick={() => selectWorkstation(ws)}
                className={`relative p-4 rounded-2xl border ${statusBorderGlow(ws.currentStatus)} bg-gray-900/80 text-left active:scale-[0.98] hover:scale-[1.01] transition-all duration-200`}
                style={{ animation: `fadeIn 0.4s ease-out ${idx * 0.06}s both` }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-xl tracking-tight">{ws.name}</div>
                    <div className="text-sm text-gray-500 mt-0.5">{ws.code} · {ws.area}</div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-gray-800/80 flex items-center justify-center">
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2.5">
                  {/* Pulsing status dot */}
                  <span className="relative flex h-3 w-3">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusDotColor(ws.currentStatus)}`} />
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${statusDotColor(ws.currentStatus)}`} />
                  </span>
                  <span className="text-sm font-medium capitalize">{STATUS_CONFIG[ws.currentStatus]?.label || ws.currentStatus}</span>
                  <span className="text-xs text-gray-600 ml-auto tabular-nums">{elapsed(ws.statusSince)}</span>
                </div>
                {ws.currentPO && (
                  <div className="mt-2.5 text-sm text-gray-500 bg-gray-800/50 rounded-lg px-2.5 py-1.5 -mx-0.5">
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
        <div className="relative p-4">
          <h2 className="text-2xl font-bold mb-1 tracking-tight">{t('selectPO')}</h2>
          <p className="text-sm text-gray-500 mb-5">Choose the order to work on</p>

          <div className="mb-4 flex gap-3">
            <button
              onClick={() => setShowScanner(true)}
              className="flex-1 flex items-center justify-center gap-3 p-4 rounded-xl bg-blue-600 active:bg-blue-700 font-bold text-lg"
              style={{ minHeight: 64 }}
            >
              <Camera className="w-7 h-7" /> Scan PO Barcode
            </button>
          </div>

          {showScanner && (
            <BarcodeScanner
              onScan={(code) => {
                setShowScanner(false);
                const po = availablePOs.find(p => p.poNumber === code);
                if (po) {
                  startRun(po);
                } else {
                  setError(`No matching PO found for barcode: ${code}`);
                }
              }}
              onClose={() => setShowScanner(false)}
            />
          )}

          {/* Manual PO input */}
          <form
            className="mb-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const input = (e.currentTarget.elements.namedItem('manualPo') as HTMLInputElement)?.value?.trim();
              if (!input) return;
              const po = availablePOs.find(p => p.poNumber.toLowerCase() === input.toLowerCase());
              if (po) {
                startRun(po);
              } else {
                setError(`No matching PO found: ${input}`);
              }
            }}
          >
            <input
              name="manualPo"
              type="text"
              placeholder="Enter PO number manually..."
              className="flex-1 px-4 py-3 rounded-xl bg-gray-900/80 border border-gray-700 text-white text-lg placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{ minHeight: 56 }}
              autoComplete="off"
            />
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-green-600 active:bg-green-700 font-bold text-lg"
              style={{ minHeight: 56 }}
            >
              GO
            </button>
          </form>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-700" />
            <span className="text-xs text-gray-600 font-medium uppercase tracking-wider">or select from list</span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>

          {availablePOs.length === 0 ? (
            <div className="text-center py-16 text-gray-500" style={{ animation: 'fadeIn 0.4s ease-out' }}>
              <div className="relative inline-block">
                <div className="absolute inset-0 blur-xl bg-gray-500/10 rounded-full" />
                <CalendarOff className="relative w-14 h-14 mx-auto mb-4 opacity-40" />
              </div>
              <p className="text-lg font-medium text-gray-600">No orders assigned</p>
              <p className="text-sm text-gray-700 mt-1">No production orders for this workstation</p>
            </div>
          ) : (
            <div className="space-y-3">
              {availablePOs.map((po, idx) => {
                const poProg = po.targetQuantity > 0 ? Math.round((po.producedQuantity / po.targetQuantity) * 100) : 0;
                return (
                  <button
                    key={po.phaseId}
                    onClick={() => startRun(po)}
                    className="w-full p-4 rounded-2xl bg-gray-900/80 text-left active:scale-[0.98] hover:scale-[1.01] border border-gray-800/80 transition-all duration-200 hover:border-gray-700/80"
                    style={{ animation: `slideUp 0.4s ease-out ${idx * 0.08}s both` }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-xl tracking-tight">{po.poNumber}</div>
                        <div className="text-sm text-gray-500 mt-0.5">{po.productName}</div>
                      </div>
                      {po.priority === 'urgent' && (
                        <span className="px-2.5 py-1 bg-red-500/15 text-red-400 text-xs font-bold rounded-lg border border-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.15)]">URGENT</span>
                      )}
                      {po.priority === 'high' && (
                        <span className="px-2.5 py-1 bg-yellow-500/15 text-yellow-400 text-xs font-bold rounded-lg border border-yellow-500/20">HIGH</span>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-gray-500">
                      Phase {po.sequence}: {po.phaseName} · Cycle: {po.cycleTimeSeconds}s
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex-1 h-2.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500"
                          style={{ width: `${poProg}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold tabular-nums">{po.producedQuantity}<span className="text-gray-600 font-normal">/{po.targetQuantity}</span> <span className="text-gray-600 text-xs">{po.unit}</span></span>
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
        <div className="relative p-4 space-y-4">
          {/* Current STATUS banner — big, visible, color-coded */}
          {(() => {
            const cfg = STATUS_CONFIG[currentStatus];
            const Icon = cfg?.icon || Play;
            const statusEvent = activeRun.events?.find(e => e.status);
            const statusSince = statusEvent?.timestamp || activeRun.startedAt;
            const isBreakdown = currentStatus === 'breakdown';
            return (
              <div
                className={`p-5 rounded-2xl flex items-center justify-between bg-gradient-to-r ${cfg?.gradient || 'from-green-500 to-green-700'} ${cfg?.glow || ''} ${isBreakdown ? '' : ''}`}
                style={{
                  animation: `scaleIn 0.3s ease-out, ${isBreakdown ? 'pulseGlow 2s ease-in-out infinite' : 'none'}`,
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
                    <Icon className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="text-2xl font-black tracking-wide">{(cfg?.label || 'RUNNING').toUpperCase()}</div>
                    {statusEvent?.reasonCode && (
                      <div className="text-sm opacity-80 mt-0.5">Reason: {statusEvent.reasonCode}</div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold tabular-nums">{elapsed(statusSince)}</div>
                  <div className="text-xs opacity-60 font-medium tracking-wide">IN THIS STATUS</div>
                </div>
              </div>
            );
          })()}

          {/* Current PO info bar */}
          <div className="p-5 rounded-2xl bg-gray-900/80 border border-gray-800/80" style={{ animation: 'fadeIn 0.4s ease-out 0.1s both' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-xs text-gray-500 font-medium tracking-wider uppercase">Current Order</span>
                <div className="font-bold text-xl tracking-tight mt-0.5">{currentPO?.poNumber}</div>
                <div className="text-sm text-gray-500">{currentPO?.productName} — {activeRun.phase.name}</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black text-blue-400 tabular-nums">{produced}<span className="text-base text-gray-600 font-medium">/{target}</span></div>
                <div className="text-xs text-gray-600 font-medium">{currentPO?.unit}</div>
              </div>
            </div>
            {/* Progress bar with gradient */}
            <div className="h-3.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${progress >= 100 ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs">
              <span className="text-gray-500 font-medium">{progress}% complete</span>
              <span className="text-gray-600 tabular-nums">Running {elapsed(activeRun.startedAt)}</span>
            </div>
          </div>

          {/* Status buttons - BIG, glove-friendly */}
          <div className="grid grid-cols-2 gap-3" style={{ animation: 'fadeIn 0.4s ease-out 0.2s both' }}>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon;
              const isActive = currentStatus === key;
              return (
                <button
                  key={key}
                  onClick={() => handleStatusClick(key)}
                  className={`flex items-center gap-3 p-4 rounded-2xl font-bold text-lg hover:scale-[1.02] active:scale-[0.95] transition-all duration-200
                    ${isActive
                      ? `bg-gradient-to-b ${cfg.gradient} ring-2 ring-white/20 ${cfg.glow}`
                      : 'bg-gradient-to-b from-gray-800 to-gray-850 border border-gray-700/60 hover:border-gray-600/60 active:from-gray-750 active:to-gray-800'}
                  `}
                  style={{ minHeight: 64 }}
                >
                  <Icon className={`w-7 h-7 flex-shrink-0 ${isActive ? '' : 'opacity-70'}`} />
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>

          {/* Flag button */}
          <button
            onClick={() => setShowFlag(true)}
            className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-gradient-to-b from-amber-500 to-amber-700 active:from-amber-600 active:to-amber-800 font-bold text-lg hover:scale-[1.02] active:scale-[0.95] transition-all duration-200 shadow-lg shadow-amber-500/15"
            style={{ minHeight: 64, animation: 'fadeIn 0.4s ease-out 0.3s both' }}
          >
            <Flag className="w-7 h-7" />
            {t('flagIssue')}
          </button>

          {/* {t('endShift')} buttons */}
          <div className="grid grid-cols-2 gap-3" style={{ animation: 'fadeIn 0.4s ease-out 0.35s both' }}>
            <button
              onClick={() => { setClosePoClosed(false); setStep('close'); }}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-gradient-to-b from-blue-600 to-blue-800 active:from-blue-700 active:to-blue-900 font-bold text-base hover:scale-[1.02] active:scale-[0.95] transition-all duration-200 shadow-lg shadow-blue-500/15"
              style={{ minHeight: 80 }}
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-0.5">
                <Send className="w-5 h-5" />
              </div>
              {t('endShift')}
              <span className="text-xs font-normal opacity-60">PO stays open</span>
            </button>
            <button
              onClick={() => { setClosePoClosed(true); setStep('close'); }}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-gradient-to-b from-green-600 to-green-800 active:from-green-700 active:to-green-900 font-bold text-base hover:scale-[1.02] active:scale-[0.95] transition-all duration-200 shadow-lg shadow-green-500/15"
              style={{ minHeight: 80 }}
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-0.5">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              {t('endShift')}
              <span className="text-xs font-normal opacity-60">PO complete</span>
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Close Shift ─────────────────────────────────────── */}
      {step === 'close' && (
        <div className="relative p-4 space-y-6" style={{ animation: 'fadeIn 0.4s ease-out' }}>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">End My Shift {closePoClosed ? '— PO Complete' : '— PO Open'}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {closePoClosed
                ? 'Record final quantities. This production order will be marked as completed.'
                : 'Record your output. The PO stays open for the next operator.'}
            </p>
          </div>

          {/* Produced counter */}
          <div className="bg-gray-900/80 rounded-2xl p-6 border border-gray-800/80 focus-within:border-blue-500/40 focus-within:shadow-[0_0_20px_rgba(59,130,246,0.1)] transition-all duration-300">
            <label className="text-xs text-gray-500 font-medium tracking-wider uppercase block mb-4">Total Produced</label>
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => setProduced(p => Math.max(0, p - 1))}
                className="w-16 h-16 rounded-2xl bg-gradient-to-b from-gray-700 to-gray-800 active:from-gray-600 active:to-gray-700 flex items-center justify-center hover:scale-[1.05] active:scale-[0.92] transition-all duration-200 shadow-inner"
              >
                <Minus className="w-8 h-8" />
              </button>
              <button
                onClick={() => { setNumpadTarget('produced'); setNumpadValue(String(produced)); }}
                className="text-5xl font-black tabular-nums min-w-[130px] text-center hover:bg-gray-800/50 rounded-2xl py-3 transition-all duration-200 hover:scale-[1.03]"
              >
                {produced}
              </button>
              <button
                onClick={() => setProduced(p => p + 1)}
                className="w-16 h-16 rounded-2xl bg-gradient-to-b from-green-600 to-green-800 active:from-green-500 active:to-green-700 flex items-center justify-center hover:scale-[1.05] active:scale-[0.92] transition-all duration-200 shadow-lg shadow-green-500/20"
              >
                <Plus className="w-8 h-8" />
              </button>
            </div>
          </div>

          {/* Scrap counter */}
          <div className="bg-gray-900/80 rounded-2xl p-6 border border-gray-800/80 focus-within:border-red-500/40 focus-within:shadow-[0_0_20px_rgba(239,68,68,0.1)] transition-all duration-300">
            <label className="text-xs text-gray-500 font-medium tracking-wider uppercase block mb-4">Total Scrap</label>
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => setScrap(s => Math.max(0, s - 1))}
                className="w-16 h-16 rounded-2xl bg-gradient-to-b from-gray-700 to-gray-800 active:from-gray-600 active:to-gray-700 flex items-center justify-center hover:scale-[1.05] active:scale-[0.92] transition-all duration-200 shadow-inner"
              >
                <Minus className="w-8 h-8" />
              </button>
              <button
                onClick={() => { setNumpadTarget('scrap'); setNumpadValue(String(scrap)); }}
                className="text-5xl font-black tabular-nums text-red-400 min-w-[130px] text-center hover:bg-gray-800/50 rounded-2xl py-3 transition-all duration-200 hover:scale-[1.03]"
              >
                {scrap}
              </button>
              <button
                onClick={() => setScrap(s => s + 1)}
                className="w-16 h-16 rounded-2xl bg-gradient-to-b from-red-600 to-red-800 active:from-red-500 active:to-red-700 flex items-center justify-center hover:scale-[1.05] active:scale-[0.92] transition-all duration-200 shadow-lg shadow-red-500/20"
              >
                <Plus className="w-8 h-8" />
              </button>
            </div>
          </div>

          {/* Note */}
          <div className="bg-gray-900/60 rounded-2xl p-4 border border-gray-800/60 backdrop-blur-sm">
            <label className="text-xs text-gray-500 font-medium tracking-wider uppercase block mb-2">Note for next shift (optional)</label>
            <textarea
              value={closeNote}
              onChange={e => setCloseNote(e.target.value)}
              className="w-full bg-gray-800/50 backdrop-blur-sm rounded-xl p-3 text-white border border-gray-700/50 resize-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/30 outline-none transition-all duration-200 placeholder:text-gray-600"
              rows={3}
              placeholder="Any handover notes..."
            />
          </div>

          {/* Submit */}
          <button
            onClick={closeRun}
            disabled={loading}
            className={`w-full flex items-center justify-center gap-3 p-5 rounded-2xl font-bold text-lg disabled:opacity-50 hover:scale-[1.02] active:scale-[0.95] transition-all duration-200 shadow-lg ${
              closePoClosed
                ? 'bg-gradient-to-b from-green-500 to-green-700 active:from-green-600 active:to-green-800 shadow-green-500/20'
                : 'bg-gradient-to-b from-blue-500 to-blue-700 active:from-blue-600 active:to-blue-800 shadow-blue-500/20'
            }`}
            style={{ minHeight: 64 }}
          >
            {loading ? (
              <div className="relative w-6 h-6">
                <div className="absolute inset-0 rounded-full border-2 border-white/30" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-white animate-spin" />
              </div>
            ) : closePoClosed ? <CheckCircle2 className="w-6 h-6" /> : <Send className="w-6 h-6" />}
            {closePoClosed ? t('confirmCompletePO') : t('confirmEndShift')}
          </button>
        </div>
      )}

      {/* ── Reason Code Picker Modal ────────────────────────────────── */}
      {showReasons && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center" style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <div
            className="w-full max-w-lg bg-gray-900 border border-gray-800/80 rounded-t-3xl sm:rounded-3xl p-5 max-h-[80vh] overflow-y-auto shadow-2xl"
            style={{ animation: 'scaleIn 0.25s ease-out' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold tracking-tight flex items-center gap-3">
                {(() => {
                  const Icon = STATUS_CONFIG[pendingStatus]?.icon;
                  return Icon ? <div className={`w-8 h-8 rounded-lg bg-gradient-to-b ${STATUS_CONFIG[pendingStatus]?.gradient} flex items-center justify-center`}><Icon className="w-4 h-4" /></div> : null;
                })()}
                Select Reason
              </h3>
              <button onClick={() => { setShowReasons(false); setPendingStatus(''); }} className="p-2 rounded-xl hover:bg-gray-800 transition-colors" aria-label="Close">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-2">
              {reasonCodes.map((rc, idx) => (
                <button
                  key={rc.id}
                  onClick={() => changeStatus(pendingStatus, rc.code)}
                  className="w-full p-4 rounded-2xl bg-gray-800/80 active:bg-gray-700 hover:bg-gray-800 text-left flex items-center gap-3 border border-gray-700/50 hover:border-gray-600/50 hover:scale-[1.01] active:scale-[0.98] transition-all duration-200 group"
                  style={{ minHeight: 56, animation: `fadeIn 0.3s ease-out ${idx * 0.05}s both` }}
                >
                  <span
                    className="w-4 h-4 rounded-full flex-shrink-0 ring-2 ring-transparent group-hover:ring-offset-2 group-hover:ring-offset-gray-800 transition-all duration-200"
                    style={{
                      backgroundColor: resolveReasonColor(rc.color),
                      boxShadow: `0 0 0 0 ${resolveReasonColor(rc.color)}`,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.boxShadow = `0 0 12px 2px ${resolveReasonColor(rc.color)}40`)}
                    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = `0 0 0 0 ${resolveReasonColor(rc.color)}`)}
                  />
                  <div>
                    <div className="font-bold">{rc.code}</div>
                    <div className="text-sm text-gray-500">{rc.label}</div>
                  </div>
                </button>
              ))}
              {reasonCodes.length === 0 && (
                <button
                  onClick={() => changeStatus(pendingStatus)}
                  className="w-full p-4 rounded-2xl bg-gray-800/80 active:bg-gray-700 hover:bg-gray-800 text-center font-bold border border-gray-700/50 hover:scale-[1.01] active:scale-[0.98] transition-all duration-200"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center" style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <div
            className="w-full max-w-lg bg-gray-900 border border-gray-800/80 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl"
            style={{ animation: 'scaleIn 0.25s ease-out' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold tracking-tight flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-b from-amber-500 to-amber-700 flex items-center justify-center">
                  <Flag className="w-4 h-4" />
                </div>
                {t('flagIssue')}
              </h3>
              <button onClick={() => { setShowFlag(false); setFlagNote(''); }} className="p-2 rounded-xl hover:bg-gray-800 transition-colors" aria-label="Close">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <textarea
              value={flagNote}
              onChange={e => setFlagNote(e.target.value)}
              className="w-full bg-gray-800/50 backdrop-blur-sm rounded-xl p-3 text-white border border-gray-700/50 resize-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/30 outline-none transition-all duration-200 placeholder:text-gray-600"
              rows={4}
              placeholder="Describe the issue..."
              autoFocus
            />
            <button
              onClick={sendFlag}
              disabled={!flagNote.trim()}
              className="w-full mt-4 p-4 rounded-2xl bg-gradient-to-b from-amber-500 to-amber-700 active:from-amber-600 active:to-amber-800 font-bold text-lg disabled:opacity-40 hover:scale-[1.02] active:scale-[0.95] transition-all duration-200 shadow-lg shadow-amber-500/20"
              style={{ minHeight: 56 }}
            >
              Send Flag
            </button>
          </div>
        </div>
      )}

      {/* ── Numpad Modal ────────────────────────────────────────────── */}
      {numpadTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center" style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <div
            className="w-full max-w-sm bg-gray-900 border border-gray-800/80 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl"
            style={{ animation: 'scaleIn 0.25s ease-out' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold tracking-tight">
                {numpadTarget === 'produced' ? 'Total Produced' : 'Total Scrap'}
              </h3>
              <button onClick={() => setNumpadTarget(null)} className="p-2 rounded-xl hover:bg-gray-800 transition-colors" aria-label="Close">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            {/* Display */}
            <div className={`text-center text-5xl font-black tabular-nums py-5 rounded-2xl bg-gray-950 border border-gray-800/50 mb-4 ${numpadTarget === 'scrap' ? 'text-red-400' : 'text-white'}`}>
              {numpadValue || '0'}
            </div>
            {/* Numpad grid */}
            <div className="grid grid-cols-3 gap-2.5">
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
                  className={`h-16 rounded-2xl font-bold text-2xl hover:scale-[1.04] active:scale-[0.92] transition-all duration-150 ${
                    key === 'OK'
                      ? 'bg-gradient-to-b from-blue-500 to-blue-700 active:from-blue-600 active:to-blue-800 text-white shadow-lg shadow-blue-500/20'
                      : key === 'DEL'
                      ? 'bg-gradient-to-b from-gray-600 to-gray-700 active:from-gray-500 active:to-gray-600 text-white'
                      : 'bg-gradient-to-b from-gray-750 to-gray-800 active:from-gray-700 active:to-gray-750 text-white border border-gray-700/40'
                  }`}
                >
                  {key === 'DEL' ? '\u232B' : key}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
    </ShopFloorErrorBoundary>
  );
}
