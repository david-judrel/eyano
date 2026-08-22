'use client';

import { useEffect, useState } from 'react';
import { Search, Shield, UserCheck, UserX, ChevronLeft, ChevronRight, MoreVertical, Crown, Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  _count: {
    conversations: number;
    usage: number;
  };
}

interface UsersResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function AdminUsers() {
  const { user: currentUser } = useAppStore();
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [actionMenu, setActionMenu] = useState<string | null>(null);

  const fetchUsers = async (page = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: page.toString(), limit: '10' });
    if (search) params.set('search', search);
    if (roleFilter) params.set('role', roleFilter);
    if (statusFilter) params.set('status', statusFilter);

    try {
      const data = await api.get<UsersResponse>(`/admin/users?${params}`);
      setUsers(data.users);
      setPagination(data.pagination);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers(1);
  }, [search, roleFilter, statusFilter]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!confirm(`Changer le role de cet utilisateur en ${newRole} ?`)) return;
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      fetchUsers(pagination.page);
      setActionMenu(null);
    } catch {}
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    const action = newStatus === 'BANNED' ? 'bannir' : newStatus === 'INACTIVE' ? 'desactiver' : 'reactiver';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} cet utilisateur ?`)) return;
    try {
      await api.patch(`/admin/users/${userId}/status`, { status: newStatus });
      fetchUsers(pagination.page);
      setActionMenu(null);
    } catch {}
  };

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#F2FFF0]">Utilisateurs</h1>
        <p className="text-sm text-[#F2FFF0]/30 mt-1">{pagination.total} utilisateurs au total</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#F2FFF0]/20" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="h-10 w-full rounded-xl border border-[#F2FFF0]/[8%] bg-[#0D0F0E] pl-10 pr-4 text-sm text-[#F2FFF0] placeholder:text-[#F2FFF0]/20 focus:outline-none focus:border-[#39FF14]/40"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-10 rounded-xl border border-[#F2FFF0]/[8%] bg-[#0D0F0E] px-3 text-sm text-[#F2FFF0] focus:outline-none focus:border-[#39FF14]/40"
        >
          <option value="">Tous les roles</option>
          <option value="USER">USER</option>
          <option value="ADMIN">ADMIN</option>
          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-xl border border-[#F2FFF0]/[8%] bg-[#0D0F0E] px-3 text-sm text-[#F2FFF0] focus:outline-none focus:border-[#39FF14]/40"
        >
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Actif</option>
          <option value="INACTIVE">Inactif</option>
          <option value="BANNED">Banni</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-[#F2FFF0]/[6%] bg-[#0D0F0E]/60 backdrop-blur-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#39FF14]/20 border-t-[#39FF14]" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F2FFF0]/[4%]">
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-[#F2FFF0]/30 uppercase tracking-wider">Utilisateur</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-[#F2FFF0]/30 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-[#F2FFF0]/30 uppercase tracking-wider">Statut</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-[#F2FFF0]/30 uppercase tracking-wider">Conversations</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-[#F2FFF0]/30 uppercase tracking-wider">Inscription</th>
                  <th className="px-4 py-3 text-right text-[11px] font-medium text-[#F2FFF0]/30 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2FFF0]/[4%]">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-[#F2FFF0]/[2%] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={user.avatarUrl}
                          fallback={user.name?.[0] || user.email[0]?.toUpperCase()}
                          size="sm"
                          className="bg-[#39FF14]/[10%] text-[#39FF14] border border-[#39FF14]/20"
                        />
                        <div>
                          <div className="text-sm font-medium text-[#F2FFF0]/80">{user.name || 'Sans nom'}</div>
                          <div className="text-xs text-[#F2FFF0]/30">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'px-2 py-1 rounded text-[10px] font-bold',
                        user.role === 'SUPER_ADMIN' ? 'bg-purple-500/20 text-purple-400' :
                        user.role === 'ADMIN' ? 'bg-[#39FF14]/10 text-[#39FF14]' :
                        'bg-[#F2FFF0]/[6%] text-[#F2FFF0]/40'
                      )}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'px-2 py-1 rounded text-[10px] font-bold',
                        user.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' :
                        user.status === 'INACTIVE' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      )}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#F2FFF0]/40">{user._count.conversations}</td>
                    <td className="px-4 py-3 text-sm text-[#F2FFF0]/30">
                      {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="relative">
                        <button
                          onClick={() => setActionMenu(actionMenu === user.id ? null : user.id)}
                          className="p-1.5 rounded-lg hover:bg-[#F2FFF0]/[4%] text-[#F2FFF0]/30 hover:text-[#F2FFF0]"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {actionMenu === user.id && (
                          <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-[#F2FFF0]/[8%] bg-[#0D0F0E] shadow-xl z-10 py-1">
                            {user.status === 'ACTIVE' ? (
                              <>
                                <button
                                  onClick={() => handleStatusChange(user.id, 'INACTIVE')}
                                  className="w-full px-3 py-2 text-left text-sm text-yellow-400 hover:bg-yellow-500/10 flex items-center gap-2"
                                >
                                  <Lock className="h-4 w-4" /> Desactiver
                                </button>
                                <button
                                  onClick={() => handleStatusChange(user.id, 'BANNED')}
                                  className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                                >
                                  <UserX className="h-4 w-4" /> Bannir
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleStatusChange(user.id, 'ACTIVE')}
                                className="w-full px-3 py-2 text-left text-sm text-green-400 hover:bg-green-500/10 flex items-center gap-2"
                              >
                                <UserCheck className="h-4 w-4" /> Reactiver
                              </button>
                            )}

                            {isSuperAdmin && user.id !== currentUser?.id && user.role !== 'SUPER_ADMIN' && (
                              <>
                                <div className="my-1 border-t border-[#F2FFF0]/[4%]" />
                                {user.role === 'USER' && (
                                  <button
                                    onClick={() => handleRoleChange(user.id, 'ADMIN')}
                                    className="w-full px-3 py-2 text-left text-sm text-[#39FF14] hover:bg-[#39FF14]/10 flex items-center gap-2"
                                  >
                                    <Shield className="h-4 w-4" /> Promouvoir ADMIN
                                  </button>
                                )}
                                {user.role === 'ADMIN' && (
                                  <button
                                    onClick={() => handleRoleChange(user.id, 'USER')}
                                    className="w-full px-3 py-2 text-left text-sm text-yellow-400 hover:bg-yellow-500/10 flex items-center gap-2"
                                  >
                                    <Crown className="h-4 w-4" /> Retrograder USER
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                onClick={() => fetchUsers(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded-lg border border-[#F2FFF0]/[8%] text-[#F2FFF0]/30 hover:text-[#F2FFF0] disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => fetchUsers(pagination.page + 1)}
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
