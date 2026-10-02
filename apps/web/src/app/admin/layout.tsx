'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft, Cpu, FileText, LayoutDashboard, LogOut, Menu, Users, X } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/logo';
import { Badge } from '@/components/ui/badge';
import { Button, IconButton } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/overlay';
import { RoleBadge } from '@/components/admin/AdminKit';

const navItems = [
  { label: "Vue d'ensemble", href: '/admin/overview', icon: LayoutDashboard },
  { label: 'Utilisateurs', href: '/admin/users', icon: Users },
  { label: 'IA et clés', href: '/admin/ai', icon: Cpu },
  { label: 'Audit', href: '/admin/audit', icon: FileText },
];

function AdminNav({ pathname, onNavigate, onLogout, onClose }: {
  pathname: string;
  onNavigate: (href: string) => void;
  onLogout: () => void;
  onClose?: () => void;
}) {
  return (
    <>
      <div className="flex h-topbar shrink-0 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Logo size="md" />
          <span className="text-heading-sm text-foreground">Eyano</span>
          <Badge tone="brand">Admin</Badge>
        </div>
        {onClose && <IconButton label="Fermer le menu" icon={X} size="sm" tooltip={false} onClick={onClose} />}
      </div>

      <nav aria-label="Administration" className="flex flex-1 flex-col gap-0.5 px-3">
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = pathname === href;
          return (
            <button
              key={href}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onNavigate(href)}
              className={cn(
                'flex h-9 items-center gap-2 rounded-md px-2 text-body-sm transition-colors duration-fast',
                active ? 'bg-selected font-medium text-foreground' : 'text-foreground-secondary hover:bg-hover hover:text-foreground'
              )}
            >
              <Icon className={cn('icon-sm', active ? 'text-foreground' : 'text-foreground-muted')} aria-hidden />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col gap-0.5 border-t border-border-subtle p-3">
        <Button variant="ghost" icon={ArrowLeft} className="justify-start" onClick={() => onNavigate('/')}>Retour au chat</Button>
        <Button variant="ghost" icon={LogOut} className="justify-start" onClick={onLogout}>Déconnexion</Button>
      </div>
    </>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser, setConversations } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    api.get<any>('/users/me').then((data) => {
      if (data.role !== 'ADMIN' && data.role !== 'SUPER_ADMIN') {
        router.push('/');
        return;
      }
      setUser(data);
      setLoading(false);
    }).catch(() => {
      api.setToken(null);
      router.push('/login');
    });
  }, []);

  const handleLogout = () => {
    api.setToken(null);
    setUser(null);
    setConversations([]);
    router.push('/login');
  };

  const navigate = (href: string) => {
    router.push(href);
    setSidebarOpen(false);
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background" role="status" aria-label="Chargement">
        <Logo size="lg" className="animate-pulse-subtle" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-background">
      <aside className="hidden w-sidebar shrink-0 flex-col border-r border-border-subtle bg-background-subtle lg:flex">
        <AdminNav pathname={pathname} onNavigate={navigate} onLogout={handleLogout} />
      </aside>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent title="Menu d'administration" className="lg:hidden">
          <AdminNav pathname={pathname} onNavigate={navigate} onLogout={handleLogout} onClose={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-topbar shrink-0 items-center gap-2 border-b border-border-subtle px-3 lg:px-6">
          <IconButton label="Ouvrir le menu" icon={Menu} className="lg:hidden" tooltip={false} onClick={() => setSidebarOpen(true)} />
          <span className="text-label text-foreground-secondary">Administration</span>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <span className="hidden truncate text-caption text-foreground-muted sm:inline">{user?.email}</span>
            {user?.role && <RoleBadge role={user.role} />}
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
