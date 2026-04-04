'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { Wifi, WifiOff, Volume2, VolumeX } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface Workstation {
  id: string;
  name: string;
  code: string;
  area: string;
  isActive?: boolean;
  currentStatus: string;
  statusSince: string;
  currentPO?: {
    poNumber: string;
    productName: string;
    phaseName: string;
    produced: number;
  };
}

const STATUS_CONFIG: Record<string, {
  label: string;
  bg: string;
  glow: string;
  ring: string;
  dot: string;
  gradient: string;
  pulse?: boolean;
}> = {
  running: {
    label: 'RUNNING',
    bg: 'from-emerald-900/80 to-emerald-950/80',
    glow: 'shadow-[0_0_30px_rgba(16,185,129,0.3)]',
    ring: 'ring-emerald-500/40',
    dot: 'bg-emerald-400',
    gradient: 'from-emerald-400 to-green-500',
  },
  breakdown: {
    label: 'BREAKDOWN',
    bg: 'from-red-900/80 to-red-950/80',
    glow: 'shadow-[0_0_40px_rgba(239,68,68,0.4)]',
    ring: 'ring-red-500/50',
    dot: 'bg-red-400',
    gradient: 'from-red-400 to-rose-500',
    pulse: true,
  },
  changeover: {
    label: 'CHANGEOVER',
    bg: 'from-amber-900/80 to-amber-950/80',
    glow: 'shadow-[0_0_25px_rgba(245,158,11,0.3)]',
    ring: 'ring-amber-500/40',
    dot: 'bg-amber-400',
    gradient: 'from-amber-400 to-yellow-500',
  },
  quality_hold: {
    label: 'QUALITY HOLD',
    bg: 'from-purple-900/80 to-purple-950/80',
    glow: 'shadow-[0_0_30px_rgba(168,85,247,0.3)]',
    ring: 'ring-purple-500/40',
    dot: 'bg-purple-400',
    gradient: 'from-purple-400 to-violet-500',
    pulse: true,
  },
  idle: {
    label: 'IDLE',
    bg: 'from-slate-800/80 to-slate-900/80',
    glow: 'shadow-[0_0_15px_rgba(100,116,139,0.2)]',
    ring: 'ring-slate-500/30',
    dot: 'bg-slate-400',
    gradient: 'from-slate-400 to-gray-500',
  },
  maintenance: {
    label: 'MAINTENANCE',
    bg: 'from-blue-900/80 to-blue-950/80',
    glow: 'shadow-[0_0_25px_rgba(59,130,246,0.3)]',
    ring: 'ring-blue-500/40',
    dot: 'bg-blue-400',
    gradient: 'from-blue-400 to-cyan-500',
  },
  planned_stop: {
    label: 'PLANNED STOP',
    bg: 'from-orange-900/80 to-orange-950/80',
    glow: 'shadow-[0_0_25px_rgba(249,115,22,0.3)]',
    ring: 'ring-orange-500/40',
    dot: 'bg-orange-400',
    gradient: 'from-orange-400 to-amber-500',
  },
};

const TIER_THRESHOLDS = { L1: 10, L2: 30, L3: 60 };

function elapsedMinutes(since: string): number {
  if (!since) return 0;
  const ms = Date.now() - new Date(since).getTime();
  return isNaN(ms) || ms < 0 ? 0 : Math.floor(ms / 60000);
}

