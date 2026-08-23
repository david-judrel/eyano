'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Cpu, FileText, ArrowLeft, Shield, LogOut, Menu, X } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Vue d\'ensemble', href: '/admin/overview', icon: LayoutDashboard },
  { label: 'Utilisateurs', href: '/admin/users', icon: Users },
  { label: 'IA & Cles', href: '/admin/ai', icon: Cpu },
  { label: 'Audit', href: '/admin/audit', icon: FileText },
];

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

  if (loading) {
    return (
      <div className="flex min-h-screen w-full bg-[#050505] items-center justify-center">
        <Logo size="lg" className="animate-spin opacity-40" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-[#050505]">
      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[#F2FFF0]/[6%] bg-[#0A0C0B] transition-transform duration-300 lg:static lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-[#F2FFF0]/[4%]">
          <div className="flex items-center gap-2">
            <Logo size="sm" />
            <span className="text-sm font-bold text-[#F2FFF0]">Eyano</span>
            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#39FF14]/10 text-[#39FF14] rounded">ADMIN</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-[#F2FFF0]/30 hover:text-[#F2FFF0]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => { router.push(item.href); setSidebarOpen(false); }}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  isActive
                    ? 'bg-[#39FF14]/[10%] text-[#39FF14] border border-[#39FF14]/20'
                    : 'text-[#F2FFF0]/40 hover:text-[#F2FFF0] hover:bg-[#F2FFF0]/[4%]'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-[#F2FFF0]/[4%] space-y-2">
          <button
            onClick={() => router.push('/')}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#F2FFF0]/40 hover:text-[#F2FFF0] hover:bg-[#F2FFF0]/[4%] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au chat
          </button>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Deconnexion
          </button>
        </div>
      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center gap-4 border-b border-[#F2FFF0]/[4%] bg-[#0A0C0B]/80 backdrop-blur-xl px-4">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-[#F2FFF0]/40 hover:text-[#F2FFF0]">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#39FF14]" />
            <span className="text-sm font-medium text-[#F2FFF0]/60">Administration</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-[#F2FFF0]/30">{user?.email}</span>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-[#39FF14]/10 text-[#39FF14] rounded-full">{user?.role}</span>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
