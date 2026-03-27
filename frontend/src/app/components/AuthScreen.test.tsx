import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AuthScreen } from './AuthScreen';
import type { AuthFormState, AuthMode } from '../types';

function AuthScreenHarness() {
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

  return (
    <AuthScreen
      authMode={authMode}
      setAuthMode={setAuthMode}
      authForm={authForm}
      setAuthForm={setAuthForm}
      error=""
      loading={false}
      onSubmit={vi.fn()}
      googleClientId=""
      googleButtonRef={{ current: null }}
    />
  );
}

describe('AuthScreen', () => {
  it('switches modes and shows mode-specific fields', async () => {
    const user = userEvent.setup();
    render(<AuthScreenHarness />);

    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByLabelText('First name')).toBeTruthy();
    expect(screen.getByLabelText('Last name')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeTruthy();
  });
});
