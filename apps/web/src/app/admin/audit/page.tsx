'use client';

import { useEffect, useState } from 'react';
import { FileText, Search, ChevronLeft, ChevronRight, User, Key, Shield, Activity } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

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

const actionLabels: Record<string, { label: string; icon: any; color: string }> = {
  'VIEW_GEMINI_KEYS_STATUS': { label: 'Consultation cles', icon: Key, color: 'text-[#39FF14]' },
  'RESET_GEMINI_KEYS': { label: 'Reset cles', icon: Key, color: 'text-yellow-400' },
  'UPDATE_USER_ROLE': { label: 'Modification role', icon: Shield, color: 'text-purple-400' },
  'UPDATE_USER_STATUS': { label: 'Modification statut', icon: User, color: 'text-orange-400' },
};

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

  const getActionInfo = (action: string) => {
    return actionLabels[action] || { label: action, icon: Activity, color: 'text-[#F2FFF0]/40' };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#F2FFF0]">Audit</h1>
        <p className="text-sm text-[#F2FFF0]/30 mt-1">{pagination.total} evenements enregistres</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="h-10 rounded-xl border border-[#F2FFF0]/[8%] bg-[#0D0F0E] px-3 text-sm text-[#F2FFF0] focus:outline-none focus:border-[#39FF14]/40"
        >
          <option value="">Toutes les actions</option>
          <option value="VIEW_GEMINI_KEYS_STATUS">Consultation cles</option>
          <option value="RESET_GEMINI_KEYS">Reset cles</option>
          <option value="UPDATE_USER_ROLE">Modification role</option>
          <option value="UPDATE_USER_STATUS">Modification statut</option>
        </select>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl border border-[#F2FFF0]/[6%] bg-[#0D0F0E]/60 backdrop-blur-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#39FF14]/20 border-t-[#39FF14]" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-[#F2FFF0]/20">
            <FileText className="h-8 w-8 mb-2" />
            <span>Aucun log d&apos;audit</span>
          </div>
        ) : (
          <div className="divide-y divide-[#F2FFF0]/[4%]">
            {logs.map((log) => {
              const actionInfo = getActionInfo(log.action);
              const Icon = actionInfo.icon;

              return (
                <div key={log.id} className="px-6 py-4 hover:bg-[#F2FFF0]/[2%] transition-colors">
                  <div className="flex items-start gap-4">
                    <div className={cn('p-2 rounded-xl bg-[#F2FFF0]/[4%]', actionInfo.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-[#F2FFF0]/80">{actionInfo.label}</span>
                        {log.target && (
                          <span className="text-xs text-[#F2FFF0]/20">• {log.target}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#F2FFF0]/30">
                        <span>{log.user.name || log.user.email}</span>
                        <span>•</span>
                        <span>{new Date(log.createdAt).toLocaleString('fr-FR')}</span>
                        {log.ip && (
                          <>
                            <span>•</span>
                            <span className="font-mono">{log.ip}</span>
                          </>
                        )}
                      </div>
                      {log.details && (
                        <div className="mt-2 px-3 py-2 rounded-lg bg-[#050505] text-xs text-[#F2FFF0]/30 font-mono">
                          {JSON.stringify(log.details)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#F2FFF0]/[4%]">
            <span className="text-xs text-[#F2FFF0]/30">
              Page {pagination.page} / {pagination.pages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => fetchLogs(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded-lg border border-[#F2FFF0]/[8%] text-[#F2FFF0]/30 hover:text-[#F2FFF0] disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => fetchLogs(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="p-1.5 rounded-lg border border-[#F2FFF0]/[8%] text-[#F2FFF0]/30 hover:text-[#F2FFF0] disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
