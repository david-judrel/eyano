'use client';

import { useEffect, useState } from 'react';
import { Activity, Cpu, MessageSquare, UserPlus, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/Page';
import { Progress } from '@/components/ui/feedback';
import { LoadingBlock, Panel, RoleBadge, Stat } from '@/components/admin/AdminKit';

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

  if (loading) return <LoadingBlock />;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Vue d'ensemble" description="Tableau de bord administrateur" />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat icon={Users} label="Utilisateurs" value={stats?.users.total || 0} detail={`${stats?.users.active || 0} actifs`} />
        <Stat icon={UserPlus} label="Nouveaux (7 j)" value={stats?.users.newThisWeek || 0} detail={`${stats?.users.newToday || 0} aujourd'hui`} />
        <Stat icon={MessageSquare} label="Conversations" value={stats?.conversations.total || 0} detail={`${stats?.conversations.today || 0} aujourd'hui`} />
        <Stat icon={Activity} label="Messages" value={stats?.messages.total || 0} detail={`${stats?.messages.today || 0} aujourd'hui`} />
      </div>

      {keyMetrics && (
        <Panel title="Clés API" icon={Cpu}>
          <div className="grid grid-cols-3 border-b border-border-subtle">
            {[
              { label: 'Requêtes', value: keyMetrics.totalRequests },
              { label: 'Succès', value: keyMetrics.totalSuccess },
              { label: 'Limites atteintes (429)', value: keyMetrics.totalRateLimits },
            ].map(({ label, value }) => (
              <div key={label} className="px-4 py-4">
                <p className="text-heading-md tabular-nums text-foreground">{value}</p>
                <p className="text-caption text-foreground-muted">{label}</p>
              </div>
            ))}
          </div>
          <ul className="flex flex-col gap-3 p-4">
            {keyMetrics.keys.map((key) => (
              <li key={key.id} className="flex items-center gap-4">
                <span className="w-24 truncate font-mono text-code text-foreground-secondary">{key.id}</span>
                <Progress label={`Usage de ${key.id}`} value={key.usagePercent} tone={key.isActive ? 'brand' : 'error'} className="flex-1" />
                <span className="w-12 text-right text-caption tabular-nums text-foreground-muted">{key.usagePercent} %</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {stats?.users.byRole && (
        <Panel title="Répartition par rôle">
          <div className="flex flex-wrap gap-6 p-4">
            {stats.users.byRole.map((r) => (
              <div key={r.role} className="flex items-center gap-2">
                <RoleBadge role={r.role} />
                <span className="text-body-sm tabular-nums text-foreground-secondary">{r.count}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
