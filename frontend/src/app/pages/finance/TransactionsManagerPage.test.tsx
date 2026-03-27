import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TransactionsManagerPage } from './TransactionsManagerPage';

describe('TransactionsManagerPage', () => {
  it('opens the split panel from a transaction card', async () => {
    const user = userEvent.setup();
    render(
      <TransactionsManagerPage
        accounts={[{ id: 'a1', name: 'HDFC', type: 'Bank', openingBalance: 0, currentBalance: 0, color: '#fff', icon: 'bank' }]}
        categories={[{ id: 'c1', name: 'Groceries', type: 'Expense', color: '#fff', icon: 'cart', isArchived: false }]}
        transactions={[{ id: 't1', accountId: 'a1', accountName: 'HDFC', categoryId: 'c1', categoryName: 'Groceries', type: 'Expense', amount: 600, transactionDate: '2026-03-27T00:00:00Z', merchant: 'FreshCo', note: 'Weekly stock', paymentMethod: 'Card', tags: [] }]}
        initialSearch=""
        onChanged={vi.fn(async () => undefined)}
        setError={vi.fn()}
        setToast={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Split' }));
    expect(screen.getByText('Split FreshCo')).toBeTruthy();
    expect(screen.getByText(/600 total must be preserved/i)).toBeTruthy();
  });
});
