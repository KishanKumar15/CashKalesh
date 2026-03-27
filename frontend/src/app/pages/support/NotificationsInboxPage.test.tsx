import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NotificationsInboxPage } from './NotificationsInboxPage';

describe('NotificationsInboxPage', () => {
  it('filters unread notifications', async () => {
    const user = userEvent.setup();
    render(
      <NotificationsInboxPage
        notifications={[
          { id: 'n1', type: 'Budget', title: 'Unread budget alert', body: 'Body', emailSent: true, createdAt: '2026-03-27T00:00:00Z', readAt: null },
          { id: 'n2', type: 'Rule', title: 'Read rule alert', body: 'Body', emailSent: false, createdAt: '2026-03-27T00:00:00Z', readAt: '2026-03-27T01:00:00Z' },
        ]}
        onToggleRead={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Unread' }));
    expect(screen.getByText('Unread budget alert')).toBeTruthy();
    expect(screen.queryByText('Read rule alert')).toBeNull();
  });
});
