'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Loader2, Mail, User, Calendar, MessageSquare, Cpu, LogOut, Pencil, X, Zap } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';
import { Logo } from '@/components/ui/logo';
import { ToastContainer } from '@/components/Toast';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

interface UsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  byModel: Record<string, { inputTokens: number; outputTokens: number }>;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, setUser, conversations, setConversations } = useAppStore();
  const { addToast } = useToast();

  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<UsageStats | null>(null);

  useEffect(() => {
    const token = api.getToken();
    if (!token) { router.push('/login'); return; }

    Promise.all([api.getMe(), api.getConversations(), api.getUsage()])
      .then(([u, convos, stats]) => {
        setUser(u);
        setName(u.name || '');
        setConversations(convos);
        setUsage(stats);
      })
      .catch(() => { api.setToken(null); router.push('/login'); })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const updated = await api.patch<any>('/users/me', { name: name.trim() });
      setUser({ ...user!, name: updated.name });
      setEditing(false);
      addToast('Profil mis à jour', 'success');
    } catch {
      addToast('Erreur lors de la mise à jour', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    api.setToken(null);
    setUser(null);
    setConversations([]);
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen w-full bg-[#050505] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#39FF14]" />
      </div>
    );
  }

  if (!user) return null;

  const totalConversations = conversations.length;
  const totalMessages = conversations.reduce((acc, c) => acc + (c._count?.messages || 0), 0);
  const totalTokens = (usage?.totalInputTokens || 0) + (usage?.totalOutputTokens || 0);

  return (
    // ✅ CONTENEUR SCROLLABLE RESPONSIVE
    <div className="flex flex-col h-full w-full bg-[#050505] overflow-y-auto">
      <ToastContainer />

      {/* Header Sticky */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#050505]/90 border-b border-[#F2FFF0]/[4%] shrink-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <button onClick={() => router.push('/')}
            className="flex items-center gap-2 text-[#F2FFF0]/40 hover:text-[#39FF14] transition-colors group">
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-sm font-medium">Retour</span>
          </button>
          <div className="flex items-center gap-2 opacity-60">
            <Logo size="sm" />
            <span className="text-sm font-bold tracking-tight hidden sm:inline">Eyano</span>
          </div>
        </div>
      </div>

      {/* Contenu Principal - Padding adaptatif mobile/desktop */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8 pb-20">

        {/* Carte Profil - Padding réduit sur mobile */}
        <div className="relative rounded-2xl sm:rounded-3xl border border-[#F2FFF0]/[6%] bg-[#0D0F0E]/60 backdrop-blur-xl overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(57,255,20,0.08)_0%,transparent_50%)] pointer-events-none" />
          <div className="relative p-5 sm:p-8 md:p-10 flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-8">
            <Avatar src={user.avatarUrl} fallback={user.name?.[0] || user.email[0]?.toUpperCase()} size="lg"
              className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 text-2xl sm:text-3xl bg-[#39FF14]/[10%] text-[#39FF14] border-2 border-[#39FF14]/20 shadow-[0_0_30px_rgba(57,255,20,0.1)] shrink-0" />
            <div className="flex-1 text-center sm:text-left min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#F2FFF0] tracking-tight truncate">{user.name || 'Utilisateur'}</h1>
              <p className="text-sm sm:text-base text-[#F2FFF0]/40 mt-1 sm:mt-2 font-light break-all">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Stats Grid - 1 colonne mobile, 3 colonnes desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {[
            { label: 'Conversations', value: totalConversations, icon: MessageSquare },
            { label: 'Messages', value: totalMessages, icon: Zap },
            { label: 'Tokens utilisés', value: totalTokens > 0 ? `${(totalTokens / 1000).toFixed(1)}k` : '0', icon: Cpu },
          ].map((stat, i) => (
            <div key={i} className="rounded-xl sm:rounded-2xl border border-[#F2FFF0]/[6%] bg-[#0D0F0E]/60 p-4 sm:p-6 flex flex-col items-center justify-center gap-2 sm:gap-3 hover:border-[#39FF14]/20 transition-colors duration-300">
              <stat.icon className="h-5 w-5 sm:h-6 sm:w-6 text-[#39FF14]/60" />
              <div className="text-2xl sm:text-3xl font-bold text-[#F2FFF0]">{stat.value}</div>
              <div className="text-[10px] sm:text-xs font-medium text-[#F2FFF0]/30 uppercase tracking-wider">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Section Infos Compte */}
        <div className="rounded-2xl sm:rounded-3xl border border-[#F2FFF0]/[6%] bg-[#0D0F0E]/60 backdrop-blur-xl overflow-hidden">
          <div className="px-5 sm:px-8 py-4 sm:py-5 border-b border-[#F2FFF0]/[4%]">
            <h2 className="text-base sm:text-lg font-semibold text-[#F2FFF0]">Informations du compte</h2>
          </div>
          <div className="p-5 sm:p-8 space-y-6 sm:space-y-8">

            {/* Nom */}
            <div>
              <label className="text-[10px] sm:text-xs font-bold text-[#F2FFF0]/30 uppercase tracking-widest mb-2 sm:mb-3 block">Nom d'affichage</label>
              {!editing ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative flex-1">
                    <User className="absolute left-3 sm:left-4 top-1/2 h-4 sm:h-5 w-4 sm:w-5 -translate-y-1/2 text-[#F2FFF0]/20" />
                    <input type="text" value={user.name || ''} disabled
                      className="h-12 sm:h-14 w-full rounded-xl sm:rounded-2xl border border-[#F2FFF0]/[8%] bg-[#050505]/50 pl-10 sm:pl-12 pr-4 text-sm sm:text-base text-[#F2FFF0]/60 cursor-not-allowed" />
                  </div>
                  <button onClick={() => { setEditing(true); setName(user.name || ''); }}
                    className="h-12 sm:h-14 px-4 sm:px-6 rounded-xl sm:rounded-2xl flex items-center justify-center sm:justify-start gap-2 text-sm font-bold border border-[#F2FFF0]/[8%] text-[#F2FFF0]/50 hover:text-[#39FF14] hover:border-[#39FF14]/30 hover:bg-[#39FF14]/[5%] transition-all active:scale-95 w-full sm:w-auto">
                    <Pencil className="h-4 w-4" /> Modifier
                  </button>
                </div>
              ) : (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative flex-1 group">
                      <User className="absolute left-3 sm:left-4 top-1/2 h-4 sm:h-5 w-4 sm:w-5 -translate-y-1/2 text-[#F2FFF0]/20 group-focus-within:text-[#39FF14] transition-colors" />
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus
                        className={cn('h-12 sm:h-14 w-full rounded-xl sm:rounded-2xl border bg-[#050505] pl-10 sm:pl-12 pr-14 sm:pr-16 text-sm sm:text-base text-[#F2FFF0] placeholder:text-[#F2FFF0]/20 focus:outline-none transition-all',
                          name.length > 0 && name.length < 3 ? 'border-red-500/40 focus:border-red-500/60' : 'border-[#39FF14]/40 focus:border-[#39FF14]/60')}
                        placeholder="Votre nom complet" />
                      <span className={cn('absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-[10px] sm:text-xs font-bold', name.length >= 60 ? 'text-yellow-400/70' : 'text-[#F2FFF0]/20')}>{name.length}/60</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={handleSave} disabled={saving || name.trim().length < 3}
                        className={cn('h-12 sm:h-14 px-4 sm:px-6 rounded-xl sm:rounded-2xl flex items-center gap-2 text-sm font-bold transition-all flex-1 sm:flex-none justify-center',
                          name.trim().length >= 3 ? 'bg-[#39FF14] text-[#050505] hover:brightness-110 active:scale-95' : 'bg-[#F2FFF0]/[6%] text-[#F2FFF0]/20 cursor-not-allowed')}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Sauvegarder
                      </button>
                      <button onClick={() => { setEditing(false); setName(user.name || ''); }}
                        className="h-12 sm:h-14 w-12 sm:w-14 rounded-xl sm:rounded-2xl flex items-center justify-center border border-[#F2FFF0]/[8%] text-[#F2FFF0]/30 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-all active:scale-95 shrink-0">
                        <X className="h-4 sm:h-5 w-4 sm:w-5" />
                      </button>
                    </div>
                  </div>
                  {name.length > 0 && name.length < 3 && <p className="text-[10px] sm:text-xs text-red-400/70 ml-1">Minimum 3 caractères requis.</p>}
                </div>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="text-[10px] sm:text-xs font-bold text-[#F2FFF0]/30 uppercase tracking-widest mb-2 sm:mb-3 block">Adresse email</label>
              <div className="relative">
                <Mail className="absolute left-3 sm:left-4 top-1/2 h-4 sm:h-5 w-4 sm:w-5 -translate-y-1/2 text-[#F2FFF0]/20" />
                <input type="email" value={user.email} disabled
                  className="h-12 sm:h-14 w-full rounded-xl sm:rounded-2xl border border-[#F2FFF0]/[8%] bg-[#050505]/50 pl-10 sm:pl-12 pr-4 text-sm sm:text-base text-[#F2FFF0]/40 cursor-not-allowed" />
              </div>
              <p className="text-[10px] sm:text-xs text-[#F2FFF0]/20 mt-1.5 sm:mt-2 ml-1">L'email ne peut pas être modifié.</p>
            </div>

            {/* Date membre */}
            <div>
              <label className="text-[10px] sm:text-xs font-bold text-[#F2FFF0]/30 uppercase tracking-widest mb-2 sm:mb-3 block">Membre depuis</label>
              <div className="relative">
                <Calendar className="absolute left-3 sm:left-4 top-1/2 h-4 sm:h-5 w-4 sm:w-5 -translate-y-1/2 text-[#F2FFF0]/20" />
                <input type="text" value={new Date(user.createdAt || Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} disabled
                  className="h-12 sm:h-14 w-full rounded-xl sm:rounded-2xl border border-[#F2FFF0]/[8%] bg-[#050505]/50 pl-10 sm:pl-12 pr-4 text-sm sm:text-base text-[#F2FFF0]/40 cursor-not-allowed" />
              </div>
            </div>
          </div>
        </div>

        {/* Zone Danger */}
        <div className="rounded-2xl sm:rounded-3xl border border-red-500/10 bg-[#0D0F0E]/60 backdrop-blur-xl overflow-hidden">
          <div className="px-5 sm:px-8 py-4 sm:py-5 border-b border-red-500/10">
            <h2 className="text-base sm:text-lg font-semibold text-red-400/80">Zone de danger</h2>
          </div>
          <div className="p-5 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
            <div className="text-center sm:text-left">
              <p className="text-sm sm:text-base text-[#F2FFF0]/80 font-semibold">Se déconnecter</p>
              <p className="text-xs sm:text-sm text-[#F2FFF0]/30 mt-1">Vous devrez vous reconnecter pour accéder à votre compte.</p>
            </div>
            <button onClick={handleLogout}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl border border-red-500/20 text-red-400 text-sm font-bold hover:bg-red-500/10 hover:border-red-500/30 transition-all active:scale-95">
              <LogOut className="h-4 w-4" /> Déconnexion
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-[#F2FFF0]/15 select-none pt-4">Eyano v1.0 — Propulsé par l'IA</p>
      </main>
    </div>
  );
}