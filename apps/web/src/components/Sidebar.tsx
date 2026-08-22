'use client';

import { LogOut, Trash2, ChevronLeft, Crown, Plus, Settings, MessageSquare, Pencil, Check, X, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import { cn, truncate } from '@/lib/utils';
import { Avatar } from './ui/avatar';
import { Logo } from './ui/logo';

export function Sidebar() {
  const router = useRouter();
  const {
    conversations, setConversations, activeConversationId, setActiveConversationId,
    sidebarOpen, setSidebarOpen, user, setUser, setMessages, updateConversation,
  } = useAppStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

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
    if (!confirm('Supprimer cette conversation ?')) return;
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
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-[#050505]/80 backdrop-blur-md z-30 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed lg:relative z-40 h-full w-[280px] flex flex-col',
          'transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
          'bg-[#0D0F0E]/95 border-r border-[#F2FFF0]/[6%]',
          'backdrop-blur-xl',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex items-center justify-between px-5 h-16 shrink-0 border-b border-[#F2FFF0]/[4%]">
          <div
            className="flex items-center gap-3 group cursor-pointer"
            onClick={handleNewConversation}
          >
            <Logo size="md" className="shrink-0 transition-transform group-hover:scale-105" />
            <span className="text-[16px] font-bold tracking-tight text-[#F2FFF0]">Eyano</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg text-[#F2FFF0]/30 hover:text-[#39FF14] hover:bg-[#39FF14]/[8%] transition-all lg:hidden"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 py-5">
          <button
            onClick={handleNewConversation}
            className={cn(
              'w-full flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl text-[13px] font-bold',
              'bg-[#39FF14] text-[#050505]',
              'hover:brightness-110 active:scale-[0.98]',
              'transition-all duration-200 shadow-[0_0_20px_rgba(57,255,20,0.15)]',
            )}
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            Nouvelle conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-4 space-y-8">
          {Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] px-1 mb-3 text-[#F2FFF0]/20">
                {dateLabel}
              </div>
              <div className="space-y-1">
                {items.map((conv) => (
                  <div
                    key={conv.id}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] transition-all duration-150 group relative',
                      activeConversationId === conv.id
                        ? 'bg-[#39FF14]/[8%] text-[#39FF14] font-medium border border-[#39FF14]/15'
                        : 'text-[#F2FFF0]/40 hover:text-[#F2FFF0]/80 hover:bg-[#F2FFF0]/[4%] border border-transparent',
                    )}
                  >
                    {editingId === conv.id ? (
                      <div className="flex items-center gap-1 w-full">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleRename(conv.id); if (e.key === 'Escape') setEditingId(null); }}
                          className="flex-1 bg-transparent border-b border-[#39FF14]/40 text-[#F2FFF0] text-[13px] focus:outline-none px-1 py-0.5"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button onClick={(e) => { e.stopPropagation(); handleRename(conv.id); }} className="p-1 text-[#39FF14] hover:bg-[#39FF14]/10 rounded">
                          <Check className="h-3 w-3" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} className="p-1 text-[#F2FFF0]/30 hover:text-[#F2FFF0] rounded">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleSelectConversation(conv.id)}
                          className="flex items-center gap-3 min-w-0 flex-1"
                        >
                          <MessageSquare className={cn("h-3.5 w-3.5 shrink-0", activeConversationId === conv.id ? "opacity-100" : "opacity-30")} />
                          <span className="truncate text-left">{truncate(conv.title || 'Nouvelle conversation', 22)}</span>
                        </button>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 bg-[#0D0F0E] pl-2">
                          <span className="text-[10px] text-[#F2FFF0]/20 mr-1">
                            {new Date(conv.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingId(conv.id); setEditTitle(conv.title || ''); }}
                            className="p-1.5 rounded-md hover:bg-[#F2FFF0]/[8%] hover:text-[#F2FFF0] transition-colors"
                            title="Renommer"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteConversation(conv.id, e)}
                            className="p-1.5 rounded-md hover:bg-red-500/20 hover:text-red-400 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {conversations.length === 0 && Object.keys(grouped).length === 0 && (
            <div className="px-2 py-10 text-center border border-dashed border-[#F2FFF0]/[6%] rounded-xl">
              <p className="text-xs text-[#F2FFF0]/15">Commencez une nouvelle discussion</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#F2FFF0]/[4%] bg-gradient-to-b from-transparent to-[#0D0F0E]/80">
          {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
            <button
              onClick={() => { router.push('/admin/overview'); setSidebarOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 mb-3 rounded-xl border border-[#39FF14]/[10%] bg-[#39FF14]/[5%] text-[#39FF14] text-[13px] font-medium hover:bg-[#39FF14]/[10%] transition-all"
            >
              <Shield className="h-4 w-4" />
              Administration
            </button>
          )}

          <div className="mb-4 p-3.5 rounded-xl border border-[#39FF14]/[10%] bg-gradient-to-br from-[#39FF14]/[5%] to-transparent relative overflow-hidden group cursor-pointer">
            <div className="absolute top-0 right-0 w-16 h-16 bg-[#39FF14]/[10%] blur-2xl rounded-full -mr-8 -mt-8" />
            <div className="flex items-start gap-3 mb-3 relative z-10">
              <Crown className="h-4 w-4 text-[#39FF14] mt-0.5 shrink-0" />
              <div>
                <p className="text-[13px] font-bold text-[#F2FFF0]">Eyano Pro</p>
                <p className="text-[11px] text-[#F2FFF0]/30 mt-0.5 leading-relaxed">
                  IA illimitee - Vitesse max
                </p>
              </div>
            </div>
            <button className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                               bg-[#39FF14] text-[#050505] text-[12px] font-bold
                               hover:brightness-110 active:scale-[0.98]
                               shadow-[0_0_15px_rgba(57,255,20,0.2)]
                               transition-all duration-200">
              Mettre a niveau
            </button>
          </div>

          {user && (
            <div
              onClick={() => { router.push('/profile'); setSidebarOpen(false); }}
              className="group/profile relative flex items-center gap-3 px-2.5 py-2.5 rounded-xl
                            hover:bg-[#F2FFF0]/[4%] transition-colors duration-200 cursor-pointer"
            >
              <Avatar
                src={user.avatarUrl}
                fallback={user.name?.[0] || user.email[0]?.toUpperCase()}
                size="sm"
                className="bg-[#39FF14]/[10%] text-[#39FF14] border border-[#39FF14]/20 ring-2 ring-[#0D0F0E] shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold truncate text-[#F2FFF0]/85 group-hover/profile:text-[#F2FFF0] transition-colors">
                  {user.name || user.email.split('@')[0]}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#39FF14] shadow-[0_0_6px_rgba(57,255,20,0.6)] animate-pulse" />
                  <span className="text-[10px] text-[#39FF14]/70 font-medium">En ligne</span>
                </div>
              </div>

              <div className="flex items-center gap-0.5 opacity-0 group-hover/profile:opacity-100 transition-all duration-200">
                <button
                  onClick={(e) => { e.stopPropagation(); router.push('/profile'); setSidebarOpen(false); }}
                  className="p-2 rounded-lg hover:bg-[#F2FFF0]/[8%] transition-colors text-[#F2FFF0]/30 hover:text-[#F2FFF0]"
                  title="Parametres"
                >
                  <Settings className="h-4 w-4" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleLogout(); }} className="p-2 rounded-lg hover:bg-red-500/10 transition-colors text-[#F2FFF0]/30 hover:text-red-400" title="Deconnexion">
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
