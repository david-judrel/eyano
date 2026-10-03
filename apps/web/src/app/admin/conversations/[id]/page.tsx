'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Eye, FileText, ImageOff } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/layout/Page';
import { Avatar } from '@/components/ui/avatar';
import { IconButton } from '@/components/ui/button';
import { Alert, Card, Skeleton } from '@/components/ui/feedback';
import { Markdown } from '@/components/chat/Markdown';
import { LoadingBlock, RoleBadge, StatusBadge } from '@/components/admin/AdminKit';

interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  storageKey: string;
}

interface AdminMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  status: string;
  model: string | null;
  latencyMs: number | null;
  createdAt: string;
  attachments: Attachment[];
}

interface AdminConversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; email: string; name: string | null; avatarUrl: string | null; role: string; status: string };
  messages: AdminMessage[];
}

/** Image Kepler chargee par la route d'administration. */
function AdminImage({ id }: { id: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    api
      .getFileObjectUrl(id, 'admin')
      .then((u) => {
        if (cancelled) return URL.revokeObjectURL(u);
        url = u;
        setSrc(u);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);

  if (failed) {
    return (
      <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-border-subtle bg-surface">
        <ImageOff className="icon-md text-foreground-muted" aria-label="Image indisponible" />
      </div>
    );
  }
  if (!src) return <Skeleton className="h-48 w-48 rounded-lg" />;
  // eslint-disable-next-line @next/next/no-img-element -- URL locale (blob) d'une image protegee
  return <img src={src} alt="Image créée par Kepler" className="w-full max-w-xs rounded-lg border border-border-subtle" />;
}

function Attachments({ items }: { items: Attachment[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((att) =>
        att.storageKey === 'db:kepler' ? (
          <AdminImage key={att.id} id={att.id} />
        ) : (
          <span key={att.id} className="flex h-8 items-center gap-2 rounded-md border border-border-subtle bg-surface px-2 text-caption text-foreground-secondary">
            <FileText className="icon-xs text-foreground-muted" aria-hidden />
            {att.fileName}
          </span>
        )
      )}
    </div>
  );
}

const time = (iso: string) => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

export default function AdminConversationDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [conversation, setConversation] = useState<AdminConversation | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .get<AdminConversation>(`/admin/conversations/${id}`)
      .then(setConversation)
      .catch(() => setError(true));
  }, [id]);

  if (error) return <Alert tone="error" title="Conversation inaccessible">Elle n&apos;existe pas, ou vous n&apos;avez pas les droits de super-administrateur.</Alert>;
  if (!conversation) return <LoadingBlock />;

  const { user } = conversation;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        leading={<IconButton label="Retour aux conversations" icon={ArrowLeft} variant="outline" onClick={() => router.push('/admin/conversations')} />}
        title={conversation.title || 'Nouvelle conversation'}
        description={`Créée le ${time(conversation.createdAt)} · ${conversation.messages.length} messages`}
      />

      <Card className="flex flex-wrap items-center gap-3">
        <Avatar src={user.avatarUrl} fallback={(user.name?.[0] || user.email[0] || '?').toUpperCase()} alt={user.name || user.email} />
        <div className="min-w-0 flex-1">
          <p className="text-label text-foreground">{user.name || 'Sans nom'}</p>
          <p className="text-caption text-foreground-muted">{user.email}</p>
        </div>
        <RoleBadge role={user.role} />
        <StatusBadge status={user.status} />
      </Card>

      <p className="flex items-center gap-2 text-caption text-foreground-muted">
        <Eye className="icon-xs" aria-hidden />
        Lecture seule. Cette consultation est inscrite dans l&apos;audit.
      </p>

      <ol className="flex flex-col gap-6">
        {conversation.messages.map((m) => (
          <li key={m.id} className="flex flex-col gap-1">
            <p className="text-caption text-foreground-muted">
              {m.role === 'user' ? user.name || 'Utilisateur' : 'Eyano'} · {time(m.createdAt)}
              {m.model ? ` · ${m.model}` : ''}
            </p>
            {m.role === 'user' ? (
              <div className="self-start whitespace-pre-wrap break-words rounded-lg bg-surface px-4 py-2 text-body-md text-foreground">
                {m.content}
              </div>
            ) : m.status === 'FAILED' ? (
              <p className="flex items-center gap-2 text-body-md text-foreground-secondary">
                <AlertCircle className="icon-sm text-error" aria-hidden />
                {m.content}
              </p>
            ) : (
              <Markdown content={m.content} />
            )}
            <Attachments items={m.attachments} />
          </li>
        ))}
      </ol>
    </div>
  );
}
