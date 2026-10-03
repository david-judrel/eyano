'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Bell, Calendar, Copy, Database, Eye, EyeOff, Globe, Key, LogOut, Mail, Palette, Pencil,
  ShieldCheck, X,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { EYANO_MODELS } from '@eyano/types';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { useTheme } from '@/lib/theme-provider';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/logo';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, IconButton } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, Separator, Spinner } from '@/components/ui/feedback';
import { Container, PageHeader } from '@/components/layout/Page';

export function ProfileContent() {
  const router = useRouter();
  const { user, setUser, setConversations } = useAppStore();
  const { addToast } = useToast();
  const { theme, setTheme } = useTheme();

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
    modelDefault: (EYANO_MODELS.find((entry) => entry.default) ?? EYANO_MODELS[0]).id
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
      <div className="flex h-full w-full items-center justify-center bg-background">
        <Spinner size="md" label="Chargement du profil" />
      </div>
    );
  }

  if (!user) return null;

  const identity = [
    { icon: Mail, label: 'Adresse e-mail', value: user.email, mono: true },
    {
      icon: Calendar,
      label: 'Membre depuis',
      value: new Date(user.createdAt || Date.now()).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      mono: false,
    },
    { icon: Database, label: 'ID utilisateur', value: `${user.id?.slice(0, 8)}…`, mono: true },
  ];

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto overflow-x-hidden bg-background">
      <header className="sticky top-0 z-sticky shrink-0 border-b border-border-subtle bg-background">
        <Container size="wide" className="flex h-topbar items-center justify-between">
          <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => router.back()}>
            Retour au chat
          </Button>
          <div className="flex items-center gap-2">
            <Logo size="sm" />
            <span className="text-label text-foreground-secondary">Paramètres &amp; Compte</span>
          </div>
        </Container>
      </header>

      <main className="flex-1">
        <Container size="wide" className="py-6 lg:py-10">
          <PageHeader
            title="Mon profil"
            description="Identité, préférences et sécurité de votre compte."
            className="mb-6"
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
            <div className="flex flex-col gap-6 lg:col-span-4">
              <Card className="flex flex-col items-center gap-4">
                <Avatar
                  src={user.avatarUrl}
                  alt={user.name || user.email}
                  fallback={(user.name?.[0] || user.email[0] || '?').toUpperCase()}
                  size="lg"
                  className="h-20 w-20 text-display"
                />

                {!editingName ? (
                  <div className="flex w-full flex-col items-center gap-1 text-center animate-fade-in">
                    <h2 className="truncate text-heading-md text-foreground">{user.name || 'Utilisateur'}</h2>
                    <p className="break-all text-body-sm text-foreground-muted">{user.email}</p>
                    {user.role && (
                      <Badge tone="brand" className="mt-2">
                        <ShieldCheck className="icon-xs" aria-hidden />
                        {user.role}
                      </Badge>
                    )}
                    <Button variant="outline" size="sm" icon={Pencil} className="mt-4 w-full" onClick={() => setEditingName(true)}>
                      Modifier le profil
                    </Button>
                  </div>
                ) : (
                  <div className="flex w-full flex-col gap-3 animate-fade-in">
                    <Field label="Nom" required>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoFocus
                        maxLength={60}
                        placeholder="Votre nom"
                      />
                    </Field>
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        loading={saving}
                        disabled={name.length < 3}
                        onClick={handleSaveName}
                      >
                        Sauvegarder
                      </Button>
                      <IconButton label="Annuler la modification" icon={X} variant="outline" size="sm" onClick={() => setEditingName(false)} />
                    </div>
                  </div>
                )}
              </Card>

              <Card padding="none">
                {identity.map((item, index) => (
                  <div key={item.label}>
                    {index > 0 && <Separator />}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <item.icon className="icon-sm shrink-0 text-foreground-muted" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="text-caption text-foreground-muted">{item.label}</p>
                        <p className={cn('truncate text-body-sm text-foreground', item.mono && 'font-mono')}>{item.value}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </Card>
            </div>

            <div className="flex flex-col gap-6 lg:col-span-8">
              <Card>
                <div className="flex items-center gap-2">
                  <Key className="icon-sm text-foreground-muted" aria-hidden />
                  <h3 className="text-heading-sm text-foreground">Clé API</h3>
                </div>
                <p className="mt-1 text-body-sm text-foreground-muted">Utilisez cette clé pour accéder à l&apos;API Eyano.</p>

                <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                  <code className="min-w-0 flex-1 truncate font-mono text-code text-foreground">
                    {showKey ? apiKey : '••••••••••••••••••••••••••••••••'}
                  </code>
                  <IconButton
                    label={showKey ? 'Masquer la clé' : 'Afficher la clé'}
                    icon={showKey ? EyeOff : Eye}
                    size="sm"
                    tooltip={false}
                    onClick={() => setShowKey(!showKey)}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={Copy}
                    onClick={() => {
                      navigator.clipboard.writeText(apiKey);
                      addToast('Clé copiée', 'success');
                    }}
                  >
                    Copier
                  </Button>
                </div>
                <p className="mt-2 text-caption text-foreground-muted">Ne partagez jamais votre clé API publiquement.</p>
              </Card>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Card>
                  <div className="flex items-center gap-2">
                    <Palette className="icon-sm text-foreground-muted" aria-hidden />
                    <h3 className="text-heading-sm text-foreground">Apparence</h3>
                  </div>
                  <Field label="Thème" className="mt-4">
                    <Select
                      value={theme}
                      onValueChange={(value) => setTheme(value as 'light' | 'dark' | 'system')}
                      options={[
                        { value: 'system', label: 'Système' },
                        { value: 'dark', label: 'Sombre' },
                        { value: 'light', label: 'Clair' },
                      ]}
                    />
                  </Field>
                </Card>

                <Card>
                  <div className="flex items-center gap-2">
                    <Globe className="icon-sm text-foreground-muted" aria-hidden />
                    <h3 className="text-heading-sm text-foreground">Langue</h3>
                  </div>
                  <Field label="Langue de l'interface" className="mt-4">
                    <Select
                      value={prefs.language}
                      onValueChange={(value) => setPrefs({ ...prefs, language: value })}
                      options={[
                        { value: 'fr', label: 'Français' },
                        { value: 'en', label: 'English' },
                        { value: 'ln', label: 'Lingala' },
                      ]}
                    />
                  </Field>
                </Card>

                <Card>
                  <div className="flex items-center gap-2">
                    <Bell className="icon-sm text-foreground-muted" aria-hidden />
                    <h3 className="text-heading-sm text-foreground">Notifications</h3>
                  </div>
                  <Switch
                    className="mt-4"
                    label="Alertes par e-mail"
                    checked={prefs.notifications}
                    onCheckedChange={(checked) => setPrefs({ ...prefs, notifications: checked })}
                  />
                </Card>

                <Card>
                  <div className="flex items-center gap-2">
                    <Database className="icon-sm text-foreground-muted" aria-hidden />
                    <h3 className="text-heading-sm text-foreground">Historique</h3>
                  </div>
                  <Field label="Conservation des conversations" className="mt-4">
                    <Select
                      value={prefs.dataRetention}
                      onValueChange={(value) => setPrefs({ ...prefs, dataRetention: value })}
                      options={[
                        { value: '7d', label: '7 jours' },
                        { value: '30d', label: '30 jours' },
                        { value: 'forever', label: 'Illimité' },
                      ]}
                    />
                  </Field>
                </Card>
              </div>

              <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-heading-sm text-error">Session active</h3>
                  <p className="mt-1 text-body-sm text-foreground-muted">Déconnectez-vous de tous les appareils.</p>
                </div>
                <Button variant="destructive" icon={LogOut} className="w-full sm:w-auto" onClick={handleLogout}>
                  Se déconnecter
                </Button>
              </Card>
            </div>
          </div>

          <p className="mt-8 text-center text-caption text-foreground-muted select-none">
            Eyano v1.0 — Propulsé par Gnoxe AI
          </p>
        </Container>
      </main>
    </div>
  );
}
