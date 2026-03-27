import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import type { AuthFormState, AuthMode } from '../types';
import { validateAuthForm } from '../viewModels';

const ACCESS_TOKEN_KEY = 'pft_access_token';
const REFRESH_TOKEN_KEY = 'pft_refresh_token';
const USER_ID_KEY = 'pft_user_id';
const USER_NAME_KEY = 'pft_user_name';
const USER_EMAIL_KEY = 'pft_user_email';

function persistSession(response: { accessToken: string; refreshToken: string; user: { id: string; displayName: string; email: string } }) {
  localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
  localStorage.setItem(USER_ID_KEY, response.user.id);
  localStorage.setItem(USER_NAME_KEY, response.user.displayName);
  localStorage.setItem(USER_EMAIL_KEY, response.user.email);
}

function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(USER_NAME_KEY);
  localStorage.removeItem(USER_EMAIL_KEY);
}

export function useAuthSession({
  setLoading,
  setError,
  setToast,
  onSignedIn,
  onSignedOut,
}: {
  setLoading: (value: boolean) => void;
  setError: (value: string) => void;
  setToast: (value: string) => void;
  onSignedIn: () => Promise<void>;
  onSignedOut: () => void;
}) {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authForm, setAuthForm] = useState<AuthFormState>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    termsAccepted: false,
    resetToken: '',
  });
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const userName = localStorage.getItem(USER_NAME_KEY) ?? 'CASHKALESH user';
  const userEmail = localStorage.getItem(USER_EMAIL_KEY) ?? '';

  async function applyAuthSession(response: { accessToken: string; refreshToken: string; user: { id: string; displayName: string; email: string } }, toastMessage: string) {
    persistSession(response);
    setToast(toastMessage);
    await onSignedIn();
  }

  async function handleGoogleCredential(credential: string) {
    setLoading(true);
    setError('');
    try {
      const response = await api.googleLogin(credential);
      await applyAuthSession(response, 'Signed in with Google.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAuth() {
    const validationError = validateAuthForm(authMode, authForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (authMode === 'login' || authMode === 'signup') {
        const displayName = `${authForm.firstName} ${authForm.lastName}`.trim();
        const response = authMode === 'login'
          ? await api.login(authForm.email, authForm.password)
          : await api.register(authForm.email, authForm.password, displayName);
        await applyAuthSession(response, authMode === 'login' ? 'Welcome back to CASHKALESH.' : 'Your CASHKALESH account is ready.');
        return;
      }

      if (authMode === 'forgotPassword') {
        const response = await api.forgotPassword(authForm.email);
        setToast(response.message);
        return;
      }

      const response = await api.resetPassword(authForm.resetToken, authForm.password);
      setToast(response.message);
      setAuthMode('login');
      setAuthForm((current) => ({ ...current, password: '', confirmPassword: '', resetToken: '' }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);
    setError('');
    try {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (refreshToken) {
        await api.logout(refreshToken);
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to log out cleanly.';
      if (!/session has expired/i.test(message)) {
        setError(message);
      }
    } finally {
      clearSession();
      onSignedOut();
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token || !googleClientId) return;
    if (authMode !== 'login' && authMode !== 'signup') return;

    const renderGoogleButton = () => {
      if (!window.google?.accounts.id || !googleButtonRef.current) return;
      googleButtonRef.current.innerHTML = '';
      const measuredWidth = Math.max(260, Math.min(Math.round(googleButtonRef.current.clientWidth || 360), 380));
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: ({ credential }) => {
          void handleGoogleCredential(credential);
        },
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: String(measuredWidth) });
    };

    const existingScript = document.querySelector("script[data-google-signin='true']") as HTMLScriptElement | null;
    if (existingScript) {
      if (window.google?.accounts.id) {
        window.requestAnimationFrame(renderGoogleButton);
      } else {
        existingScript.addEventListener('load', renderGoogleButton, { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleSignin = 'true';
    script.addEventListener('load', renderGoogleButton, { once: true });
    document.head.appendChild(script);
  }, [authMode, googleClientId, token]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const resetToken = searchParams.get('token') ?? searchParams.get('resetToken');
    if (!resetToken) return;

    setAuthMode('resetPassword');
    setAuthForm((current) => ({ ...current, resetToken, password: '', confirmPassword: '' }));

    searchParams.delete('token');
    searchParams.delete('resetToken');
    const nextQuery = searchParams.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', nextUrl);
  }, []);

  return {
    token,
    userName,
    userEmail,
    googleClientId,
    googleButtonRef,
    authMode,
    setAuthMode,
    authForm,
    setAuthForm,
    handleAuth,
    handleLogout,
  };
}
