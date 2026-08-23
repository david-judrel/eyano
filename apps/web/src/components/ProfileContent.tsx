'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Save, Loader2, Mail, User, Calendar, LogOut, Pencil, X, 
  ShieldCheck, Key, Palette, Database, Bell, Globe, ChevronRight, Eye, EyeOff 
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';
import { Logo } from '@/components/ui/logo';
import { ToastContainer } from '@/components/Toast';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { useTheme } from '@/lib/theme-provider';

export function ProfileContent() {
  const router = useRouter();
  const { user, setUser, setConversations } = useAppStore();
  const { addToast } = useToast();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('sk-eyano-xxxxxxxxxxxx');
  const [showKey, setShowKey] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [prefs, setPrefs] = useState({
    language: 'fr',
    notifications: true,
    dataRetention: '30d',
    modelDefault: 'gnoxe-brains-1'
  });

  useEffect(() => {
    const token = api.getToken();
    if (!token) { router.push('/login'); return; }

    api.getMe()
      .then((u) => {
        setUser(u);
        setName(u.name || '');
      })
      .catch(() => { api.setToken(null); router.push('/login'); })
      .finally(() => setLoading(false));
  }, []);

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const updated = await api.patch<any>('/users/me', { name: name.trim() });
      setUser({ ...user!, name: updated.name });
      setEditingName(false);
      addToast('Nom mis à jour', 'success');
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
      <div className="flex h-[100dvh] w-full bg-[var(--ey-background)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--ey-brand)]" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="h-full w-full bg-background flex flex-col overflow-y-auto overflow-x-hidden">
      <ToastContainer />

      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[var(--ey-background)]/90 border-b border-[var(--ey-border)] shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 lg:h-16 flex items-center justify-between">
          <button onClick={() => router.back()} 
            className="flex items-center gap-2 text-[var(--ey-muted-foreground)] hover:text-[var(--ey-brand)] transition-colors active:scale-95 touch-manipulation">
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium hidden sm:inline">Retour au chat</span>
          </button>
          <div className="flex items-center gap-3 opacity-70">
            <Logo size="sm" />
            <span className="text-sm font-bold tracking-tight hidden sm:inline">Paramètres & Compte</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 lg:py-10 space-y-8 pb-24 lg:pb-10">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          
          <div className="lg:col-span-4 space-y-6">
            
            <div className="relative rounded-2xl border border-[var(--ey-border)] bg-[var(--ey-surface)] overflow-hidden p-6 flex flex-col items-center text-center gap-4">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(57,255,20,0.06)_0%,transparent_50%)] pointer-events-none" />
              
              <Avatar src={user.avatarUrl} fallback={user.name?.[0]} size="lg"
                className="w-24 h-24 text-3xl bg-[var(--ey-brand-dim)] text-[var(--ey-brand)] border-2 border-[var(--ey-brand)]/20 shadow-lg relative z-10" />
              
              <div className="w-full relative z-10">
                {!editingName ? (
                  <>
                    <h1 className="text-xl font-bold text-[var(--ey-foreground)] truncate">{user.name || 'Utilisateur'}</h1>
                    <p className="text-sm text-[var(--ey-muted-foreground)] mt-1 break-all">{user.email}</p>
                    {user.role && (
                      <div className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full bg-[var(--ey-brand-dim)] border border-[var(--ey-brand)]/15">
                        <ShieldCheck className="h-3 w-3 text-[var(--ey-brand)]" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ey-brand)]">{user.role}</span>
                      </div>
                    )}
                    <button onClick={() => setEditingName(true)} 
                      className="mt-4 w-full h-10 rounded-xl border border-[var(--ey-border)] text-xs font-bold text-[var(--ey-muted-foreground)] hover:text-[var(--ey-brand)] hover:border-[var(--ey-brand)]/30 transition-all flex items-center justify-center gap-2 touch-manipulation">
                      <Pencil className="h-3.5 w-3.5" /> Modifier le profil
                    </button>
                  </>
                ) : (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                    <input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={60}
                      className="w-full h-10 rounded-xl border border-[var(--ey-brand)]/40 bg-[var(--ey-background)] px-3 text-sm text-[var(--ey-foreground)] focus:outline-none" placeholder="Votre nom" />
                    <div className="flex gap-2">
                      <button onClick={handleSaveName} disabled={saving || name.length < 3}
                        className="flex-1 h-9 rounded-lg bg-[var(--ey-brand)] text-[var(--ey-brand-foreground)] text-xs font-bold active:scale-95 touch-manipulation">
                        {saving ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : 'Sauvegarder'}
                      </button>
                      <button onClick={() => setEditingName(false)}
                        className="h-9 w-9 rounded-lg border border-[var(--ey-border)] text-[var(--ey-muted-foreground)] active:scale-95 touch-manipulation flex items-center justify-center">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--ey-border)] bg-[var(--ey-surface)] overflow-hidden divide-y divide-[var(--ey-border)]">
              {[
                { icon: Mail, label: 'Email', value: user.email },
                { icon: Calendar, label: 'Membre depuis', value: new Date(user.createdAt || Date.now()).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) },
                { icon: Database, label: 'ID Utilisateur', value: user.id?.slice(0, 8) + '...' },
              ].map((item, i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-3">
                  <item.icon className="h-4 w-4 text-[var(--ey-muted-foreground)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-[var(--ey-muted-foreground)] uppercase tracking-wider">{item.label}</p>
                    <p className="text-sm text-[var(--ey-foreground)] truncate font-mono">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6">
            
            <div className="rounded-2xl border border-[var(--ey-border)] bg-[var(--ey-surface)] overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--ey-border)] flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[var(--ey-brand-dim)]"><Key className="h-4 w-4 text-[var(--ey-brand)]" /></div>
                <div><h2 className="text-base font-semibold text-[var(--ey-foreground)]">Clé API</h2><p className="text-xs text-[var(--ey-muted-foreground)]">Utilisez cette clé pour accéder à l&apos;API Eyano.</p></div>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 bg-[var(--ey-background)] border border-[var(--ey-border)] rounded-xl px-4 py-3 group focus-within:border-[var(--ey-brand)]/40 transition-colors">
                  <code className="flex-1 text-sm font-mono text-[var(--ey-foreground)] truncate">
                    {showKey ? apiKey : '••••••••••••••••••••••••••••••••'}
                  </code>
                  <button onClick={() => setShowKey(!showKey)} className="p-2 text-[var(--ey-muted-foreground)] hover:text-[var(--ey-foreground)] transition-colors touch-manipulation">
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button onClick={() => { navigator.clipboard.writeText(apiKey); addToast('Clé copiée', 'success'); }} 
                    className="px-3 py-1.5 rounded-lg bg-[var(--ey-surface-2)] text-xs font-bold text-[var(--ey-foreground)] hover:bg-[var(--ey-brand-dim)] hover:text-[var(--ey-brand)] transition-all touch-manipulation">
                    Copier
                  </button>
                </div>
                <p className="text-[10px] text-[var(--ey-muted-foreground)] mt-2 ml-1">Ne partagez jamais votre clé API publiquement.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div className="rounded-2xl border border-[var(--ey-border)] bg-[var(--ey-surface)] p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-[var(--ey-surface-2)]"><Palette className="h-4 w-4 text-[var(--ey-muted-foreground)]" /></div>
                  <h3 className="text-sm font-semibold text-[var(--ey-foreground)]">Apparence</h3>
                </div>
                <div className="flex bg-[var(--ey-background)] rounded-xl p-1 border border-[var(--ey-border)]">
                  {(['system', 'dark', 'light'] as const).map((t) => (
                    <button key={t} onClick={() => setTheme(t)}
                      className={cn("flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all touch-manipulation",
                        theme === t ? 'bg-[var(--ey-surface-2)] text-[var(--ey-foreground)] shadow-sm' : 'text-[var(--ey-muted-foreground)] hover:text-[var(--ey-foreground)]')}>
                      {t === 'system' ? 'Auto' : t === 'dark' ? 'Sombre' : 'Clair'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--ey-border)] bg-[var(--ey-surface)] p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-[var(--ey-surface-2)]"><Globe className="h-4 w-4 text-[var(--ey-muted-foreground)]" /></div>
                  <h3 className="text-sm font-semibold text-[var(--ey-foreground)]">Langue</h3>
                </div>
                <select value={prefs.language} onChange={(e) => setPrefs({...prefs, language: e.target.value})}
                  className="w-full h-10 rounded-xl bg-[var(--ey-background)] border border-[var(--ey-border)] px-3 text-sm text-[var(--ey-foreground)] focus:outline-none appearance-none cursor-pointer touch-manipulation">
                  <option value="fr">Français 🇫</option>
                  <option value="en">English 🇬🇧</option>
                  <option value="ln">Lingala 🇨🇩</option>
                </select>
              </div>

              <div className="rounded-2xl border border-[var(--ey-border)] bg-[var(--ey-surface)] p-5 flex flex-col justify-between">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-[var(--ey-surface-2)]"><Bell className="h-4 w-4 text-[var(--ey-muted-foreground)]" /></div>
                  <h3 className="text-sm font-semibold text-[var(--ey-foreground)]">Notifications</h3>
                </div>
                <label className="flex items-center justify-between cursor-pointer group touch-manipulation">
                  <span className="text-xs text-[var(--ey-muted-foreground)]">Alertes par email</span>
                  <div className={cn("w-11 h-6 rounded-full transition-colors relative", prefs.notifications ? 'bg-[var(--ey-brand)]' : 'bg-[var(--ey-surface-2)]')}>
                    <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-transform", prefs.notifications ? 'left-6' : 'left-1')} />
                  </div>
                  <input type="checkbox" checked={prefs.notifications} onChange={() => setPrefs({...prefs, notifications: !prefs.notifications})} className="hidden" />
                </label>
              </div>

              <div className="rounded-2xl border border-[var(--ey-border)] bg-[var(--ey-surface)] p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-[var(--ey-surface-2)]"><Database className="h-4 w-4 text-[var(--ey-muted-foreground)]" /></div>
                  <h3 className="text-sm font-semibold text-[var(--ey-foreground)]">Historique</h3>
                </div>
                <div className="space-y-2">
                  {['7d', '30d', 'forever'].map((val) => (
                    <button key={val} onClick={() => setPrefs({...prefs, dataRetention: val})}
                      className={cn("w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all touch-manipulation",
                        prefs.dataRetention === val ? 'bg-[var(--ey-brand-dim)] text-[var(--ey-brand)] border border-[var(--ey-brand)]/20' : 'text-[var(--ey-muted-foreground)] hover:bg-[var(--ey-surface-2)]')}>
                      <span>{val === '7d' ? '7 jours' : val === '30d' ? '30 jours' : 'Illimité'}</span>
                      {prefs.dataRetention === val && <ChevronRight className="h-3 w-3" />}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            <div className="rounded-2xl border border-red-500/10 bg-red-500/[2%] overflow-hidden p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-red-400">Session active</h3>
                <p className="text-xs text-[var(--ey-muted-foreground)] mt-1">Déconnectez-vous de tous les appareils.</p>
              </div>
              <button onClick={handleLogout} 
                className="w-full sm:w-auto h-10 px-5 rounded-xl border border-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/10 transition-all active:scale-95 touch-manipulation flex items-center justify-center gap-2">
                <LogOut className="h-3.5 w-3.5" /> Se déconnecter
              </button>
            </div>

          </div>
        </div>
        
        <p className="text-center text-[10px] text-[var(--ey-muted-foreground)]/40 select-none pt-4">Eyano v1.0 — Propulsé par Gnoxe AI</p>
      </main>
    </div>
  );
}
