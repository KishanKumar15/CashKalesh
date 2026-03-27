import { useState } from 'react';
import type { NotificationDto } from '../../../services/api';
import { uiButtonClass, uiChipClass, uiHeroClass, uiPanelClass } from '../finance/ui';

export function NotificationsInboxPage({
  notifications,
  onToggleRead,
}: {
  notifications: NotificationDto[];
  onToggleRead: (notification: NotificationDto) => void;
}) {
  const [mode, setMode] = useState<'all' | 'unread' | 'read'>('all');
  const visibleNotifications = notifications.filter((notification) => (mode === 'all' ? true : mode === 'unread' ? !notification.readAt : Boolean(notification.readAt)));
  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const emailCount = notifications.filter((item) => item.emailSent).length;
  const systemCount = new Set(notifications.map((item) => item.type)).size;

  if (notifications.length === 0) {
    return (
      <section className={uiHeroClass}>
        <div className="grid gap-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/65">Notification Center</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">Your inbox is clear right now.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-white/75">Budget alerts, reminders, shared-account updates, and rule activity will appear here.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="grid gap-6">
      <section className={uiHeroClass}>
        <div className="grid gap-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/65">Notification Center</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">Keep shared activity and reminders in one calm inbox.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-white/75">Read status and email delivery stay visible so it is easy to see what still needs attention.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-4"><span className="text-xs uppercase tracking-[0.16em] text-white/60">Unread</span><strong className="mt-2 block text-2xl text-white">{unreadCount}</strong></div>
            <div className="rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4"><span className="text-xs uppercase tracking-[0.16em] text-white/60">Email sent</span><strong className="mt-2 block text-2xl text-sky-100">{emailCount}</strong></div>
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4"><span className="text-xs uppercase tracking-[0.16em] text-white/60">Notification types</span><strong className="mt-2 block text-2xl text-emerald-100">{systemCount}</strong></div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-4"><span className="text-xs uppercase tracking-[0.16em] text-white/60">Total items</span><strong className="mt-2 block text-2xl text-white">{notifications.length}</strong></div>
          </div>
        </div>
      </section>

      <section className={uiPanelClass}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-[var(--text)]">Inbox</h3>
          <span className="text-sm text-[var(--muted)]">{visibleNotifications.length} visible items</span>
        </div>
        <div className="inline-flex rounded-2xl border border-white/15 bg-white/[0.04] p-1">
          <button className={`rounded-xl px-4 py-2 text-sm transition ${mode === 'all' ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white'}`} onClick={() => setMode('all')}>All</button>
          <button className={`rounded-xl px-4 py-2 text-sm transition ${mode === 'unread' ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white'}`} onClick={() => setMode('unread')}>Unread</button>
          <button className={`rounded-xl px-4 py-2 text-sm transition ${mode === 'read' ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white'}`} onClick={() => setMode('read')}>Read</button>
        </div>
      </section>

      <section className={uiPanelClass}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-[var(--text)]">Latest alerts</h3>
          <span className="text-sm text-[var(--muted)]">{unreadCount} unread</span>
        </div>
        <div className="grid gap-3">
          {visibleNotifications.map((notification) => (
            <article key={notification.id} className={`rounded-2xl border p-4 ${notification.readAt ? 'border-white/10 bg-white/[0.02]' : 'border-sky-300/30 bg-sky-500/10'}`}>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                <div>
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-[var(--text)]">{notification.title}</h4>
                    <span className="text-xs text-[var(--muted)]">{new Date(notification.createdAt).toLocaleString('en-IN')}</span>
                  </div>
                  <p className="text-sm text-[var(--muted)]">{notification.body}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={uiChipClass}>{notification.type}</span>
                    {notification.emailSent && <span className={`${uiChipClass} border-sky-300/30 bg-sky-500/20`}>Email sent</span>}
                  </div>
                </div>
                <button className={uiButtonClass('ghost')} onClick={() => onToggleRead(notification)}>{notification.readAt ? 'Mark unread' : 'Mark read'}</button>
              </div>
            </article>
          ))}
          {visibleNotifications.length === 0 && <p className="text-sm text-[var(--muted)]">No notifications in this filter.</p>}
        </div>
      </section>
    </div>
  );
}
