'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Factory, Wifi, WifiOff, Loader2 } from 'lucide-react';

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

export default function AndonBoardPage() {
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [online, setOnline] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [loaded, setLoaded] = useState(false);

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

  useEffect(() => {
    refresh();
    let interval = setInterval(refresh, 5000);
    const onVisibility = () => {
      clearInterval(interval);
      if (!document.hidden) {
        refresh();
        interval = setInterval(refresh, 5000);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisibility); };
  }, [refresh]);

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
