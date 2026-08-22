'use client';

import { useToast } from '@/lib/toast';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const icons = {
  error: AlertCircle,
  success: CheckCircle,
  info: Info,
  warning: AlertTriangle,
};

const styles = {
  error: 'border-red-500/30 bg-red-500/10 text-red-400',
  success: 'border-[#39FF14]/30 bg-[#39FF14]/10 text-[#39FF14]',
  info: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  warning: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-2xl animate-slide-in-right max-w-sm',
              styles[toast.type]
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium flex-1">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 p-0.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
