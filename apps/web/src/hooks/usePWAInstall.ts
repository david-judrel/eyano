'use client';

import { useState, useEffect, useCallback } from 'react';
import { isPWAInstalled, isMobile, isIOS, isAndroid } from '@/lib/pwa';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWAInstall() {
  const [isInstalled, setIsInstalled] = useState<boolean>(true);
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(false);
  const [isIOSDevice, setIsIOSDevice] = useState<boolean>(false);
  const [isAndroidDevice, setIsAndroidDevice] = useState<boolean>(false);
  const [canInstall, setCanInstall] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);

  const checkInstalled = useCallback(() => {
    const installed = isPWAInstalled();
    const mobile = isMobile();
    const ios = isIOS();
    const android = isAndroid();
    const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';

    setIsInstalled(installed);
    setIsMobileDevice(mobile);
    setIsIOSDevice(ios);
    setIsAndroidDevice(android);

    // Log for debugging
    console.log('[PWA]', { installed, mobile, ios, android, isSecure, displayMode: window.matchMedia('(display-mode: standalone)').matches });
  }, []);

  useEffect(() => {
    checkInstalled();
    window.addEventListener('focus', checkInstalled);
    document.addEventListener('visibilitychange', checkInstalled);
    window.addEventListener('resize', checkInstalled);

    return () => {
      window.removeEventListener('focus', checkInstalled);
      document.removeEventListener('visibilitychange', checkInstalled);
      window.removeEventListener('resize', checkInstalled);
    };
  }, [checkInstalled]);

  // Capture beforeinstallprompt (Android HTTPS only)
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      console.log('[PWA] beforeinstallprompt fired');
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Log if event doesn't fire after 5s
    const timeout = setTimeout(() => {
      if (!canInstall) {
        console.log('[PWA] beforeinstallprompt did not fire - requires HTTPS on Android');
      }
    }, 5000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      console.log('[PWA] appinstalled');
      setIsInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
      setTimeout(checkInstalled, 500);
    };

    window.addEventListener('appinstalled', handler);
    return () => window.removeEventListener('appinstalled', handler);
  }, [checkInstalled]);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;

    setIsInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('[PWA] install outcome:', outcome);

      if (outcome === 'accepted') {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 3000);
          const installedHandler = () => {
            clearTimeout(timeout);
            window.removeEventListener('appinstalled', installedHandler);
            resolve();
          };
          window.addEventListener('appinstalled', installedHandler);
        });
        checkInstalled();
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setIsInstalling(false);
      setDeferredPrompt(null);
    }
  }, [deferredPrompt, checkInstalled]);

  const shouldBlock = isMobileDevice && !isInstalled;

  return {
    isInstalled,
    isMobileDevice,
    isIOSDevice,
    isAndroidDevice,
    canInstall,
    isInstalling,
    shouldBlock,
    install,
  };
}
