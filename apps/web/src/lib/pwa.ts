export function isPWAInstalled(): boolean {
  if (typeof window === 'undefined') return false;

  // Android / Chrome: display-mode standalone
  if (window.matchMedia('(display-mode: standalone)').matches) return true;

  // iOS Safari: navigator.standalone
  if ((window.navigator as any).standalone === true) return true;

  return false;
}

export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}
