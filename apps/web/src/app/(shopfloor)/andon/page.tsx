'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { Factory, Wifi, WifiOff, Loader2 } from 'lucide-react';
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

const STATUS_COLORS: Record<string, { bg: string; text: string; pulse?: boolean }> = {
  running:      { bg: 'bg-green-600',  text: 'text-green-100' },
  breakdown:    { bg: 'bg-red-600',    text: 'text-red-100',    pulse: true },
  changeover:   { bg: 'bg-yellow-500', text: 'text-yellow-100' },
  quality_hold: { bg: 'bg-purple-600', text: 'text-purple-100', pulse: true },
  idle:         { bg: 'bg-gray-600',   text: 'text-gray-200' },
  maintenance:  { bg: 'bg-blue-600',   text: 'text-blue-100' },
  planned_stop: { bg: 'bg-orange-500', text: 'text-orange-100' },
};

const STATUS_LABELS: Record<string, string> = {
  running: 'RUNNING', breakdown: 'BREAKDOWN', changeover: 'CHANGEOVER',
  quality_hold: 'QUALITY HOLD', idle: 'IDLE', maintenance: 'MAINTENANCE',
  planned_stop: 'PLANNED STOP',
};

function elapsed(since: string): string {
  if (!since) return '—';
  const ms = Date.now() - new Date(since).getTime();
  if (isNaN(ms)) return '—';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

/** Resolve the WebSocket URL for the shopfloor namespace */
function getSocketUrl(): string {
  if (typeof window === 'undefined') return '';
  // In production, connect to the same host; in dev, connect to the API server
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  return `${apiUrl}/shopfloor`;
}

export default function AndonBoardPage() {
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [online, setOnline] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [loaded, setLoaded] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Extract siteId from first workstation (all belong to same site via API)
  const siteIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const ws = await api.get<Workstation[]>('/workstations');
      setWorkstations(Array.isArray(ws) ? ws.filter(w => w.isActive !== false) : []);
      setOnline(true);
      setLastUpdate(new Date());
    } catch {
      setOnline(false);
    } finally {
      setLoaded(true);
    }
  }, []);

  // WebSocket connection
  useEffect(() => {
    const socket = io(getSocketUrl(), {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setWsConnected(true);
    });

    socket.on('disconnect', () => {
      setWsConnected(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Listen for status events once we know the siteId
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || workstations.length === 0) return;

    // Derive siteId from workstations endpoint URL (site-scoped)
    // We listen for all status events and match by workstation ID
    // Since the API is site-scoped, we need to figure out the siteId.
    // We'll subscribe to events for all workstation IDs we know about.
    const workstationIds = new Set(workstations.map(w => w.id));

    // Listen on a wildcard-ish approach: the server emits status:${siteId}
    // We don't know the siteId on the frontend, so we use a catch-all listener
    const onAnyEvent = (eventName: string, payload: {
      workstationId: string;
      workstationName?: string;
      status?: string;
      reasonCode?: string;
      notes?: string;
      operatorName?: string;
      timestamp?: string;
    }) => {
      if (!eventName.startsWith('status:')) return;
      if (!payload?.workstationId || !workstationIds.has(payload.workstationId)) return;

      setWorkstations(prev => prev.map(ws => {
        if (ws.id !== payload.workstationId) return ws;
        return {
          ...ws,
          currentStatus: payload.status || ws.currentStatus,
          statusSince: payload.timestamp || ws.statusSince,
        };
      }));
      setLastUpdate(new Date());
    };

    socket.onAny(onAnyEvent);

    return () => {
      socket.offAny(onAnyEvent);
    };
  }, [workstations.length > 0]); // Re-subscribe when workstations first load

  // Initial fetch + polling fallback (30s when WebSocket connected, 5s when not)
  useEffect(() => {
    refresh();
    const pollInterval = wsConnected ? 30000 : 5000;
    let interval = setInterval(refresh, pollInterval);
    const onVisibility = () => {
      clearInterval(interval);
      if (!document.hidden) {
        refresh();
        interval = setInterval(refresh, pollInterval);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisibility); };
  }, [refresh, wsConnected]);

  // Force re-render every minute for elapsed time updates
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const cols = workstations.length <= 4 ? 2 : workstations.length <= 9 ? 3 : 4;

  if (!loaded) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (workstations.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-gray-400 text-lg">No workstations configured</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <Factory className="w-7 h-7 text-blue-400" />
          <span className="text-2xl font-bold tracking-tight">ANDON BOARD</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {wsConnected ? (
            <span className="flex items-center gap-1.5 text-green-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              LIVE
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-yellow-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-yellow-400" />
              POLLING
            </span>
          )}
          <span className="text-gray-400">
            {lastUpdate.toLocaleTimeString()}
          </span>
          {online ? (
            <Wifi className="w-5 h-5 text-green-400" />
          ) : (
            <WifiOff className="w-5 h-5 text-red-400 animate-pulse" />
          )}
        </div>
      </header>

      {/* Grid */}
      <div
        className="flex-1 p-4 grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridAutoRows: '1fr',
        }}
      >
        {workstations.map(ws => {
          const cfg = STATUS_COLORS[ws.currentStatus] || STATUS_COLORS.idle;
          return (
            <div
              key={ws.id}
              className={`${cfg.bg} rounded-2xl p-6 flex flex-col justify-between ${cfg.pulse ? 'animate-pulse' : ''}`}
            >
              <div>
                <div className="text-lg font-medium opacity-80">{ws.code}</div>
                <div className="text-3xl xl:text-4xl font-black leading-tight mt-1">{ws.name}</div>
              </div>
              <div className="mt-4">
                <div className="text-2xl xl:text-3xl font-black tracking-wider">
                  {STATUS_LABELS[ws.currentStatus] || ws.currentStatus.toUpperCase()}
                </div>
                <div className="text-lg opacity-70 mt-1">
                  {elapsed(ws.statusSince)}
                </div>
                {ws.currentPO && (
                  <div className="mt-3 text-base opacity-80">
                    <span className="font-bold">{ws.currentPO.poNumber}</span>
                    <span className="ml-2">{ws.currentPO.productName}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
