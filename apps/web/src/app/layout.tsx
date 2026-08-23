'use client';

import { 
  MessageSquare, Plus, Settings, LogOut, Trash2, 
  ChevronLeft, Crown, Monitor, Moon, Sun 
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import { cn, truncate } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Logo } from '@/components/ui/logo';
import { useTheme } from '@/lib/theme-provider';

export function Sidebar() {
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  
  const {
    conversations, setConversations, activeConversationId, setActiveConversationId,
    sidebarOpen, setSidebarOpen, user, setUser, setMessages,
  } = useAppStore();

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    router.push('/');
    setSidebarOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    router.push(`/c/${id}`);
    setSidebarOpen(false);
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleLogout = () => {
    api.setToken(null);
    setUser(null);
    setConversations([]);
    setActiveConversationId(null);
    setMessages([]);
    router.push('/login');
  };

  // Cycle automatique : system -> dark -> light -> system
  const cycleTheme = () => {
    if (theme === 'system') setTheme('dark');
    else if (theme === 'dark') setTheme('light');
    else setTheme('system');
  };

  // Icône dynamique selon l'état actuel
  const ThemeIcon = theme === 'system' ? Monitor 
    : resolvedTheme === 'dark' ? Moon : Sun;

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
          className="fixed inset-0 bg-[var(--ey-background)]/80 backdrop-blur-sm z-30 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed lg:relative z-40 h-full w-[280px] flex flex-col',
          'transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
          'bg-[var(--ey-surface)]/95 border-r border-[var(--ey-border)]',
          'backdrop-blur-xl',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Header Logo */}
        <div className="flex items-center justify-between px-5 h-16 shrink-0 border-b border-[var(--ey-border)]">
          <div 
            className="flex items-center gap-3 group cursor-pointer" 
            onClick={handleNewConversation}
          >
            <Logo size="md" className="shrink-0 transition-transform group-hover:scale-105" />
            <span className="text-[16px] font-bold tracking-tight text-[var(--ey-foreground)]">EYANO</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg text-[var(--ey-muted-foreground)] hover:text-[var(--ey-brand)] hover:bg-[var(--ey-brand-dim)] transition-all lg:hidden"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>

        {/* Bouton Nouvelle Conversation */}
        <div className="px-4 py-5">
          <button
            onClick={handleNewConversation}
            className={cn(
              'w-full flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl text-[13px] font-bold',
              'bg-[var(--ey-brand)] text-[var(--ey-brand-foreground)]',
              'hover:brightness-110 active:scale-[0.98]',
              'transition-all duration-200 shadow-[0_0_20px_rgba(57,255,20,0.15)]',
            )}
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            Nouvelle conversation
          </button>
        </div>

        {/* Zone Scrollable */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-4 space-y-8">
          
          {/* Conversations */}
          {Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] px-1 mb-3 text-[var(--ey-muted-foreground)]/60">
                {dateLabel}
              </div>
              <div className="space-y-1">
                {items.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] transition-all duration-150 group relative',
                      activeConversationId === conv.id
                        ? 'bg-[var(--ey-brand-dim)] text-[var(--ey-brand)] font-medium border border-[var(--ey-brand)]/15'
                        : 'text-[var(--ey-muted-foreground)] hover:text-[var(--ey-foreground)] hover:bg-[var(--ey-surface-2)] border border-transparent',
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <MessageSquare className={cn("h-3.5 w-3.5 shrink-0", activeConversationId === conv.id ? "opacity-100" : "opacity-30")} />
                      <span className="truncate">{truncate(conv.title || 'Nouvelle conversation', 22)}</span>
                    </div>
                    
                    {/* Actions au survol */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 bg-[var(--ey-surface)] pl-2">
                       <span className="text-[10px] text-[var(--ey-muted-foreground)]/40 mr-1">
                        {new Date(conv.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button 
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                        className="p-1.5 rounded-md hover:bg-red-500/20 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* ✅ SECTION APPARENCE / THÈME */}
          <div>
            <div className="px-1 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--ey-muted-foreground)]/60">
                Apparence
              </span>
            </div>
            <button
              onClick={cycleTheme}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px]',
                'text-[var(--ey-muted-foreground)] hover:text-[var(--ey-foreground)]',
                'hover:bg-[var(--ey-surface-2)] transition-all duration-200 group'
              )}
              title={`Thème actuel: ${theme === 'system' ? 'Système' : theme}`}
            >
              <div className={cn(
                'p-2 rounded-lg bg-[var(--ey-brand-dim)] border border-[var(--ey-brand)]/10',
                'group-hover:bg-[var(--ey-brand)]/20 transition-colors'
              )}>
                <ThemeIcon className="h-4 w-4 text-[var(--ey-brand)]" />
              </div>
              
              <span className="flex-1 text-left">
                {theme === 'system' ? 'Automatique' : resolvedTheme === 'dark' ? 'Mode sombre' : 'Mode clair'}
              </span>
              
              {/* Indicateur visuel */}
              <div className={cn(
                'w-1.5 h-1.5 rounded-full transition-colors',
                theme === 'system' ? 'bg-[var(--ey-muted-foreground)]' : 'bg-[var(--ey-brand)]'
              )} />
            </button>
          </div>

          {conversations.length === 0 && Object.keys(grouped).length === 0 && (
            <div className="px-2 py-10 text-center border border-dashed border-[var(--ey-border)] rounded-xl">
              <p className="text-xs text-[var(--ey-muted-foreground)]/40">Commencez une nouvelle discussion</p>
            </div>
          )}
        </div>

        {/* Footer Utilisateur & Pro */}
        <div className="p-4 border-t border-[var(--ey-border)] bg-gradient-to-b from-transparent to-[var(--ey-surface)]/80">
          
          {/* Carte Pro Upgrade */}
          <div className="mb-4 p-3.5 rounded-xl border border-[var(--ey-brand)]/10 bg-gradient-to-br from-[var(--ey-brand-dim)] to-transparent relative overflow-hidden group cursor-pointer">
            <div className="absolute top-0 right-0 w-16 h-16 bg-[var(--ey-brand)]/10 blur-2xl rounded-full -mr-8 -mt-8" />
            <div className="flex items-start gap-3 mb-3 relative z-10">
              <Crown className="h-4 w-4 text-[var(--ey-brand)] mt-0.5 shrink-0" />
              <div>
                <p className="text-[13px] font-bold text-[var(--ey-foreground)]">EYANO Pro</p>
                <p className="text-[11px] text-[var(--ey-muted-foreground)] mt-0.5 leading-relaxed">
                  IA illimitée • Vitesse max
                </p>
              </div>
            </div>
            <button className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg 
                               bg-[var(--ey-brand)] text-[var(--ey-brand-foreground)] text-[12px] font-bold
                               hover:brightness-110 active:scale-[0.98] 
                               shadow-[0_0_15px_rgba(57,255,20,0.2)] 
                               transition-all duration-200">
              Mettre à niveau
            </button>
          </div>

          {/* Profil Utilisateur */}
          {user && (
            <div className="group/profile relative flex items-center gap-3 px-2.5 py-2.5 rounded-xl 
                            hover:bg-[var(--ey-surface-2)] transition-colors duration-200 cursor-default">
              <Avatar
                src={user.avatarUrl}
                fallback={user.name?.[0] || user.email[0]?.toUpperCase()}
                size="sm"
                className="bg-[var(--ey-brand-dim)] text-[var(--ey-brand)] border border-[var(--ey-brand)]/20 ring-2 ring-[var(--ey-surface)] shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold truncate text-[var(--ey-foreground)]/85 group-hover/profile:text-[var(--ey-foreground)] transition-colors">
                  {user.name || user.email.split('@')[0]}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--ey-brand)] shadow-[0_0_6px_rgba(57,255,20,0.6)] animate-pulse" />
                  <span className="text-[10px] text-[var(--ey-brand)]/70 font-medium">En ligne</span>
                </div>
              </div>

              {/* Actions contextuelles */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover/profile:opacity-100 transition-all duration-200">
                <button className="p-2 rounded-lg hover:bg-[var(--ey-surface-3)] transition-colors text-[var(--ey-muted-foreground)] hover:text-[var(--ey-foreground)]" title="Paramètres">
                  <Settings className="h-4 w-4" />
                </button>
                <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-red-500/10 transition-colors text-[var(--ey-muted-foreground)] hover:text-red-400" title="Déconnexion">
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