import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuickAddPalette } from './QuickAddPalette';

describe('QuickAddPalette', () => {
  it('loads a suggested pattern into the textarea', async () => {
    const user = userEvent.setup();
    render(
      <QuickAddPalette
        accounts={[{ id: 'a1', name: 'HDFC', type: 'Bank', openingBalance: 0, currentBalance: 0, color: '#fff', icon: 'bank' }]}
        categories={[{ id: 'c1', name: 'Groceries', type: 'Expense', color: '#fff', icon: 'cart', isArchived: false }]}
        recentTransactions={[{ id: 't1', accountId: 'a1', accountName: 'HDFC', categoryId: 'c1', categoryName: 'Groceries', type: 'Expense', amount: 420, transactionDate: '2026-03-27T00:00:00Z', merchant: 'FreshCo', note: '', paymentMethod: 'Card', tags: [] }]}
        onClose={vi.fn()}
        onSaved={vi.fn(async () => undefined)}
      />,
    );

    await user.click(screen.getByRole('button', { name: /420 FreshCo from HDFC/i }));
    expect((screen.getByPlaceholderText('500 groceries yesterday from HDFC') as HTMLTextAreaElement).value).toBe('420 FreshCo from HDFC');
  });
});
