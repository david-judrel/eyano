'use client';

import { useState, useEffect } from 'react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Logo } from './ui/logo';
import { X, Download, Loader2, Share, Plus, Menu } from 'lucide-react';

export function MobileInstallGate({ children }: { children: React.ReactNode }) {
  const {
    isInstalled,
    isMobileDevice,
    isAndroidDevice,
    isIOSDevice,
    canInstall,
    isInstalling,
    install,
  } = usePWAInstall();

  const [showPopup, setShowPopup] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isInstalled || dismissed) return;

    if (isMobileDevice && (isAndroidDevice || isIOSDevice)) {
      const timer = setTimeout(() => setShowPopup(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [isMobileDevice, isAndroidDevice, isIOSDevice, isInstalled, dismissed]);

  const handleDismiss = () => {
    setShowPopup(false);
    setDismissed(true);
  };

  const handleInstall = async () => {
    if (canInstall) {
      const success = await install();
      if (success) {
        setShowPopup(false);
        return;
      }
    }
    handleDismiss();
  };

  return (
    <>
      {children}

      {showPopup && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-[#050505]/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full sm:max-w-[380px] bg-[#0D0F0E] border border-[#F2FFF0]/[8%] rounded-t-2xl sm:rounded-2xl shadow-2xl animate-slide-up overflow-hidden">
            
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F2FFF0]/[6%]">
              <div className="flex items-center gap-3">
                <Logo size="sm" />
                <span className="text-[14px] font-bold text-[#F2FFF0]">Installer Eyano</span>
              </div>
              <button
                onClick={handleDismiss}
                className="p-1.5 rounded-lg text-[#F2FFF0]/30 hover:text-[#F2FFF0] hover:bg-[#F2FFF0]/[8%] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-5">
              {/* Android avec prompt natif */}
              {isAndroidDevice && canInstall && (
                <>
                  <p className="text-[13px] text-[#F2FFF0]/40 mb-5 leading-relaxed">
                    Installez Eyano sur votre appareil pour une experience optimale.
                  </p>
                  <button
                    onClick={handleInstall}
                    disabled={isInstalling}
                    className="flex items-center justify-center gap-2.5 w-full h-12 rounded-xl bg-[#39FF14] text-[#050505] font-bold text-[13px] transition-all hover:brightness-110 active:scale-[0.98] shadow-[0_0_15px_rgba(57,255,20,0.2)] disabled:opacity-50"
                  >
                    {isInstalling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Installer Eyano
                      </>
                    )}
                  </button>
                </>
              )}

              {/* Android sans prompt (instructions) */}
              {isAndroidDevice && !canInstall && (
                <>
                  <p className="text-[13px] text-[#F2FFF0]/40 mb-5 leading-relaxed">
                    Ajoutez Eyano à votre écran d&apos;accueil.
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-xl border border-[#F2FFF0]/[6%] bg-[#050505]">
                      <div className="shrink-0 w-7 h-7 rounded-lg bg-[#39FF14]/[10%] border border-[#39FF14]/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-[#39FF14]">1</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Menu className="h-4 w-4 text-[#F2FFF0]/40" />
                        <p className="text-[12px] text-[#F2FFF0]/60">Appuyez sur ⋮ en haut à droite</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-xl border border-[#F2FFF0]/[6%] bg-[#050505]">
                      <div className="shrink-0 w-7 h-7 rounded-lg bg-[#39FF14]/[10%] border border-[#39FF14]/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-[#39FF14]">2</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Download className="h-4 w-4 text-[#F2FFF0]/40" />
                        <p className="text-[12px] text-[#F2FFF0]/60">Sélectionnez « Installer l&apos;application »</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* iOS */}
              {isIOSDevice && (
                <>
                  <p className="text-[13px] text-[#F2FFF0]/40 mb-5 leading-relaxed">
                    Ajoutez Eyano à votre écran d&apos;accueil.
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-xl border border-[#F2FFF0]/[6%] bg-[#050505]">
                      <div className="shrink-0 w-7 h-7 rounded-lg bg-[#39FF14]/[10%] border border-[#39FF14]/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-[#39FF14]">1</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Share className="h-4 w-4 text-[#F2FFF0]/40" />
                        <p className="text-[12px] text-[#F2FFF0]/60">Appuyez sur Partager en bas</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-xl border border-[#F2FFF0]/[6%] bg-[#050505]">
                      <div className="shrink-0 w-7 h-7 rounded-lg bg-[#39FF14]/[10%] border border-[#39FF14]/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-[#39FF14]">2</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4 text-[#F2FFF0]/40" />
                        <p className="text-[12px] text-[#F2FFF0]/60">« Ajouter à l&apos;écran d&apos;accueil »</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-xl border border-[#F2FFF0]/[6%] bg-[#050505]">
                      <div className="shrink-0 w-7 h-7 rounded-lg bg-[#39FF14]/[10%] border border-[#39FF14]/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-[#39FF14]">3</span>
                      </div>
                      <p className="text-[12px] text-[#F2FFF0]/60">Confirmez en haut à droite</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="px-5 py-3 border-t border-[#F2FFF0]/[4%]">
              <button
                onClick={handleDismiss}
                className="w-full text-center text-[12px] text-[#F2FFF0]/25 hover:text-[#F2FFF0]/50 transition-colors py-1"
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
