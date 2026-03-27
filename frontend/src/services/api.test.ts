import { describe, expect, it } from 'vitest';
import { getFriendlyError, toUserFacingError } from './api';

describe('api user-facing errors', () => {
  it('maps login 401 to a clear auth message', () => {
    expect(getFriendlyError('/api/auth/login', 401, 'Unauthorized')).toBe('Email or password is incorrect.');
  });

  it('maps technical server messages to a safe generic message', () => {
    expect(getFriendlyError('/api/accounts', 500, 'System.InvalidOperationException')).toBe('CASHKALESH is having trouble right now. Please try again in a moment.');
  });

  it('maps network failures to a clear reachability message', () => {
    expect(toUserFacingError('/api/auth/register', new TypeError('Failed to fetch'))).toBe('We could not reach CASHKALESH right now. Please check that the app is running and try again.');
  });
});
