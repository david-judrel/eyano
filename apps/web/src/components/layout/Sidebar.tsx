'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, LogOut, MoreHorizontal, Pencil, Plus, Settings, Shield, Sparkles, Trash2, X } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useLongPress } from '@/hooks/useLongPress';
import { Avatar } from '@/components/ui/avatar';
import { Logo } from '@/components/ui/logo';
import { Button, IconButton } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Sheet, SheetContent } from '@/components/ui/overlay';
import { ThemeSwitcher } from './ThemeSwitcher';

type Conversation = { id: string; title: string | null; updatedAt: string };

/* ------------------------------------------------------------ Conversation */

interface ConversationItemProps {
  conv: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}

function ConversationItem({ conv, isActive, onSelect, onRename, onDelete }: ConversationItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(conv.title || '');
  const longPress = useLongPress({ onLongPress: () => setMenuOpen(true) });
  const label = conv.title || 'Nouvelle conversation';

  if (editing) {
    const submit = () => {
      onRename(title);
      setEditing(false);
    };
    return (
      <div className="flex items-center gap-1 rounded-md bg-selected px-1 py-1">
        <input
          autoFocus
          aria-label="Nouveau titre"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="h-7 min-w-0 flex-1 rounded-sm bg-transparent px-1 text-body-sm text-foreground touch:h-10 touch:text-body-lg"
        />
        <IconButton label="Valider" icon={Check} size="sm" tooltip={false} onClick={submit} />
        <IconButton label="Annuler" icon={X} size="sm" tooltip={false} onClick={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div
      {...longPress}
      className={cn(
        'group relative flex select-none items-center rounded-md transition-colors duration-fast',
        isActive ? 'bg-selected' : 'hover:bg-hover'
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'flex h-9 min-w-0 flex-1 items-center rounded-md px-2 text-left text-body-sm touch:h-11 touch:text-body-md',
          isActive ? 'font-medium text-foreground' : 'text-foreground-secondary group-hover:text-foreground'
        )}
      >
        <span className="truncate">{label}</span>
      </button>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <IconButton
            label={`Actions pour « ${label} »`}
            icon={MoreHorizontal}
            size="sm"
            tooltip={false}
            className="mr-0.5 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100 lg:data-[state=open]:opacity-100"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            icon={Pencil}
            onSelect={() => {
              setTitle(conv.title || '');
              setEditing(true);
            }}
          >
            Renommer
          </DropdownMenuItem>
          <DropdownMenuItem icon={Trash2} destructive onSelect={onDelete}>
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Regroupe les conversations par anciennete. */
function groupByAge(conversations: Conversation[]): [string, Conversation[]][] {
  const order = ["Aujourd'hui", 'Hier', 'Cette semaine', 'Plus ancien'];
  const groups: Record<string, Conversation[]> = {};
  const now = Date.now();
  for (const conv of conversations) {
    const days = Math.floor((now - new Date(conv.updatedAt).getTime()) / 86_400_000);
    const label = days <= 0 ? order[0] : days === 1 ? order[1] : days <= 7 ? order[2] : order[3];
    (groups[label] ??= []).push(conv);
  }
  return order.filter((label) => groups[label]).map((label) => [label, groups[label]]);
}

/* ------------------------------------------------------------- Contenu */

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const {
    conversations, setConversations, activeConversationId, setActiveConversationId,
    setSidebarOpen, user, setUser, setMessages, updateConversation,
  } = useAppStore();

  const close = () => setSidebarOpen(false);

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    router.push('/');
    close();
  };

  const handleSelect = (id: string) => {
    setActiveConversationId(id);
    router.push(`/c/${id}`);
    close();
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteConversation(id);
      setConversations(conversations.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
        router.push('/');
      }
    } catch {}
  };

  const handleRename = async (id: string, title: string) => {
    if (!title.trim()) return;
    try {
      await api.updateConversation(id, { title: title.trim() });
      updateConversation(id, { title: title.trim() });
    } catch {}
  };

  const handleLogout = () => {
    api.setToken(null);
    setUser(null);
    setConversations([]);
    setActiveConversationId(null);
    setMessages([]);
    router.push('/login');
  };

  const goTo = (path: string) => {
    router.push(path);
    close();
  };

  return (
    <>
      <div className="flex h-topbar shrink-0 items-center justify-between px-4">
        <button type="button" onClick={handleNewConversation} className="flex items-center gap-2 rounded-md touch:h-10" aria-label="Eyano, accueil">
          <Logo size="md" />
          <span className="text-heading-sm text-foreground">Eyano</span>
        </button>
        {onClose && <IconButton label="Fermer le menu" icon={X} size="sm" tooltip={false} onClick={onClose} />}
      </div>

      <div className="px-3 pb-3">
        <Button variant="secondary" icon={Plus} className="w-full justify-start" onClick={handleNewConversation}>
          Nouvelle conversation
        </Button>
      </div>

      <nav aria-label="Conversations" className="scrollbar-hide flex-1 overflow-y-auto px-3 pb-4">
        {conversations.length === 0 ? (
          <p className="px-2 py-6 text-body-sm text-foreground-muted">Vos conversations apparaîtront ici.</p>
        ) : (
          groupByAge(conversations).map(([label, items]) => (
            <div key={label} className="mt-4 first:mt-0">
              <h3 className="px-2 pb-1 text-caption text-foreground-muted">{label}</h3>
              <ul className="flex flex-col gap-0.5">
                {items.map((conv) => (
                  <li key={conv.id}>
                    <ConversationItem
                      conv={conv}
                      isActive={activeConversationId === conv.id}
                      onSelect={() => handleSelect(conv.id)}
                      onRename={(title) => handleRename(conv.id, title)}
                      onDelete={() => handleDelete(conv.id)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </nav>

      <div className="flex shrink-0 flex-col gap-3 border-t border-border-subtle p-3">
        <div className="flex items-start gap-3 rounded-lg border border-border-subtle bg-surface-raised p-3">
          <Sparkles className="icon-sm mt-0.5 text-brand-text" aria-hidden />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div>
              <p className="text-label text-foreground">Eyano Pro</p>
              <p className="text-caption text-foreground-muted">IA illimitée, vitesse maximale</p>
            </div>
            <Button variant="outline" size="sm" className="self-start">Mettre à niveau</Button>
          </div>
        </div>

        {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
          <Button variant="ghost" icon={Shield} className="justify-start" onClick={() => goTo('/admin/overview')}>
            Administration
          </Button>
        )}

        <div className="flex items-center justify-between px-1">
          <span className="text-caption text-foreground-muted">Thème</span>
          <ThemeSwitcher />
        </div>

        {user && (
          <div className="flex items-center gap-2 rounded-md px-1 py-1">
            <Avatar src={user.avatarUrl} fallback={(user.name?.[0] || user.email[0] || '?').toUpperCase()} alt={user.name || user.email} size="sm" />
            <span className="min-w-0 flex-1 truncate text-label text-foreground">{user.name || user.email.split('@')[0]}</span>
            <IconButton label="Paramètres" icon={Settings} size="sm" onClick={() => goTo('/profile')} />
            <IconButton label="Se déconnecter" icon={LogOut} size="sm" onClick={handleLogout} />
          </div>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------- Sidebar */

/** Desktop (lg) : colonne fixe. Mobile : tiroir accessible (Sheet). */
export function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useAppStore();

  return (
    <>
      <aside className="hidden w-sidebar shrink-0 flex-col border-r border-border-subtle bg-background-subtle lg:flex">
        <SidebarContent />
      </aside>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent title="Menu" side="left" className="lg:hidden">
          <SidebarContent onClose={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
