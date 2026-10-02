'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock, Cpu, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/Page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/feedback';
import { LoadingBlock, Panel, Stat } from '@/components/admin/AdminKit';

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
    if (!confirm('Réinitialiser toutes les clés ?')) return;
    setResetting(true);
    try {
      await api.post('/ai/keys/reset', {});
      await fetchMetrics();
    } catch {}
    setResetting(false);
  };

  if (loading && !metrics) return <LoadingBlock />;

  const successRate = metrics ? Math.round((metrics.totalSuccess / (metrics.totalRequests || 1)) * 100) : 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="IA et clés API"
        description="Suivi de la rotation des clés"
        actions={<Button icon={RefreshCw} loading={resetting} onClick={handleReset}>Réinitialiser</Button>}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat icon={Activity} label="Requêtes" value={metrics?.totalRequests || 0} />
        <Stat icon={CheckCircle2} label="Taux de succès" value={`${successRate} %`} />
        <Stat icon={AlertTriangle} label="Limites atteintes (429)" value={metrics?.totalRateLimits || 0} />
        <Stat icon={RefreshCw} label="Rotations" value={metrics?.totalKeySwitches || 0} />
      </div>

      <Panel title="État des clés" icon={Cpu}>
        <ul className="divide-y divide-border-subtle">
          {metrics?.keys.map((key) => (
            <li key={key.id} className="flex flex-col gap-3 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-code text-foreground">{key.id}</span>
                  <Badge tone={key.isActive ? 'success' : 'error'}>{key.isActive ? 'Active' : 'En pause'}</Badge>
                </div>
                {!key.isActive && (
                  <span className="flex items-center gap-1 text-caption text-foreground-muted">
                    <Clock className="icon-xs" aria-hidden />
                    {Math.ceil(key.cooldownRemaining / 1000)} s
                  </span>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: 'Requêtes', value: key.requestCount },
                  { label: 'Succès', value: key.successCount },
                  { label: '429', value: key.rateLimitCount },
                  { label: 'Usage', value: `${key.usagePercent} %` },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <dt className="text-caption text-foreground-muted">{label}</dt>
                    <dd className="text-label tabular-nums text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
              <Progress label={`Usage de ${key.id}`} value={key.usagePercent} tone={key.isActive ? 'brand' : 'error'} />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
