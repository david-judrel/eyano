'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Mail, X } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Logo } from '@/components/ui/logo';
import { Button, IconButton } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/feedback';
import { GoogleIcon } from '@/components/ui/brand-icons';
import { LegalConsent } from '@/components/legal/LegalConsent';

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

  const isLogin = step === 'email-login';
  const showPassword = isLogin ? showLoginPassword : showRegisterPassword;

  return (
    <div className="flex h-full w-full overflow-y-auto overflow-x-hidden bg-background">
      <div className="hidden items-center justify-center border-r border-border-subtle bg-background-subtle lg:flex lg:w-1/2">
        <div className="flex max-w-md flex-col items-center px-10 text-center animate-fade-in">
          <Logo size="xl" />
          <h1 className="mt-6 text-display text-foreground">Eyano</h1>
          <p className="mt-3 text-body-lg text-foreground-secondary">Votre assistant IA intelligent conçu pour l&apos;excellence.</p>
        </div>
      </div>

      <div className="flex w-full flex-col items-center justify-center px-4 py-12 sm:px-6 lg:w-1/2">
        <div className="flex w-full max-w-sm flex-col animate-fade-in">
          {step !== 'choose' && (
            <Button variant="ghost" size="sm" icon={ArrowLeft} className="mb-6 self-start" onClick={() => setStep('choose')}>
              Retour
            </Button>
          )}

          <div className="flex flex-col items-center text-center">
            <Logo size="lg" className="lg:hidden" />
            <h1 className="mt-4 text-heading-xl text-foreground lg:mt-0">
              {step === 'choose' ? 'Bienvenue' : isLogin ? 'Connexion' : 'Inscription'}
            </h1>
            <p className="mt-2 text-body-md text-foreground-muted">
              {step === 'choose'
                ? 'Comment souhaitez-vous continuer ?'
                : isLogin
                  ? 'Accédez à votre espace Eyano.'
                  : "Rejoignez l'élite de l'IA."}
            </p>
          </div>

          {step === 'choose' && (
            <div className="mt-8 flex flex-col gap-3">
              <Button size="lg" icon={Mail} className="w-full" onClick={() => setStep('email-login')}>
                Continuer avec e-mail
              </Button>
              <Button size="lg" className="w-full" onClick={handleGoogleOAuth}>
                <GoogleIcon className="icon-sm" />
                Continuer avec Google
              </Button>
              <LegalConsent action="continue" className="mt-1" />
              <p className="mt-4 text-center text-body-sm text-foreground-muted">
                Pas encore de compte ?{' '}
                <button type="button" onClick={() => setStep('email-register')} className="font-medium text-foreground underline underline-offset-4">
                  Créer un compte
                </button>
              </p>
            </div>
          )}

          {step !== 'choose' && (
            <form onSubmit={isLogin ? handleLogin : handleRegister} className="mt-8 flex flex-col gap-4">
              {!isLogin && (
                <Field label="Nom complet" required>
                  <Input size="lg" autoComplete="name" value={registerName} onChange={(e) => setRegisterName(e.target.value)} />
                </Field>
              )}

              <Field label="Adresse e-mail" required>
                <Input
                  size="lg"
                  type="email"
                  autoComplete="email"
                  value={isLogin ? loginEmail : registerEmail}
                  onChange={(e) => (isLogin ? setLoginEmail(e.target.value) : setRegisterEmail(e.target.value))}
                />
              </Field>

              <Field label="Mot de passe" required>
                <div className="relative">
                  <Input
                    size="lg"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    value={isLogin ? loginPassword : registerPassword}
                    onChange={(e) => (isLogin ? setLoginPassword(e.target.value) : setRegisterPassword(e.target.value))}
                    className="pr-12"
                  />
                  <IconButton
                    label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    icon={showPassword ? EyeOff : Eye}
                    size="sm"
                    tooltip={false}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => (isLogin ? setShowLoginPassword(!showLoginPassword) : setShowRegisterPassword(!showRegisterPassword))}
                  />
                </div>
              </Field>

              {!isLogin && registerPassword.length > 0 && (
                <ul aria-label="Critères du mot de passe" className="flex flex-col gap-1">
                  {passwordRules.map((rule) => {
                    const valid = rule.test(registerPassword);
                    return (
                      <li key={rule.label} className="flex items-center gap-2 text-caption">
                        {valid ? <Check className="icon-xs text-success" aria-hidden /> : <X className="icon-xs text-foreground-muted" aria-hidden />}
                        <span className={valid ? 'text-foreground-secondary' : 'text-foreground-muted'}>
                          {rule.label}
                          <span className="sr-only">{valid ? ' : respecté' : ' : non respecté'}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              {error && <Alert tone="error">{error}</Alert>}

              {!isLogin && <LegalConsent action="create" />}

              <Button type="submit" variant="primary" size="lg" loading={loading} className="mt-2 w-full">
                {isLogin ? 'Se connecter' : 'Créer mon compte'}
                {!loading && <ArrowRight className="icon-sm" aria-hidden />}
              </Button>

              <p className="mt-4 text-center text-body-sm text-foreground-muted">
                {isLogin ? 'Pas encore de compte ? ' : 'Déjà un compte ? '}
                <button
                  type="button"
                  onClick={() => setStep(isLogin ? 'email-register' : 'email-login')}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  {isLogin ? 'Créer un compte' : 'Se connecter'}
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