function elapsed(since: string): string {
  if (!since) return '—';
  const ms = Date.now() - new Date(since).getTime();
  if (isNaN(ms) || ms < 0) return '0m';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function getEscalationTier(mins: number): { tier: string; color: string; strobe: boolean } | null {
  if (mins >= TIER_THRESHOLDS.L3) return { tier: 'L3', color: 'bg-red-500', strobe: true };
  if (mins >= TIER_THRESHOLDS.L2) return { tier: 'L2', color: 'bg-orange-500', strobe: false };
  if (mins >= TIER_THRESHOLDS.L1) return { tier: 'L1', color: 'bg-yellow-500', strobe: false };
  return null;
}

function getSocketUrl(): string {
  if (typeof window === 'undefined') return '';
  return `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/shopfloor`;
}

export default function AndonBoardPage() {
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [online, setOnline] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [loaded, setLoaded] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const prevBreakdownIds = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('andon_audio_enabled');
      if (saved === 'true') setAudioEnabled(true);
    }
  }, []);

  const toggleAudio = () => {
    setAudioEnabled(prev => {
      const next = !prev;
      localStorage.setItem('andon_audio_enabled', String(next));
      return next;
    });
  };

  const playAlertSound = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch { /* Audio not available */ }
  }, []);

  useEffect(() => {
    if (!audioEnabled || !loaded) return;
    const currentBreakdownIds = new Set(workstations.filter(ws => ws.currentStatus === 'breakdown').map(ws => ws.id));
    let hasNew = false;
    currentBreakdownIds.forEach(id => { if (!prevBreakdownIds.current.has(id)) hasNew = true; });
    if (hasNew) playAlertSound();
    prevBreakdownIds.current = currentBreakdownIds;
  }, [workstations, audioEnabled, loaded, playAlertSound]);

  const refresh = useCallback(async () => {
    try {
      const ws = await api.get<any>('/workstations');
      setWorkstations(Array.isArray(ws) ? ws.filter((w: any) => w.isActive !== false) : ws?.data?.filter((w: any) => w.isActive !== false) || []);
      setOnline(true);
      setLastUpdate(new Date());
    } catch { setOnline(false); } finally { setLoaded(true); }
  }, []);

  // WebSocket
  useEffect(() => {
    const socket = io(getSocketUrl(), { transports: ['websocket', 'polling'], reconnection: true, reconnectionDelay: 1000, reconnectionAttempts: Infinity });
    socketRef.current = socket;
    socket.on('connect', () => setWsConnected(true));
    socket.on('disconnect', () => setWsConnected(false));
    return () => { socket.disconnect(); socketRef.current = null; };
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || workstations.length === 0) return;
    const wsIds = new Set(workstations.map(w => w.id));
    const handler = (eventName: string, payload: any) => {
      if (!eventName.startsWith('status:') || !payload?.workstationId || !wsIds.has(payload.workstationId)) return;
      setWorkstations(prev => prev.map(ws => ws.id !== payload.workstationId ? ws : { ...ws, currentStatus: payload.status || ws.currentStatus, statusSince: payload.timestamp || ws.statusSince }));
      setLastUpdate(new Date());
    };
    socket.onAny(handler);
    return () => { socket.offAny(handler); };
  }, [workstations.length > 0]);

  useEffect(() => {
    refresh();
    const pollInterval = wsConnected ? 30000 : 5000;
    let interval = setInterval(refresh, pollInterval);
    const onVis = () => { clearInterval(interval); if (!document.hidden) { refresh(); interval = setInterval(refresh, pollInterval); } };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVis); };
  }, [refresh, wsConnected]);

  // Clock + elapsed update
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const cols = workstations.length <= 4 ? 2 : workstations.length <= 9 ? 3 : 4;

  // Counts
  const running = workstations.filter(w => w.currentStatus === 'running').length;
  const down = workstations.filter(w => ['breakdown', 'quality_hold'].includes(w.currentStatus)).length;
  const total = workstations.length;

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] text-white flex items-center justify-center">
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes spin-glow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}} />
        <div className="w-16 h-16 rounded-full border-4 border-blue-500/20 border-t-blue-400" style={{ animation: 'spin-glow 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white flex flex-col overflow-hidden select-none">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        @keyframes strobe { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes borderPulse { 0%, 100% { border-color: rgba(239,68,68,0.6); } 50% { border-color: rgba(239,68,68,0.15); } }
        @keyframes glowPulse { 0%, 100% { box-shadow: var(--glow-base); } 50% { box-shadow: var(--glow-bright); } }
        @keyframes scanline { 0% { transform: translateY(-100%); } 100% { transform: translateY(200vh); } }
        @keyframes glow-breathe { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        .animate-strobe { animation: strobe 0.8s ease-in-out infinite; }
        .animate-border-pulse { animation: borderPulse 1.5s ease-in-out infinite; }
        .grid-bg {
          background-image:
            linear-gradient(rgba(59,130,246,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.03) 1px, transparent 1px);
          background-size: 40px 40px;
        }
      `}} />

      {/* Scanline effect */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden opacity-[0.02]">
        <div className="w-full h-px bg-white" style={{ animation: 'scanline 8s linear infinite' }} />
      </div>

      {/* Background grid */}
      <div className="fixed inset-0 grid-bg pointer-events-none" />

      {/* ── HEADER BAR ─────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-6 py-3 bg-[#0d1220]/90 backdrop-blur-xl border-b border-blue-500/10">
        <div className="flex items-center gap-6">
          {/* Logo mark */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M6 18V8l3 3 3-3 3 3 3-3v10" />
              </svg>
            </div>
            <div>
              <div className="text-lg font-black tracking-wider text-white">ANDON</div>
              <div className="text-[10px] font-semibold tracking-[0.2em] text-blue-400/60 uppercase">Control Center</div>
            </div>
          </div>

          {/* Status summary pills */}
          <div className="flex items-center gap-3 ml-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="text-sm font-bold text-emerald-400 tabular-nums">{running}</span>
              <span className="text-xs text-emerald-400/60">running</span>
            </div>
            {down > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 animate-border-pulse">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400" />
                </span>
                <span className="text-sm font-bold text-red-400 tabular-nums">{down}</span>
                <span className="text-xs text-red-400/60">down</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-500/10 border border-slate-500/20">
              <span className="text-sm font-bold text-slate-300 tabular-nums">{total}</span>
              <span className="text-xs text-slate-400/60">total</span>
            </div>
          </div>
        </div>

        {/* Right side: clock + connection */}
        <div className="flex items-center gap-5">
          <button
            onClick={toggleAudio}
            className={`p-2 rounded-lg transition-all duration-200 ${audioEnabled ? 'bg-blue-500/15 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.2)]' : 'text-slate-500 hover:text-slate-300'}`}
            title={audioEnabled ? 'Audio alerts on' : 'Audio alerts off'}
          >
            {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {wsConnected ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              <span className="text-xs font-bold text-emerald-400 tracking-wider">LIVE</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="text-xs font-bold text-amber-400 tracking-wider">POLLING</span>
            </div>
          )}

          {online ? <Wifi className="w-4 h-4 text-emerald-400/60" /> : <WifiOff className="w-4 h-4 text-red-400 animate-pulse" />}

          {/* Digital clock */}
          <div className="text-right">
            <div className="text-2xl font-black tabular-nums tracking-wider text-white/90" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-[10px] text-slate-500 tracking-wider uppercase">
              {now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
            </div>
          </div>
        </div>
      </header>

      {/* ── WORKSTATION GRID ──────────────────────────────────── */}
      <div
        className="flex-1 p-4 grid gap-3 relative z-10"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridAutoRows: '1fr' }}
      >
        {workstations.map((ws, idx) => {
          const cfg = STATUS_CONFIG[ws.currentStatus] || STATUS_CONFIG.idle;
          const isBreakdown = ws.currentStatus === 'breakdown';
          const isQualityHold = ws.currentStatus === 'quality_hold';
          const isCritical = isBreakdown || isQualityHold;
          const mins = isCritical ? elapsedMinutes(ws.statusSince) : 0;
          const escalation = isBreakdown ? getEscalationTier(mins) : null;
          const isRunning = ws.currentStatus === 'running';

          // Glow pulse colors per status
          const glowColors: Record<string, { base: string; bright: string }> = {
            breakdown:    { base: '0 0 20px rgba(239,68,68,0.2)',  bright: '0 0 40px rgba(239,68,68,0.5)' },
            quality_hold: { base: '0 0 20px rgba(168,85,247,0.2)', bright: '0 0 40px rgba(168,85,247,0.5)' },
            changeover:   { base: '0 0 15px rgba(245,158,11,0.15)', bright: '0 0 30px rgba(245,158,11,0.35)' },
            maintenance:  { base: '0 0 15px rgba(59,130,246,0.15)', bright: '0 0 30px rgba(59,130,246,0.35)' },
            idle:         { base: '0 0 10px rgba(100,116,139,0.1)', bright: '0 0 20px rgba(100,116,139,0.2)' },
            planned_stop: { base: '0 0 15px rgba(249,115,22,0.15)', bright: '0 0 30px rgba(249,115,22,0.35)' },
          };
          const glow = !isRunning ? glowColors[ws.currentStatus] || glowColors.idle : null;

          return (
            <div
              key={ws.id}
              className={`
                relative overflow-hidden rounded-2xl border backdrop-blur-sm
                bg-gradient-to-br ${cfg.bg}
                ${cfg.ring} ring-1
                ${escalation?.strobe ? 'animate-strobe' : ''}
                ${isCritical && !escalation?.strobe ? 'animate-border-pulse' : ''}
                opacity-0
              `}
              style={{
                ...(glow ? { '--glow-base': glow.base, '--glow-bright': glow.bright } as React.CSSProperties : {}),
                animation: [
                  `scaleIn 0.4s ease-out ${idx * 0.05}s forwards`,
                  escalation?.strobe ? 'strobe 0.8s ease-in-out infinite' : '',
                  glow ? 'glowPulse 2.5s ease-in-out infinite' : '',
                ].filter(Boolean).join(', '),
              }}
            >
              {/* Decorative corner accent */}
              <div className={`absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gradient-to-br ${cfg.gradient} opacity-[0.07] blur-2xl`} />
              <div className={`absolute -left-4 -bottom-4 w-20 h-20 rounded-full bg-gradient-to-br ${cfg.gradient} opacity-[0.05] blur-xl`} />

              {/* Content */}
              <div className="relative z-10 h-full flex flex-col justify-between p-5">
                {/* Top row: code + area + escalation */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs font-semibold tracking-[0.15em] text-white/40 uppercase">{ws.area}</div>
                    <div className="text-sm font-mono font-bold text-white/50 mt-0.5">{ws.code}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {escalation && (
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-black tracking-wider ${escalation.color} text-white ${
                        escalation.strobe ? 'shadow-lg shadow-red-500/50' : ''
                      }`}>
                        {escalation.tier}
                      </span>
                    )}
                    {/* Status dot */}
                    <span className="relative flex h-3 w-3">
                      {isCritical && (
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.dot} opacity-75`} />
                      )}
                      <span className={`relative inline-flex rounded-full h-3 w-3 ${cfg.dot}`} />
                    </span>
                  </div>
                </div>

                {/* Machine name — THE HERO */}
                <div className="my-auto py-2">
                  <div className="text-2xl xl:text-3xl 2xl:text-4xl font-black leading-tight text-white tracking-tight">
                    {ws.name}
                  </div>
                </div>

                {/* Bottom: status + time + PO */}
                <div>
                  {/* Status label */}
                  <div className="flex items-baseline gap-3">
                    <span className={`text-lg xl:text-xl font-black tracking-wider bg-gradient-to-r ${cfg.gradient} bg-clip-text text-transparent`}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Breakdown: prominent DOWN timer */}
                  {isBreakdown && mins > 0 ? (
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="text-3xl xl:text-4xl font-black tabular-nums text-red-400" style={{ animation: 'glow-breathe 2s ease-in-out infinite' }}>
                        {mins}
                      </span>
                      <span className="text-sm font-semibold text-red-400/60 uppercase tracking-wider">min down</span>
                    </div>
                  ) : (
                    <div className="mt-1 text-sm font-medium text-white/30 tabular-nums">
                      {elapsed(ws.statusSince)} in status
                    </div>
                  )}

                  {/* Current PO */}
                  {ws.currentPO && (
                    <div className="mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/5 w-fit">
                      <span className="text-xs font-bold text-white/60">{ws.currentPO.poNumber}</span>
                      <span className="text-xs text-white/30">·</span>
                      <span className="text-xs text-white/40 truncate max-w-[120px]">{ws.currentPO.productName}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
