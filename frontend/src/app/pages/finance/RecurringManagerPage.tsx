import { format } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { api, type RecurringUpsertRequest } from '../../../services/api';
import { validateRecurringForm } from '../../viewModels';
import { getAvailableCategories, getDefaultRecurringForm, type RecurringFormState, type RecurringManagerPageProps } from './common';
import { uiButtonClass, uiChipClass, uiEntityCardClass, uiHeroClass, uiInputClass, uiPanelClass, uiStatCardClass } from './ui';

type RecurringFieldKey = 'title' | 'amount' | 'accountId' | 'categoryId' | 'startDate' | 'endDate';

export function RecurringManagerPage({ items, accounts, categories, onChanged, setError, setToast }: RecurringManagerPageProps) {
  const [form, setForm] = useState<RecurringFormState>(() => getDefaultRecurringForm(accounts, categories));
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [recurringItems, setRecurringItems] = useState(items);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<RecurringFieldKey, string>>>({});

  useEffect(() => {
    setRecurringItems(items);
  }, [items]);

  useEffect(() => {
    if (!form.accountId && accounts[0]) {
      setForm((current) => ({ ...current, accountId: accounts[0].id }));
    }
  }, [accounts, form.accountId]);

  useEffect(() => {
    const availableCategories = getAvailableCategories(categories, form.type);
    if (!availableCategories.some((item) => item.id === form.categoryId) && availableCategories[0]) {
      setForm((current) => ({ ...current, categoryId: availableCategories[0].id }));
    }
  }, [categories, form.categoryId, form.type]);

  function resetForm() {
    setEditingId('');
    setForm(getDefaultRecurringForm(accounts, categories));
    setFormError('');
    setFieldErrors({});
  }

  const projectedMonthlyFlow = useMemo(() => recurringItems.reduce((sum, item) => {
    const multiplier = item.frequency === 'Daily' ? 30 : item.frequency === 'Weekly' ? 4 : item.frequency === 'Yearly' ? 1 / 12 : 1;
    return sum + (item.type === 'Expense' ? -item.amount : item.amount) * multiplier;
  }, 0), [recurringItems]);
  const pausedCount = recurringItems.filter((item) => item.isPaused).length;
  const upcomingCount = recurringItems.filter((item) => new Date(item.nextRunDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).length;

  function startEdit(item: (typeof recurringItems)[number]) {
    setEditingId(item.id);
    setFormError('');
    setFieldErrors({});
    setForm({
      title: item.title,
      type: item.type,
      amount: String(item.amount),
      accountId: item.accountId,
      categoryId: item.categoryId ?? '',
      frequency: item.frequency,
      startDate: item.startDate.slice(0, 10),
      endDate: item.endDate?.slice(0, 10) ?? '',
      autoCreateTransaction: item.autoCreateTransaction,
      isPaused: item.isPaused,
    });
  }

  async function refreshRecurring() {
    setRecurringItems(await api.recurring());
  }

  async function saveRecurring() {
    const nextFieldErrors: Partial<Record<RecurringFieldKey, string>> = {};
    if (form.title.trim().length < 2) nextFieldErrors.title = 'Title is mandatory.';
    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) nextFieldErrors.amount = 'Amount must be greater than 0.';
    if (!form.accountId) nextFieldErrors.accountId = 'Account is mandatory.';
    if (!form.categoryId) nextFieldErrors.categoryId = 'Category is mandatory.';
    if (!form.startDate || Number.isNaN(new Date(form.startDate).getTime())) nextFieldErrors.startDate = 'Start date is mandatory.';
    if (form.endDate && Number.isNaN(new Date(form.endDate).getTime())) nextFieldErrors.endDate = 'Enter a valid end date.';
    if (form.startDate && form.endDate && new Date(form.endDate).getTime() < new Date(form.startDate).getTime()) nextFieldErrors.endDate = 'End date must be after start date.';
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setFormError('Please complete the mandatory fields below.');
      return;
    }

    setFormError('');
    setFieldErrors({});
    const validationError = validateRecurringForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload: RecurringUpsertRequest = {
        title: form.title,
        type: form.type,
        amount: Number(form.amount),
        accountId: form.accountId,
        categoryId: form.categoryId || null,
        frequency: form.frequency,
        startDate: new Date(form.startDate).toISOString(),
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
        autoCreateTransaction: form.autoCreateTransaction,
        isPaused: form.isPaused,
      };

      if (editingId) {
        await api.updateRecurring(editingId, payload);
        setToast('Recurring item updated.');
      } else {
        await api.createRecurring(payload);
        setToast('Recurring item created.');
      }

      resetForm();
      await onChanged();
      await refreshRecurring();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not save this recurring item right now. Please review the details and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function togglePause(item: (typeof recurringItems)[number]) {
    setLoading(true);
    setError('');
    try {
      if (item.isPaused) {
        await api.resumeRecurring(item.id);
        setToast('Recurring item resumed.');
      } else {
        await api.pauseRecurring(item.id);
        setToast('Recurring item paused.');
      }
      await onChanged();
      await refreshRecurring();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not update this recurring item right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function removeRecurring(id: string) {
    setLoading(true);
    setError('');
    try {
      await api.deleteRecurring(id);
      setToast('Recurring item deleted.');
      await onChanged();
      await refreshRecurring();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not delete this recurring item right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const availableCategories = getAvailableCategories(categories, form.type);
  const hasAccounts = accounts.length > 0;
  const hasAvailableCategories = availableCategories.length > 0;
  const canSaveRecurring = hasAccounts && hasAvailableCategories;

  return (
    <div className="grid gap-6">
      <section className={uiHeroClass}>
        <div className="grid gap-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/65">Recurring Control</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">See scheduled money movement before it shapes the month.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-white/75">Subscriptions, salary, rent, and predictable transfers stay in one cleaner schedule view.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className={uiStatCardClass('base')}><span className="text-xs uppercase tracking-[0.16em] text-white/60">Scheduled items</span><strong className="mt-2 block text-2xl text-white">{recurringItems.length}</strong></div>
            <div className={uiStatCardClass('neutral')}><span className="text-xs uppercase tracking-[0.16em] text-white/60">Next 7 days</span><strong className="mt-2 block text-2xl text-sky-100">{upcomingCount}</strong></div>
            <div className={uiStatCardClass('warning')}><span className="text-xs uppercase tracking-[0.16em] text-white/60">Paused</span><strong className="mt-2 block text-2xl text-orange-100">{pausedCount}</strong></div>
            <div className={uiStatCardClass(projectedMonthlyFlow >= 0 ? 'positive' : 'warning')}><span className="text-xs uppercase tracking-[0.16em] text-white/60">Monthly effect</span><strong className={`mt-2 block text-2xl ${projectedMonthlyFlow >= 0 ? 'text-emerald-100' : 'text-orange-100'}`}>{projectedMonthlyFlow.toLocaleString('en-IN')}</strong></div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(360px,4fr)_minmax(0,8fr)]">
        <section className={uiPanelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">{editingId ? 'Edit recurring item' : 'Create recurring item'}</h3>
            <span className="text-sm text-[var(--muted)]">Set schedule, account, and auto-create behavior</span>
          </div>
          <p className="mb-3 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Fields marked * are mandatory</p>
          {!canSaveRecurring && (
            <p className="field-error mb-3">
              {!hasAccounts
                ? 'Create at least one account in Accounts before adding recurring items.'
                : 'Create an active category for this recurring type in Accounts.'}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm text-[var(--muted)] sm:col-span-2">Title (required) *<input className={fieldErrors.title ? `${uiInputClass} field-invalid` : uiInputClass} value={form.title} onChange={(event) => { setForm((current) => ({ ...current, title: event.target.value })); setFieldErrors((current) => ({ ...current, title: undefined })); setFormError(''); }} placeholder="Example: Monthly Rent" />{fieldErrors.title && <span className="field-error">{fieldErrors.title}</span>}</label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Type<select className={uiInputClass} value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}><option>Expense</option><option>Income</option></select></label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Amount (INR, required) *<input className={fieldErrors.amount ? `${uiInputClass} field-invalid` : uiInputClass} value={form.amount} onChange={(event) => { setForm((current) => ({ ...current, amount: event.target.value })); setFieldErrors((current) => ({ ...current, amount: undefined })); setFormError(''); }} placeholder="0.00" />{fieldErrors.amount && <span className="field-error">{fieldErrors.amount}</span>}</label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Account (required) *<select className={fieldErrors.accountId ? `${uiInputClass} field-invalid` : uiInputClass} value={form.accountId} onChange={(event) => { setForm((current) => ({ ...current, accountId: event.target.value })); setFieldErrors((current) => ({ ...current, accountId: undefined })); setFormError(''); }}><option value="">{hasAccounts ? 'Choose an account' : 'No accounts available'}</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{fieldErrors.accountId && <span className="field-error">{fieldErrors.accountId}</span>}</label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Category (required) *<select className={fieldErrors.categoryId ? `${uiInputClass} field-invalid` : uiInputClass} value={form.categoryId} onChange={(event) => { setForm((current) => ({ ...current, categoryId: event.target.value })); setFieldErrors((current) => ({ ...current, categoryId: undefined })); setFormError(''); }}><option value="">{hasAvailableCategories ? 'Choose a category' : 'No categories available'}</option>{availableCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{fieldErrors.categoryId && <span className="field-error">{fieldErrors.categoryId}</span>}</label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Frequency<select className={uiInputClass} value={form.frequency} onChange={(event) => setForm((current) => ({ ...current, frequency: event.target.value }))}><option>Daily</option><option>Weekly</option><option>Monthly</option><option>Yearly</option></select></label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Start date (required) *<input className={fieldErrors.startDate ? `${uiInputClass} field-invalid` : uiInputClass} type="date" value={form.startDate} onChange={(event) => { setForm((current) => ({ ...current, startDate: event.target.value })); setFieldErrors((current) => ({ ...current, startDate: undefined, endDate: undefined })); setFormError(''); }} />{fieldErrors.startDate && <span className="field-error">{fieldErrors.startDate}</span>}</label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">End date (optional)<input className={fieldErrors.endDate ? `${uiInputClass} field-invalid` : uiInputClass} type="date" value={form.endDate} onChange={(event) => { setForm((current) => ({ ...current, endDate: event.target.value })); setFieldErrors((current) => ({ ...current, endDate: undefined })); setFormError(''); }} />{fieldErrors.endDate && <span className="field-error">{fieldErrors.endDate}</span>}</label>
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-[var(--muted)]"><input type="checkbox" checked={form.autoCreateTransaction} onChange={(event) => setForm((current) => ({ ...current, autoCreateTransaction: event.target.checked }))} />Auto-create transaction on schedule</label>
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-[var(--muted)]"><input type="checkbox" checked={form.isPaused} onChange={(event) => setForm((current) => ({ ...current, isPaused: event.target.checked }))} />Start in paused mode</label>
          </div>
          {formError && <p className="field-error mt-3">{formError}</p>}
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button className={uiButtonClass('ghost')} onClick={resetForm}>Clear form</button>
            <button className={uiButtonClass('primary')} disabled={loading || !canSaveRecurring} onClick={() => void saveRecurring()}>{editingId ? 'Update schedule' : 'Save schedule'}</button>
          </div>
        </section>

        <section className={uiPanelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">Recurring schedule</h3>
            <span className="text-sm text-[var(--muted)]">{recurringItems.length} scheduled items</span>
          </div>
          <div className="grid gap-3">
            {recurringItems.map((item) => (
              <article key={item.id} className={uiEntityCardClass}>
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                  <div>
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-[var(--text)]">{item.title}</h4>
                      <span className="text-xs text-[var(--muted)]">{item.frequency}</span>
                    </div>
                    <p className="text-sm text-[var(--muted)]">{item.accountName}{item.categoryName ? ` | ${item.categoryName}` : ''}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">Next run {format(new Date(item.nextRunDate), 'dd MMM yyyy')}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`${uiChipClass} ${item.isPaused ? 'border-orange-300/30 bg-orange-500/20' : 'border-sky-300/30 bg-sky-500/20'}`}>{item.isPaused ? 'Paused' : 'Active'}</span>
                      {item.autoCreateTransaction && <span className={uiChipClass}>Auto-create on</span>}
                      <span className={`${uiChipClass} ${item.type === 'Income' ? 'border-emerald-300/30 bg-emerald-500/20' : 'border-orange-300/30 bg-orange-500/20'}`}>{item.type}</span>
                    </div>
                  </div>
                  <div className="grid gap-2 justify-items-start lg:justify-items-end">
                    <strong className={`text-base ${item.type === 'Income' ? 'text-emerald-300' : 'text-orange-300'}`}>{item.type === 'Income' ? '+' : '-'}{item.amount.toLocaleString()}</strong>
                    <div className="flex flex-wrap gap-2">
                      <button className={uiButtonClass('ghost')} onClick={() => startEdit(item)}>Edit</button>
                      <button className={uiButtonClass('ghost')} onClick={() => void togglePause(item)}>{item.isPaused ? 'Resume' : 'Pause'}</button>
                      <button className={uiButtonClass('ghost')} onClick={() => void removeRecurring(item.id)}>Delete</button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
            {recurringItems.length === 0 && <p className="text-sm text-[var(--muted)]">No recurring items are configured yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

