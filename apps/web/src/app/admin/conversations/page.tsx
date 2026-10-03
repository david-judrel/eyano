'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MessagesSquare, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/Page';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Alert, Card, EmptyState } from '@/components/ui/feedback';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { LoadingBlock, Pagination } from '@/components/admin/AdminKit';

interface ConversationRow {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; email: string; name: string | null; avatarUrl: string | null };
  _count: { messages: number };
}

interface ConversationsResponse {
  conversations: ConversationRow[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

/** Suivi des conversations de tous les utilisateurs (SUPER_ADMIN, lecture seule). */
function AdminConversations() {
  const router = useRouter();
  const params = useSearchParams();
  const userId = params.get('userId') || '';

  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const fetchRows = async (page = 1) => {
    setLoading(true);
    const query = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) query.set('search', search);
    if (userId) query.set('userId', userId);
    try {
      const data = await api.get<ConversationsResponse>(`/admin/conversations?${query}`);
      setRows(data.conversations);
      setPagination(data.pagination);
    } catch {
      setForbidden(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRows(1);
  }, [search, userId]);

  const filteredUser = userId ? rows[0]?.user : null;

  if (forbidden) {
    return <Alert tone="warning" title="Accès réservé">La lecture des conversations est réservée aux super-administrateurs.</Alert>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Conversations"
        description={`${pagination.total} conversations · lecture seule, chaque ouverture est journalisée`}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Field label="Rechercher une conversation" hideLabel className="flex-1">
          <div className="relative">
            <Search className="icon-sm pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" aria-hidden />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Titre, e-mail ou nom…" className="pl-10" />
          </div>
        </Field>
        {userId && (
          <Button variant="outline" icon={X} onClick={() => router.push('/admin/conversations')}>
            {filteredUser ? `Utilisateur : ${filteredUser.name || filteredUser.email}` : 'Retirer le filtre'}
          </Button>
        )}
      </div>

      <Card padding="none" className="overflow-hidden">
        {loading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyState icon={MessagesSquare} title="Aucune conversation" description="Aucune conversation ne correspond à cette recherche." />
        ) : (
          <>
          <ul className="divide-y divide-border-subtle sm:hidden">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/admin/conversations/${row.id}`)}
                  className="flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors duration-fast hover:bg-hover"
                >
                  <span className="truncate text-label text-foreground">{row.title || 'Nouvelle conversation'}</span>
                  <span className="truncate text-caption text-foreground-muted">
                    {row.user.name || row.user.email} · {row._count.messages} messages ·{' '}
                    {new Date(row.updatedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="hidden sm:block">
          <Table>
            <THead>
              <tr>
                <TH>Conversation</TH>
                <TH>Utilisateur</TH>
                <TH>Messages</TH>
                <TH>Dernière activité</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <TR key={row.id} className="cursor-pointer" onClick={() => router.push(`/admin/conversations/${row.id}`)}>
                  <TD className="max-w-xs">
                    <a
                      href={`/admin/conversations/${row.id}`}
                      onClick={(e) => e.preventDefault()}
                      className="block truncate text-label text-foreground"
                    >
                      {row.title || 'Nouvelle conversation'}
                    </a>
                  </TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <Avatar src={row.user.avatarUrl} fallback={(row.user.name?.[0] || row.user.email[0] || '?').toUpperCase()} alt={row.user.name || row.user.email} size="sm" />
                      <span className="truncate">{row.user.name || row.user.email}</span>
                    </div>
                  </TD>
                  <TD className="tabular-nums">{row._count.messages}</TD>
                  <TD>{new Date(row.updatedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          </div>
          </>
        )}
        <Pagination page={pagination.page} pages={pagination.pages} onChange={fetchRows} />
      </Card>
    </div>
  );
}

export default function AdminConversationsPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <AdminConversations />
    </Suspense>
  );
}
