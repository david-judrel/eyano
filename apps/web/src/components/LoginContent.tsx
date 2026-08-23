'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, ArrowLeft, ArrowRight, Loader2, Eye, EyeOff, Check, X } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';
import { ToastContainer } from '@/components/Toast';

type Step = 'choose' | 'email-login' | 'email-register';

const passwordRules = [
  { label: 'Au moins 8 caractères', test: (p: string) => p.length >= 8 },
  { label: 'Une lettre majuscule', test: (p: string) => /[A-Z]/.test(p) },
];

export function LoginContent() {
  const router = useRouter();
  const { setUser } = useAppStore();

  const [step, setStep] = useState<Step>('choose');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

  const handleGoogleOAuth = () => {
    window.location.href = `${API_URL}/auth/google`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login({ email: loginEmail, password: loginPassword });
      api.setToken(res.token);
      setUser(res.user);
      const pendingMessage = sessionStorage.getItem('eyano_pending_message');
      sessionStorage.removeItem('eyano_pending_message');
      if (pendingMessage) {
        useAppStore.setState({ pendingGuestMessage: pendingMessage });
      }
      router.push('/');
    } catch (err: any) {
      setError(err?.message || 'Identifiants incorrects.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const allValid = passwordRules.every((r) => r.test(registerPassword));
    if (!allValid) {
      setError('Le mot de passe ne respecte pas les critères.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.register({ email: registerEmail, password: registerPassword, name: registerName });
      api.setToken(res.token);
      setUser(res.user);
      const pendingMessage = sessionStorage.getItem('eyano_pending_message');
      sessionStorage.removeItem('eyano_pending_message');
      if (pendingMessage) {
        useAppStore.setState({ pendingGuestMessage: pendingMessage });
      }
      router.push('/');
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la création.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full bg-background overflow-y-auto overflow-x-hidden">
      <ToastContainer />

      {/* PARTIE GAUCHE - BRANDING DESKTOP */}
      <div className="relative hidden lg:flex lg:w-1/2 items-center justify-center overflow-hidden bg-surface">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(57,255,20,0.08)_0%,transparent_60%)]" />
        <div className="relative z-10 text-center px-10 animate-fade-in">
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-3xl border border-brand/20 bg-brand/[8%] glow-brand overflow-hidden">
            <Logo size="xl" />
          </div>
          <h1 className="text-6xl font-bold tracking-tighter text-foreground mb-4">Eyano</h1>
          <p className="text-lg text-muted font-light max-w-md mx-auto">
            Votre assistant IA intelligent conçu pour l&apos;excellence.
          </p>
        </div>
      </div>

      {/* PARTIE DROITE - FORMULAIRES */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-8 lg:w-1/2 relative">

        {/* Conteneur Principal Centré */}
        <div className="w-full max-w-[400px] relative z-10 animate-fade-in-up">

          {/* LOGO MOBILE */}
          <div className="flex flex-col items-center mb-10">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand/20 bg-brand/[8%] glow-brand overflow-hidden">
              <Logo size="lg" />
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-foreground text-center">
              {step === 'choose' ? 'Bienvenue' : step === 'email-login' ? 'Connexion' : 'Inscription'}
            </h1>
            <p className="text-muted text-sm mt-2 text-center">
              {step === 'choose'
                ? 'Comment souhaitez-vous continuer ?'
                : step === 'email-login'
                  ? 'Accédez à votre espace Eyano.'
                  : 'Rejoignez l\'élite de l\'IA.'}
            </p>
          </div>

          {/* BOUTON RETOUR */}
          {(step === 'email-login' || step === 'email-register') && (
            <button
              onClick={() => setStep('choose')}
              className="absolute -top-16 left-0 flex items-center gap-2 text-muted hover:text-brand transition-colors group p-2 -ml-2"
            >
              <div className="p-2 rounded-full bg-surface border border-border group-hover:border-brand/20 transition-all">
                <ArrowLeft className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium hidden sm:inline">Retour</span>
            </button>
          )}

          {/* ETAPE 1 : CHOIX */}
          {step === 'choose' && (
            <div className="space-y-4 mt-8">
              <button
                onClick={() => setStep('email-login')}
                className="group flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-border bg-surface text-foreground font-semibold transition-all hover:border-brand/30 active:scale-[0.98]"
              >
                <Mail className="h-5 w-5 text-muted group-hover:text-brand transition-colors" />
                Continuer avec email
              </button>

              <button
                type="button"
                onClick={handleGoogleOAuth}
                className="group flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-border bg-surface text-foreground font-semibold transition-all hover:bg-surface-2 active:scale-[0.98]"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continuer avec Google
              </button>

              <div className="pt-6 text-center">
                <p className="text-sm text-muted">
                  Pas encore de compte ?{' '}
                  <button onClick={() => setStep('email-register')} className="font-semibold text-brand ml-1">
                    Créer un compte
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* FORMULAIRES */}
          {(step === 'email-login' || step === 'email-register') && (
            <form onSubmit={step === 'email-login' ? handleLogin : handleRegister} className="space-y-4 mt-8">

              {step === 'email-register' && (
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground/20 group-focus-within:text-brand transition-colors" />
                  <input
                    type="text" placeholder="Nom complet" required
                    value={registerName} onChange={(e) => setRegisterName(e.target.value)}
                    className="h-14 w-full rounded-2xl border border-border bg-surface pl-12 pr-4 text-base text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-brand/40 transition-all"
                  />
                </div>
              )}

              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground/20 group-focus-within:text-brand transition-colors" />
                <input
                  type="email" placeholder="Adresse email" required
                  value={step === 'email-login' ? loginEmail : registerEmail}
                  onChange={(e) => step === 'email-login' ? setLoginEmail(e.target.value) : setRegisterEmail(e.target.value)}
                  className="h-14 w-full rounded-2xl border border-border bg-surface pl-12 pr-4 text-base text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-brand/40 transition-all"
                />
              </div>

              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground/20 group-focus-within:text-brand transition-colors" />
                <input
                  type={step === 'email-login' ? (showLoginPassword ? 'text' : 'password') : (showRegisterPassword ? 'text' : 'password')}
                  placeholder="Mot de passe" required
                  value={step === 'email-login' ? loginPassword : registerPassword}
                  onChange={(e) => step === 'email-login' ? setLoginPassword(e.target.value) : setRegisterPassword(e.target.value)}
                  className="h-14 w-full rounded-2xl border border-border bg-surface pl-12 pr-12 text-base text-foreground placeholder:text-foreground/20 focus:outline-none focus:border-brand/40 transition-all"
                />
                <button
                  type="button"
                  onClick={() => step === 'email-login' ? setShowLoginPassword(!showLoginPassword) : setShowRegisterPassword(!showRegisterPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/20 hover:text-foreground/50 transition-colors"
                >
                  {(step === 'email-login' ? showLoginPassword : showRegisterPassword) ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>

              {step === 'email-register' && registerPassword.length > 0 && (
                <div className="space-y-1.5 px-1">
                  {passwordRules.map((rule) => {
                    const valid = rule.test(registerPassword);
                    return (
                      <div key={rule.label} className="flex items-center gap-2 text-[12px]">
                        {valid ? (
                          <Check className="h-3.5 w-3.5 text-brand shrink-0" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-foreground/20 shrink-0" />
                        )}
                        <span className={cn('transition-colors', valid ? 'text-brand/80' : 'text-foreground/25')}>
                          {rule.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                  {error}
                </div>
              )}

              <button
                type="submit" disabled={loading}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-brand-foreground font-bold text-base transition-all hover:brightness-110 disabled:opacity-50 active:scale-[0.98] glow-neon mt-6"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                  <>
                    {step === 'email-login' ? 'Se connecter' : 'Créer mon compte'}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <div className="pt-6 text-center">
                <p className="text-sm text-muted">
                  {step === 'email-login' ? "Pas encore de compte ? " : "Déjà un compte ? "}
                  <button
                    type="button"
                    onClick={() => setStep(step === 'email-login' ? 'email-register' : 'email-login')}
                    className="font-semibold text-brand hover:text-brand/80 transition-colors ml-1"
                  >
                    {step === 'email-login' ? 'Créer un compte' : 'Se connecter'}
                  </button>
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
