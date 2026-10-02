'use client';

import { useEffect, useState } from 'react';
import { Crown, Lock, MoreHorizontal, Search, Shield, UserCheck, UserX } from 'lucide-react';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { PageHeader } from '@/components/layout/Page';
import { Avatar } from '@/components/ui/avatar';
import { IconButton } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/feedback';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/overlay';
import { LoadingBlock, Pagination, RoleBadge, StatusBadge } from '@/components/admin/AdminKit';

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

/** Radix Select n'accepte pas la valeur vide : « ALL » represente « tous ». */
const ALL = 'ALL';

export default function AdminUsers() {
  const { user: currentUser } = useAppStore();
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

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
    if (!confirm(`Changer le rôle de cet utilisateur en ${newRole} ?`)) return;
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      fetchUsers(pagination.page);
    } catch {}
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    const action = newStatus === 'BANNED' ? 'bannir' : newStatus === 'INACTIVE' ? 'désactiver' : 'réactiver';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} cet utilisateur ?`)) return;
    try {
      await api.patch(`/admin/users/${userId}/status`, { status: newStatus });
      fetchUsers(pagination.page);
    } catch {}
  };

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Utilisateurs" description={`${pagination.total} utilisateurs au total`} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Field label="Rechercher un utilisateur" hideLabel className="flex-1">
          <div className="relative">
            <Search className="icon-sm pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" aria-hidden />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="pl-10" />
          </div>
        </Field>
        <Select
          aria-label="Filtrer par rôle"
          value={roleFilter || ALL}
          onValueChange={(v) => setRoleFilter(v === ALL ? '' : v)}
          className="sm:w-48"
          options={[
            { value: ALL, label: 'Tous les rôles' },
            { value: 'USER', label: 'Utilisateur' },
            { value: 'ADMIN', label: 'Admin' },
            { value: 'SUPER_ADMIN', label: 'Super admin' },
          ]}
        />
        <Select
          aria-label="Filtrer par statut"
          value={statusFilter || ALL}
          onValueChange={(v) => setStatusFilter(v === ALL ? '' : v)}
          className="sm:w-48"
          options={[
            { value: ALL, label: 'Tous les statuts' },
            { value: 'ACTIVE', label: 'Actif' },
            { value: 'INACTIVE', label: 'Inactif' },
            { value: 'BANNED', label: 'Banni' },
          ]}
        />
      </div>

      <Card padding="none" className="overflow-hidden">
        {loading ? (
          <LoadingBlock />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Utilisateur</TH>
                <TH>Rôle</TH>
                <TH>Statut</TH>
                <TH>Conversations</TH>
                <TH>Inscription</TH>
                <TH className="text-right"><span className="sr-only">Actions</span></TH>
              </tr>
            </THead>
            <TBody>
              {users.map((user) => (
                <TR key={user.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar src={user.avatarUrl} fallback={(user.name?.[0] || user.email[0] || '?').toUpperCase()} alt={user.name || user.email} size="sm" />
                      <div className="min-w-0">
                        <p className="text-label text-foreground">{user.name || 'Sans nom'}</p>
                        <p className="text-caption text-foreground-muted">{user.email}</p>
                      </div>
                    </div>
                  </TD>
                  <TD><RoleBadge role={user.role} /></TD>
                  <TD><StatusBadge status={user.status} /></TD>
                  <TD className="tabular-nums">{user._count.conversations}</TD>
                  <TD>{new Date(user.createdAt).toLocaleDateString('fr-FR')}</TD>
                  <TD className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <IconButton label={`Actions pour ${user.email}`} icon={MoreHorizontal} size="sm" tooltip={false} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {user.status === 'ACTIVE' ? (
                          <>
                            <DropdownMenuItem icon={Lock} onSelect={() => handleStatusChange(user.id, 'INACTIVE')}>Désactiver</DropdownMenuItem>
                            <DropdownMenuItem icon={UserX} destructive onSelect={() => handleStatusChange(user.id, 'BANNED')}>Bannir</DropdownMenuItem>
                          </>
                        ) : (
                          <DropdownMenuItem icon={UserCheck} onSelect={() => handleStatusChange(user.id, 'ACTIVE')}>Réactiver</DropdownMenuItem>
                        )}
                        {isSuperAdmin && user.id !== currentUser?.id && user.role !== 'SUPER_ADMIN' && (
                          <>
                            <DropdownMenuSeparator />
                            {user.role === 'USER' && (
                              <DropdownMenuItem icon={Shield} onSelect={() => handleRoleChange(user.id, 'ADMIN')}>Promouvoir admin</DropdownMenuItem>
                            )}
                            {user.role === 'ADMIN' && (
                              <DropdownMenuItem icon={Crown} onSelect={() => handleRoleChange(user.id, 'USER')}>Rétrograder en utilisateur</DropdownMenuItem>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <Pagination page={pagination.page} pages={pagination.pages} onChange={fetchUsers} />
      </Card>
    </div>
  );
}
