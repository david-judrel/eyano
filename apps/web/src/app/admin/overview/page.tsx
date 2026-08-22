'use client';

import { useEffect, useState } from 'react';
import { Users, MessageSquare, Activity, TrendingUp, UserPlus, Clock, Cpu, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { Logo } from '@/components/ui/logo';

interface DashboardStats {
  users: {
    total: number;
    active: number;
    newToday: number;
    newThisWeek: number;
    byRole: { role: string; count: number }[];
  };
  conversations: {
    total: number;
    today: number;
  };
  messages: {
    total: number;
    today: number;
  };
}

interface KeyMetrics {
  totalRequests: number;
  totalSuccess: number;
  totalRateLimits: number;
  totalKeySwitches: number;
  keys: {
    id: string;
    isActive: boolean;
    usagePercent: number;
    failures: number;
  }[];
}

export default function AdminOverview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [keyMetrics, setKeyMetrics] = useState<KeyMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<DashboardStats>('/admin/dashboard'),
      api.get<KeyMetrics>('/ai/keys/status').catch(() => null),
    ]).then(([statsData, keysData]) => {
      setStats(statsData);
      setKeyMetrics(keysData);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#39FF14]/20 border-t-[#39FF14]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#F2FFF0]">Vue d&apos;ensemble</h1>
        <p className="text-sm text-[#F2FFF0]/30 mt-1">Tableau de bord administrateur</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Utilisateurs"
          value={stats?.users.total || 0}
          sub={`${stats?.users.active || 0} actifs`}
          color="text-[#39FF14]"
        />
        <StatCard
          icon={UserPlus}
          label="Nouveaux (7j)"
          value={stats?.users.newThisWeek || 0}
          sub={`${stats?.users.newToday || 0} aujourd'hui`}
          color="text-blue-400"
        />
        <StatCard
          icon={MessageSquare}
          label="Conversations"
          value={stats?.conversations.total || 0}
          sub={`${stats?.conversations.today || 0} aujourd'hui`}
          color="text-purple-400"
        />
        <StatCard
          icon={Activity}
          label="Messages"
          value={stats?.messages.total || 0}
          sub={`${stats?.messages.today || 0} aujourd'hui`}
          color="text-orange-400"
        />
      </div>

      {/* AI Keys Status */}
      {keyMetrics && (
        <div className="rounded-2xl border border-[#F2FFF0]/[6%] bg-[#0D0F0E]/60 backdrop-blur-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#F2FFF0]/[4%] flex items-center gap-3">
            <Cpu className="h-5 w-5 text-[#39FF14]" />
            <h2 className="text-sm font-semibold text-[#F2FFF0]/80">Gemini Keys</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-[#F2FFF0]">{keyMetrics.totalRequests}</div>
                <div className="text-xs text-[#F2FFF0]/30">Requetes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{keyMetrics.totalSuccess}</div>
                <div className="text-xs text-[#F2FFF0]/30">Succes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">{keyMetrics.totalRateLimits}</div>
                <div className="text-xs text-[#F2FFF0]/30">429 Rate Limits</div>
              </div>
            </div>

            <div className="space-y-3">
              {keyMetrics.keys.map((key) => (
                <div key={key.id} className="flex items-center gap-4">
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    key.isActive ? 'bg-[#39FF14] shadow-[0_0_6px_rgba(57,255,20,0.6)]' : 'bg-red-500'
                  )} />
                  <span className="text-sm text-[#F2FFF0]/60 w-24">{key.id}</span>
                  <div className="flex-1 h-2 bg-[#F2FFF0]/[4%] rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', key.isActive ? 'bg-[#39FF14]' : 'bg-red-500')}
                      style={{ width: `${key.usagePercent}%` }}
                    />
                  </div>
                  <span className="text-sm text-[#F2FFF0]/40 w-12 text-right">{key.usagePercent}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Users by Role */}
      {stats?.users.byRole && (
        <div className="rounded-2xl border border-[#F2FFF0]/[6%] bg-[#0D0F0E]/60 backdrop-blur-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#F2FFF0]/[4%]">
            <h2 className="text-sm font-semibold text-[#F2FFF0]/80">Repartition par role</h2>
          </div>
          <div className="p-6">
            <div className="flex gap-6">
              {stats.users.byRole.map((r) => (
                <div key={r.role} className="flex items-center gap-2">
                  <div className={cn(
                    'px-2 py-1 rounded text-xs font-bold',
                    r.role === 'SUPER_ADMIN' ? 'bg-purple-500/20 text-purple-400' :
                    r.role === 'ADMIN' ? 'bg-[#39FF14]/10 text-[#39FF14]' :
                    'bg-[#F2FFF0]/[6%] text-[#F2FFF0]/40'
                  )}>
                    {r.role}
                  </div>
                  <span className="text-sm text-[#F2FFF0]/60">{r.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: any;
  label: string;
  value: number;
  sub: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-[#F2FFF0]/[6%] bg-[#0D0F0E]/60 backdrop-blur-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn('p-2 rounded-xl bg-[#F2FFF0]/[4%]', color)}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs text-[#F2FFF0]/30">{label}</span>
      </div>
      <div className="text-2xl font-bold text-[#F2FFF0]">{value}</div>
      <div className="text-xs text-[#F2FFF0]/20 mt-1">{sub}</div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
