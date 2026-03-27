import { describe, expect, it } from 'vitest';
import {
  buildQueryString,
  getAuthHelperText,
  getAuthSubmitText,
  getBudgetPeriodLabel,
  getGoalProgressPercent,
  groupTimelineItemsByDay,
  hasActiveTransactionFilters,
  summarizeSeries,
  validateAccountForm,
  validateAuthForm,
  validateBudgetForm,
  validateGoalEntryAmount,
  validateGoalForm,
  validateQuickAddDraft,
  validateRecurringForm,
  validateSplitRows,
  validateTransactionForm,
} from './viewModels';

describe('viewModels', () => {
  it('returns auth helper copy for forgot password', () => {
    expect(getAuthHelperText('forgotPassword')).toContain('reset');
  });

  it('returns correct auth submit text for signup mode', () => {
    expect(getAuthSubmitText('signup')).toBe('Create account');
  });

  it('caps goal progress at 100 percent', () => {
    expect(getGoalProgressPercent(150, 100)).toBe(100);
  });

  it('builds compact query strings without empty values', () => {
    expect(buildQueryString({ search: 'rent', pageSize: 200, categoryId: '', type: undefined })).toBe('?search=rent&pageSize=200');
  });

  it('detects whether transaction filters are active', () => {
    expect(hasActiveTransactionFilters({ search: '', accountId: '', categoryId: '', type: '', from: '', to: '' })).toBe(false);
    expect(hasActiveTransactionFilters({ search: 'uber' })).toBe(true);
  });

  it('formats budget periods for the UI', () => {
    expect(getBudgetPeriodLabel(3, 2026)).toContain('2026');
  });

  it('groups timeline items by day label', () => {
    const grouped = groupTimelineItemsByDay([
      { id: '1', transactionDate: '2026-03-27T12:00:00Z' },
      { id: '2', transactionDate: '2026-03-27T09:00:00Z' },
      { id: '3', transactionDate: '2026-03-26T09:00:00Z' },
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped[0]?.items).toHaveLength(2);
    expect(grouped[1]?.items).toHaveLength(1);
  });

  it('builds readable chart summaries', () => {
    expect(summarizeSeries([
      { label: 'Jan', balance: 1000 },
      { label: 'Feb', balance: 1600 },
    ], 'Balance trend')).toContain('ending at 1,600');
  });

  it('validates auth inputs before network calls', () => {
    expect(validateAuthForm('signup', { firstName: '', lastName: '', email: 'bad', password: 'short', confirmPassword: '', termsAccepted: false, resetToken: '' })).toContain('valid email');
    expect(validateAuthForm('signup', { firstName: 'A', lastName: 'B', email: 'user@example.com', password: 'lowercase1', confirmPassword: '', termsAccepted: false, resetToken: '' })).toContain('first name');
    expect(validateAuthForm('login', { firstName: '', lastName: '', email: 'user@example.com', password: 'Password1', confirmPassword: '', termsAccepted: false, resetToken: '' })).toBe('');
  });

  it('validates transaction and split forms with user-friendly guidance', () => {
    expect(validateTransactionForm({ type: 'Transfer', amount: '1200', accountId: 'a1', transferAccountId: 'a1', categoryId: '', transactionDate: '2026-03-27' })).toContain('different destination account');
    expect(validateSplitRows([{ categoryId: 'c1', amount: '100' }, { categoryId: 'c2', amount: '25' }], 150)).toContain('must add up');
  });

  it('validates budget, goal, recurring, account, and quick add forms', () => {
    expect(validateBudgetForm({ categoryId: '', month: '3', year: '2026', amount: '5000', alertThresholdPercent: '80' })).toContain('choose a category');
    expect(validateGoalForm({ name: '', targetAmount: '10000', targetDate: '' })).toContain('clear name');
    expect(validateGoalEntryAmount('0')).toContain('amount greater than 0');
    expect(validateRecurringForm({ title: 'Rent', amount: '0', accountId: 'a1', categoryId: 'c1', type: 'Expense', startDate: '2026-03-27', endDate: '' })).toContain('amount greater than 0');
    expect(validateAccountForm({ name: 'A', type: 'Savings', openingBalance: '1000' })).toContain('account name');
    expect(validateQuickAddDraft({ type: 'Expense', amount: 0, accountId: 'a1', categoryId: 'c1', transactionDate: '2026-03-27', merchant: 'Groceries' })).toContain('amount greater than 0');
  });
});
