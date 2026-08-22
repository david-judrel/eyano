'use client';

import { MobileInstallGate } from '@/components/MobileInstallGate';

export function PWAProvider({ children }: { children: React.ReactNode }) {
  return <MobileInstallGate>{children}</MobileInstallGate>;
}
