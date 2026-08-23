'use client';

import { LogOut, Trash2, ChevronLeft, Crown, Plus, Settings, MessageSquare, Pencil, MoreVertical, X, Shield, Sun, Moon, Monitor } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import { cn, truncate } from '@/lib/utils';
import { Avatar } from './ui/avatar';
import { Logo } from './ui/logo';
import { useLongPress } from '@/hooks/useLongPress';
import { useTheme } from '@/lib/theme-provider';

interface ConversationItemProps {
  conv: { id: string; title: string; updatedAt: string };
  isActive: boolean;
  isEditing: boolean;
  editTitle: string;
  onEditTitleChange: (v: string) => void;
  onSelect: () => void;
  onRename: () => void;
  onCancelEdit: () => void;
  onContextMenu: (e: React.TouchEvent | React.MouseEvent) => void;
}

function ConversationItem({ conv, isActive, isEditing, editTitle, onEditTitleChange, onSelect, onRename, onCancelEdit, onContextMenu }: ConversationItemProps) {
  const longPressHandlers = useLongPress({ onLongPress: onContextMenu });

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-brand/[8%] border border-brand/15 animate-in fade-in slide-in-from-left-2">
        <input type="text" value={editTitle} onChange={(e) => onEditTitleChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onRename(); if (e.key === 'Escape') onCancelEdit(); }}
          className="flex-1 bg-transparent border-b border-brand/40 text-foreground text-[13px] focus:outline-none px-1 py-0.5" autoFocus />
        <button onClick={onRename} className="p-1.5 text-brand hover:bg-brand/10 rounded-lg touch-manipulation"><Pencil className="h-3.5 w-3.5" /></button>
        <button onClick={onCancelEdit} className="p-1.5 text-foreground/30 hover:text-foreground rounded-lg touch-manipulation"><X className="h-3.5 w-3.5" /></button>
      </div>
    );
  }

  return (
    <div {...longPressHandlers}
      className={cn(
        'w-full flex items-center justify-between px-3 py-3 rounded-xl text-[13px] transition-all duration-150 select-none touch-manipulation',
        isActive
          ? 'bg-brand/[8%] text-brand font-medium border border-brand/15'
          : 'text-foreground/40 hover:text-foreground/80 hover:bg-surface-2 border border-transparent active:bg-foreground/[2%]'
      )}
    >
      <div onClick={onSelect} className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer">
        <MessageSquare className={cn("h-3.5 w-3.5 shrink-0", isActive ? "opacity-100" : "opacity-30")} />
        <span className="truncate text-left">{truncate(conv.title || 'Nouvelle conversation', 24)}</span>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onContextMenu(e); }}
        className="lg:hidden p-1.5 ml-1 rounded-lg text-foreground/20 hover:text-foreground/60 touch-manipulation">
        <MoreVertical className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function Sidebar() {
  const router = useRouter();
  const {
    conversations, setConversations, activeConversationId, setActiveConversationId,
    sidebarOpen, setSidebarOpen, user, setUser, setMessages, updateConversation,
  } = useAppStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fermer le menu contextuel si on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    router.push('/');
    setSidebarOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    if (editingId) return; // Empêcher la navigation si on est en mode édition
    setActiveConversationId(id);
    router.push(`/c/${id}`);
    setSidebarOpen(false);
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await api.deleteConversation(id);
      setConversations(conversations.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
        router.push('/');
      }
    } catch {}
    setContextMenu(null);
  };

  const handleRename = async (id: string) => {
    if (editTitle.trim()) {
      try {
        await api.updateConversation(id, { title: editTitle.trim() });
        updateConversation(id, { title: editTitle.trim() });
      } catch {}
    }
    setEditingId(null);
  };

  const handleLogout = () => {
    api.setToken(null);
    setUser(null);
    setConversations([]);
    setActiveConversationId(null);
    setMessages([]);
    router.push('/login');
  };

  // Gestionnaire d'appui long pour mobile
  const handleLongPress = (id: string, e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    setContextMenu({ id, x: 16, y: rect.bottom + 4 });
  };

  const grouped = conversations.reduce((acc, conv) => {
    const now = new Date();
    const convDate = new Date(conv.updatedAt);
    const diffDays = Math.floor((now.getTime() - convDate.getTime()) / (1000 * 60 * 60 * 24));
    let label = "Aujourd'hui";
    if (diffDays === 1) label = 'Hier';
    else if (diffDays > 1 && diffDays <= 7) label = 'Cette semaine';
    else if (diffDays > 7) label = 'Plus ancien';
    if (!acc[label]) acc[label] = [];
    acc[label].push(conv);
    return acc;
  }, {} as Record<string, typeof conversations>);

  return (
    <>
      {/* Backdrop Mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-md z-30 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed lg:relative z-40 h-full w-[280px] flex flex-col',
          'transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
          'bg-surface/95 border-r border-border',
          'backdrop-blur-xl',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-16 shrink-0 border-b border-border">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={handleNewConversation}>
            <Logo size="md" className="shrink-0 transition-transform group-hover:scale-105" />
            <span className="text-[16px] font-bold tracking-tight text-foreground">Eyano</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg text-foreground/30 hover:text-brand hover:bg-brand/[8%] transition-all lg:hidden touch-manipulation">
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>

        {/* Bouton Nouveau Chat - Zone de tap large */}
        <div className="px-4 py-3">
          <button onClick={handleNewConversation} className={cn(
            'w-full flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl text-[13px] font-bold',
            'bg-brand text-brand-foreground hover:brightness-110 active:scale-[0.98]',
            'transition-all duration-200 shadow-[0_0_20px_rgba(57,255,20,0.15)] touch-manipulation'
          )}>
            <Plus className="h-4 w-4 stroke-[2.5]" />
            Nouvelle conversation
          </button>
        </div>

        {/* Liste Scrollable */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-4 space-y-8 relative">
          
          {/* Menu Contextuel Tactile (Positionné absolument) */}
          {contextMenu && (
            <div 
              ref={menuRef}
              className="fixed z-[60] w-48 py-2 rounded-xl bg-surface-3 border border-border shadow-2xl animate-in fade-in zoom-in-95 duration-150"
              style={{ 
                top: Math.min(contextMenu.y, window.innerHeight - 160), 
                left: contextMenu.x
              }}
            >
              <button onClick={() => { setEditingId(contextMenu.id); setEditTitle(conversations.find(c => c.id === contextMenu.id)?.title || ''); setContextMenu(null); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground/70 hover:bg-surface-2 hover:text-foreground transition-colors">
                <Pencil className="h-4 w-4" /> Renommer
              </button>
              <button onClick={() => handleDeleteConversation(contextMenu.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400/80 hover:bg-red-500/10 hover:text-red-400 transition-colors">
                <Trash2 className="h-4 w-4" /> Supprimer
              </button>
              <button onClick={() => setContextMenu(null)}
                className="w-full flex items-center gap-3 px-4 py-2 mt-1 border-t border-border text-xs text-foreground/30 hover:text-foreground/50">
                <X className="h-3 w-3" /> Fermer
              </button>
            </div>
          )}

          {/* Conversations Groupées */}
          {Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] px-1 mb-3 text-foreground/20 select-none">
                {dateLabel}
              </div>
              <div className="space-y-1">
                {items.map((conv) => (
                  <div key={conv.id} className="relative">
                    <ConversationItem
                      conv={conv}
                      isActive={activeConversationId === conv.id}
                      isEditing={editingId === conv.id}
                      editTitle={editTitle}
                      onEditTitleChange={setEditTitle}
                      onSelect={() => handleSelectConversation(conv.id)}
                      onRename={() => handleRename(conv.id)}
                      onCancelEdit={() => setEditingId(null)}
                      onContextMenu={(e) => handleLongPress(conv.id, e)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {conversations.length === 0 && Object.keys(grouped).length === 0 && (
            <div className="px-2 py-10 text-center border border-dashed border-border rounded-xl select-none">
              <p className="text-xs text-foreground/15">Commencez une nouvelle discussion</p>
            </div>
          )}
        </div>

        {/* Footer Utilisateur & Pro */}
        <div className="p-4 border-t border-border bg-gradient-to-b from-transparent to-surface/80 shrink-0">
          
          {/* Theme Switcher */}
          <ThemeSwitcherRow />

          {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
            <button onClick={() => { router.push('/admin/overview'); setSidebarOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 mb-3 rounded-xl border border-brand/[10%] bg-brand/[5%] text-brand text-[13px] font-medium hover:bg-brand/[10%] transition-all touch-manipulation">
              <Shield className="h-4 w-4" /> Administration
            </button>
          )}

          <div className="mb-4 p-3.5 rounded-xl border border-brand/[10%] bg-gradient-to-br from-brand/[5%] to-transparent relative overflow-hidden group cursor-pointer">
            <div className="absolute top-0 right-0 w-16 h-16 bg-brand/[10%] blur-2xl rounded-full -mr-8 -mt-8" />
            <div className="flex items-start gap-3 mb-3 relative z-10">
              <Crown className="h-4 w-4 text-brand mt-0.5 shrink-0" />
              <div>
                <p className="text-[13px] font-bold text-foreground">Eyano Pro</p>
                <p className="text-[11px] text-foreground/30 mt-0.5 leading-relaxed">IA illimitée • Vitesse max</p>
              </div>
            </div>
            <button className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-brand text-brand-foreground text-[12px] font-bold hover:brightness-110 active:scale-[0.98] shadow-[0_0_15px_rgba(57,255,20,0.2)] transition-all duration-200 touch-manipulation">
              Mettre à niveau
            </button>
          </div>

          {user && (
            <div onClick={() => { router.push('/profile'); setSidebarOpen(false); }}
              className="group/profile relative flex items-center gap-3 px-2.5 py-2.5 rounded-xl hover:bg-surface-2 transition-colors duration-200 cursor-pointer touch-manipulation">
              <Avatar src={user.avatarUrl} fallback={user.name?.[0] || user.email[0]?.toUpperCase()} size="sm"
                className="bg-brand/[10%] text-brand border border-brand/20 ring-2 ring-surface shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold truncate text-foreground/85 group-hover/profile:text-foreground transition-colors">
                  {user.name || user.email.split('@')[0]}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand shadow-[0_0_6px_rgba(57,255,20,0.6)] animate-pulse" />
                  <span className="text-[10px] text-brand/70 font-medium">En ligne</span>
                </div>
              </div>
              <div className="flex items-center gap-0.5 lg:opacity-0 lg:group-hover/profile:opacity-100 transition-all duration-200">
                <button onClick={(e) => { e.stopPropagation(); router.push('/profile'); setSidebarOpen(false); }}
                  className="p-2 rounded-lg hover:bg-surface-2 transition-colors text-foreground/30 hover:text-foreground" title="Paramètres">
                  <Settings className="h-4 w-4" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleLogout(); }}                   className="p-2 rounded-lg hover:bg-red-500/10 transition-colors text-foreground/30 hover:text-red-400" title="Déconnexion">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function ThemeSwitcherRow() {
  const { theme, setTheme } = useTheme();
  const options = [
    { value: 'dark' as const, icon: Moon, label: 'Sombre' },
    { value: 'light' as const, icon: Sun, label: 'Clair' },
    { value: 'system' as const, icon: Monitor, label: 'Systeme' },
  ];

  return (
    <div className="mb-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.15em] px-1 mb-2 text-foreground/20 select-none">Theme</div>
      <div className="flex gap-1.5">
        {options.map((opt) => {
          const Icon = opt.icon;
          const active = theme === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              title={opt.label}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium transition-all duration-200 touch-manipulation',
                active
                  ? 'bg-brand/10 text-brand border border-brand/20'
                  : 'text-foreground/30 hover:text-foreground/60 hover:bg-surface-2 border border-transparent'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}