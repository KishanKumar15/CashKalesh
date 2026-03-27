import { useEffect, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { AuthFormState, AuthMode } from '../types';
import { getAuthHelperText, getAuthSubmitText } from '../viewModels';
import { AuthShell } from './AuthShell';

function AuthModeLink({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="auth-inline-link-v4" type="button" onClick={onClick}>
      {label}
    </button>
  );
}

export function AuthScreen({
  authMode,
  setAuthMode,
  authForm,
  setAuthForm,
  error,
  loading,
  onSubmit,
  googleClientId,
  googleButtonRef,
}: {
  authMode: AuthMode;
  setAuthMode: Dispatch<SetStateAction<AuthMode>>;
  authForm: AuthFormState;
  setAuthForm: Dispatch<SetStateAction<AuthFormState>>;
  error: string;
  loading: boolean;
  onSubmit: () => void;
  googleClientId: string;
  googleButtonRef: MutableRefObject<HTMLDivElement | null>;
}) {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % 3);
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  const isLogin = authMode === 'login';
  const isSignup = authMode === 'signup';
  const isForgot = authMode === 'forgotPassword';
  const isReset = authMode === 'resetPassword';

  function setField<K extends keyof AuthFormState>(key: K, value: AuthFormState[K]) {
    setAuthForm((current) => ({ ...current, [key]: value }));
  }

  function renderSubtitle() {
    if (isSignup) {
      return (
        <p>
          Already have an account?{' '}
          <AuthModeLink label="Log in" onClick={() => setAuthMode('login')} />
        </p>
      );
    }

    if (isForgot) {
      return (
        <p>
          Remembered your password?{' '}
          <AuthModeLink label="Back to login" onClick={() => setAuthMode('login')} />
        </p>
      );
    }

    if (isReset) {
      return (
        <p>
          Need a fresh reset email?{' '}
          <AuthModeLink label="Start over" onClick={() => setAuthMode('forgotPassword')} />
        </p>
      );
    }

    return (
      <p>
        New to CASHKALESH?{' '}
        <AuthModeLink label="Create account" onClick={() => setAuthMode('signup')} />
      </p>
    );
  }

  function renderFooter() {
    if (isForgot || isReset) {
      return (
        <div className="auth-footer-v4__simple">
          <p className="auth-footer-v4__helper">{getAuthHelperText(authMode)}</p>
          <button className="auth-footer-v4__secondary" type="button" onClick={() => setAuthMode('login')}>
            Back to login
          </button>
        </div>
      );
    }

    return (
      <div className="auth-footer-v4__social">
        <div className="auth-footer-v4__divider"><span>Or continue with</span></div>
        <div className="auth-footer-v4__socialRow">
          {googleClientId ? (
            <div ref={googleButtonRef} className="google-button-host auth-google-host-v4" />
          ) : (
            <p className="auth-footer-v4__helper">Add `VITE_GOOGLE_CLIENT_ID` to enable Google sign-in.</p>
          )}
        </div>
      </div>
    );
  }

  function stageClass(mode: AuthMode) {
    return authMode === mode ? 'auth-stage-panel-v4 is-active' : 'auth-stage-panel-v4';
  }

  return (
    <AuthShell
      title={isSignup ? 'Create an account' : isForgot ? 'Forgot password' : isReset ? 'Reset password' : 'Welcome back'}
      subtitle={renderSubtitle()}
      activeSlide={activeSlide}
      onSlideChange={setActiveSlide}
      footer={renderFooter()}
    >
      <div className="auth-stage-shell-v4">
        <form
          className={stageClass('login')}
          aria-hidden={!isLogin}
          onSubmit={(event) => {
            event.preventDefault();
            if (isLogin) onSubmit();
          }}
        >
          <div className="auth-panel-fields-v4">
            <label className="auth-field-v4">
              <span>Email</span>
              <input
                autoComplete="email"
                placeholder="name@email.com"
                value={authForm.email}
                onChange={(event) => setField('email', event.target.value)}
              />
            </label>

            <label className="auth-field-v4">
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={authForm.password}
                onChange={(event) => setField('password', event.target.value)}
              />
            </label>
          </div>

          <div className="auth-panel-bottom-v4">
            <div className="auth-panel-meta-v4">
              <button className="auth-inline-link-v4 whitespace-nowrap" type="button" onClick={() => setAuthMode('forgotPassword')}>
                Forgot password?
              </button>
            </div>
            {error && isLogin ? <p className="auth-error-v4">{error}</p> : <div className="auth-error-v4 auth-error-v4--placeholder" />}
            <button className="primary-button auth-submit-button-v4" disabled={loading} type="submit">
              {loading ? 'Working...' : getAuthSubmitText('login')}
            </button>
          </div>
        </form>

        <form
          className={stageClass('signup')}
          aria-hidden={!isSignup}
          onSubmit={(event) => {
            event.preventDefault();
            if (isSignup) onSubmit();
          }}
        >
          <div className="auth-panel-fields-v4 auth-panel-fields-v4--signup">
            <div className="auth-field-row-v4">
              <label className="auth-field-v4">
                <span>First name</span>
                <input
                  autoComplete="given-name"
                  placeholder="Fletcher"
                  value={authForm.firstName}
                  onChange={(event) => setField('firstName', event.target.value)}
                />
              </label>

              <label className="auth-field-v4">
                <span>Last name</span>
                <input
                  autoComplete="family-name"
                  placeholder="Last name"
                  value={authForm.lastName}
                  onChange={(event) => setField('lastName', event.target.value)}
                />
              </label>
            </div>

            <label className="auth-field-v4">
              <span>Email</span>
              <input
                autoComplete="email"
                placeholder="Email"
                value={authForm.email}
                onChange={(event) => setField('email', event.target.value)}
              />
            </label>

            <label className="auth-field-v4">
              <span>Password</span>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Enter your password"
                value={authForm.password}
                onChange={(event) => setField('password', event.target.value)}
              />
            </label>

            <label className="auth-checkbox-v4">
              <input
                type="checkbox"
                checked={authForm.termsAccepted}
                onChange={(event) => setField('termsAccepted', event.target.checked)}
              />
              <span>I agree to the Terms & Conditions</span>
            </label>
          </div>

          <div className="auth-panel-bottom-v4">
            {error && isSignup ? <p className="auth-error-v4">{error}</p> : <div className="auth-error-v4 auth-error-v4--placeholder" />}
            <button className="primary-button auth-submit-button-v4" disabled={loading} type="submit">
              {loading ? 'Working...' : getAuthSubmitText('signup')}
            </button>
          </div>
        </form>

        <form
          className={stageClass('forgotPassword')}
          aria-hidden={!isForgot}
          onSubmit={(event) => {
            event.preventDefault();
            if (isForgot) onSubmit();
          }}
        >
          <div className="auth-panel-fields-v4">
            <label className="auth-field-v4">
              <span>Email</span>
              <input
                autoComplete="email"
                placeholder="Enter your email"
                value={authForm.email}
                onChange={(event) => setField('email', event.target.value)}
              />
            </label>
          </div>

          <div className="auth-panel-bottom-v4">
            <p className="auth-panel-meta-v4 auth-panel-meta-v4--single">{getAuthHelperText('forgotPassword')}</p>
            {error && isForgot ? <p className="auth-error-v4">{error}</p> : <div className="auth-error-v4 auth-error-v4--placeholder" />}
            <button className="primary-button auth-submit-button-v4" disabled={loading} type="submit">
              {loading ? 'Working...' : getAuthSubmitText('forgotPassword')}
            </button>
          </div>
        </form>

        <form
          className={stageClass('resetPassword')}
          aria-hidden={!isReset}
          onSubmit={(event) => {
            event.preventDefault();
            if (isReset) onSubmit();
          }}
        >
          <div className="auth-panel-fields-v4">
            <label className="auth-field-v4">
              <span>New password</span>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Create a new password"
                value={authForm.password}
                onChange={(event) => setField('password', event.target.value)}
              />
            </label>

            <label className="auth-field-v4">
              <span>Confirm password</span>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Confirm your new password"
                value={authForm.confirmPassword}
                onChange={(event) => setField('confirmPassword', event.target.value)}
              />
            </label>
          </div>

          <div className="auth-panel-bottom-v4">
            <p className="auth-panel-meta-v4 auth-panel-meta-v4--single">{getAuthHelperText('resetPassword')}</p>
            {error && isReset ? <p className="auth-error-v4">{error}</p> : <div className="auth-error-v4 auth-error-v4--placeholder" />}
            <button className="primary-button auth-submit-button-v4" disabled={loading} type="submit">
              {loading ? 'Working...' : getAuthSubmitText('resetPassword')}
            </button>
          </div>
        </form>
      </div>
    </AuthShell>
  );
}
