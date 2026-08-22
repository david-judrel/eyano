'use client';

import { useEffect, useState } from 'react';
import { Cpu, RefreshCw, Activity, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface KeyStatus {
  id: string;
  isActive: boolean;
  cooldownUntil: number;
  cooldownRemaining: number;
  failures: number;
  requestCount: number;
  successCount: number;
  rateLimitCount: number;
  usagePercent: number;
}

interface KeyMetrics {
  totalRequests: number;
  totalSuccess: number;
  totalRateLimits: number;
  totalKeySwitches: number;
  keys: KeyStatus[];
}

export default function AdminAI() {
  const [metrics, setMetrics] = useState<KeyMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const data = await api.get<KeyMetrics>('/ai/keys/status');
      setMetrics(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleReset = async () => {
    if (!confirm('Reinitialiser toutes les cles Gemini ?')) return;
    setResetting(true);
    try {
      await api.post('/ai/keys/reset', {});
      await fetchMetrics();
    } catch {}
    setResetting(false);
  };

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#39FF14]/20 border-t-[#39FF14]" />
      </div>
    );
  }

  const successRate = metrics
    ? Math.round((metrics.totalSuccess / (metrics.totalRequests || 1)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F2FFF0]">IA & Cles Gemini</h1>
          <p className="text-sm text-[#F2FFF0]/30 mt-1">Monitoring de la rotation des cles API</p>
        </div>
        <button
          onClick={handleReset}
          disabled={resetting}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#F2FFF0]/[8%] text-sm text-[#F2FFF0]/50 hover:text-[#F2FFF0] hover:border-[#F2FFF0]/[15%] hover:bg-[#F2FFF0]/[4%] transition-all disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', resetting && 'animate-spin')} />
          Reinitialiser
        </button>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#F2FFF0]/[6%] bg-[#0D0F0E]/60 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-[#39FF14]" />
            <span className="text-xs text-[#F2FFF0]/30">Requetes</span>
          </div>
          <div className="text-2xl font-bold text-[#F2FFF0]">{metrics?.totalRequests || 0}</div>
        </div>
        <div className="rounded-2xl border border-[#F2FFF0]/[6%] bg-[#0D0F0E]/60 p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-green-400" />
            <span className="text-xs text-[#F2FFF0]/30">Succes</span>
          </div>
          <div className="text-2xl font-bold text-green-400">{successRate}%</div>
        </div>
        <div className="rounded-2xl border border-[#F2FFF0]/[6%] bg-[#0D0F0E]/60 p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-xs text-[#F2FFF0]/30">Rate Limits</span>
          </div>
          <div className="text-2xl font-bold text-red-400">{metrics?.totalRateLimits || 0}</div>
        </div>
        <div className="rounded-2xl border border-[#F2FFF0]/[6%] bg-[#0D0F0E]/60 p-5">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="h-4 w-4 text-purple-400" />
            <span className="text-xs text-[#F2FFF0]/30">Rotations</span>
          </div>
          <div className="text-2xl font-bold text-purple-400">{metrics?.totalKeySwitches || 0}</div>
        </div>
      </div>

      {/* Keys Detail */}
      <div className="rounded-2xl border border-[#F2FFF0]/[6%] bg-[#0D0F0E]/60 backdrop-blur-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F2FFF0]/[4%] flex items-center gap-3">
          <Cpu className="h-5 w-5 text-[#39FF14]" />
          <h2 className="text-sm font-semibold text-[#F2FFF0]/80">Etat des cles</h2>
        </div>

        <div className="divide-y divide-[#F2FFF0]/[4%]">
          {metrics?.keys.map((key) => (
            <div key={key.id} className="px-6 py-4 hover:bg-[#F2FFF0]/[2%] transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-3 h-3 rounded-full',
                    key.isActive
                      ? 'bg-[#39FF14] shadow-[0_0_8px_rgba(57,255,20,0.6)]'
                      : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                  )} />
                  <span className="text-sm font-medium text-[#F2FFF0]/80">{key.id}</span>
                  <span className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-bold',
                    key.isActive ? 'bg-[#39FF14]/10 text-[#39FF14]' : 'bg-red-500/10 text-red-400'
                  )}>
                    {key.isActive ? 'ACTIVE' : 'COOLDOWN'}
                  </span>
                </div>
                {!key.isActive && (
                  <div className="flex items-center gap-1.5 text-xs text-red-400/60">
                    <Clock className="h-3 w-3" />
                    {Math.ceil(key.cooldownRemaining / 1000)}s
                  </div>
                )}
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-[#F2FFF0]/20 mb-1">Requetes</div>
                  <div className="text-sm font-medium text-[#F2FFF0]/60">{key.requestCount}</div>
                </div>
                <div>
                  <div className="text-xs text-[#F2FFF0]/20 mb-1">Succes</div>
                  <div className="text-sm font-medium text-green-400/60">{key.successCount}</div>
                </div>
                <div>
                  <div className="text-xs text-[#F2FFF0]/20 mb-1">429</div>
                  <div className="text-sm font-medium text-red-400/60">{key.rateLimitCount}</div>
                </div>
                <div>
                  <div className="text-xs text-[#F2FFF0]/20 mb-1">Usage</div>
                  <div className="text-sm font-medium text-[#F2FFF0]/60">{key.usagePercent}%</div>
                </div>
              </div>

              {/* Usage Bar */}
              <div className="mt-3 h-1.5 bg-[#F2FFF0]/[4%] rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    key.isActive ? 'bg-[#39FF14]' : 'bg-red-500'
                  )}
                  style={{ width: `${key.usagePercent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
