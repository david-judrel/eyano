'use client';

import { useEffect, useState } from 'react';
import { Activity, Eye, FileText, Key, Shield, User, type LucideIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/Page';
import { Select } from '@/components/ui/select';
import { Card, EmptyState } from '@/components/ui/feedback';
import { LoadingBlock, Pagination } from '@/components/admin/AdminKit';

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  target: string | null;
  details: any;
  ip: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

interface AuditResponse {
  logs: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

const actionLabels: Record<string, { label: string; icon: LucideIcon }> = {
  VIEW_PROVIDER_KEY_STATUS: { label: 'Consultation des clés', icon: Key },
  RESET_PROVIDER_KEYS: { label: 'Réinitialisation des clés', icon: Key },
  // Libelles historiques : conserves pour afficher proprement les enregistrements
  // d'audit anterieurs au renommage des actions.
  VIEW_GEMINI_KEYS_STATUS: { label: 'Consultation des clés', icon: Key },
  RESET_GEMINI_KEYS: { label: 'Réinitialisation des clés', icon: Key },
  UPDATE_USER_ROLE: { label: 'Modification de rôle', icon: Shield },
  UPDATE_USER_STATUS: { label: 'Modification de statut', icon: User },
  RUN_MISSION: { label: 'Mission IA', icon: Activity },
  VIEW_USER_CONVERSATION: { label: "Lecture d'une conversation", icon: Eye },
};

const ALL = 'ALL';

export default function AdminAudit() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: page.toString(), limit: '20' });
    if (actionFilter) params.set('action', actionFilter);

    try {
      const data = await api.get<AuditResponse>(`/admin/audit?${params}`);
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs(1);
  }, [actionFilter]);

  const getActionInfo = (action: string) => actionLabels[action] || { label: action, icon: Activity };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Audit" description={`${pagination.total} événements enregistrés`} />

      <Select
        aria-label="Filtrer par action"
        value={actionFilter || ALL}
        onValueChange={(v) => setActionFilter(v === ALL ? '' : v)}
        className="sm:w-64"
        options={[
          { value: ALL, label: 'Toutes les actions' },
          { value: 'VIEW_PROVIDER_KEY_STATUS', label: 'Consultation des clés' },
          { value: 'RESET_PROVIDER_KEYS', label: 'Réinitialisation des clés' },
          { value: 'UPDATE_USER_ROLE', label: 'Modification de rôle' },
          { value: 'UPDATE_USER_STATUS', label: 'Modification de statut' },
          { value: 'VIEW_USER_CONVERSATION', label: "Lecture d'une conversation" },
        ]}
      />

      <Card padding="none" className="overflow-hidden">
        {loading ? (
          <LoadingBlock />
        ) : logs.length === 0 ? (
          <EmptyState icon={FileText} title="Aucun événement" description="Les actions d'administration apparaîtront ici." />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {logs.map((log) => {
              const { label, icon: Icon } = getActionInfo(log.action);
              return (
                <li key={log.id} className="flex items-start gap-3 px-4 py-4">
                  <Icon className="icon-sm mt-0.5 text-foreground-muted" aria-hidden />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="text-label text-foreground">
                      {label}
                      {log.target && <span className="font-normal text-foreground-muted"> · {log.target}</span>}
                    </p>
                    <p className="flex flex-wrap gap-x-2 text-caption text-foreground-muted">
                      <span>{log.user.name || log.user.email}</span>
                      <span aria-hidden>·</span>
                      <span>{new Date(log.createdAt).toLocaleString('fr-FR')}</span>
                      {log.ip && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="font-mono">{log.ip}</span>
                        </>
                      )}
                    </p>
                    {log.details && (
                      <pre className="mt-1 overflow-x-auto rounded-md bg-surface px-3 py-2 font-mono text-code text-foreground-secondary">
                        {JSON.stringify(log.details)}
                      </pre>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <Pagination page={pagination.page} pages={pagination.pages} onChange={fetchLogs} />
      </Card>
    </div>
  );
}
