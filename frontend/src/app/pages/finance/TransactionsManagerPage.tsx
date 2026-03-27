import { format } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { api, type TransactionDto, type TransactionUpsertRequest } from '../../../services/api';
import { buildQueryString, groupTimelineItemsByDay, hasActiveTransactionFilters, readPrefixedFilters, validateSplitRows, validateTransactionForm, writePrefixedFilters } from '../../viewModels';
import {
  formatCurrency,
  getAvailableCategories,
  getDefaultTransactionForm,
  getTransactionQuery,
  getTransactionTone,
  parseTags,
  type TransactionFilters,
  type TransactionsManagerPageProps,
  type TransactionFormState,
} from './common';
import { uiButtonClass, uiChipClass, uiHeroClass, uiInputClass, uiPanelClass } from './ui';

type SplitRow = {
  id: string;
  categoryId: string;
  amount: string;
  note: string;
};

function createSplitRow(categoryId: string): SplitRow {
  return {
    id: Math.random().toString(36).slice(2, 10),
    categoryId,
    amount: '',
    note: '',
  };
}

type TransactionFieldKey = 'amount' | 'accountId' | 'transferAccountId' | 'categoryId' | 'transactionDate';

function getTransactionFieldErrors(form: TransactionFormState): Partial<Record<TransactionFieldKey, string>> {
  const errors: Partial<Record<TransactionFieldKey, string>> = {};
  const amount = Number(form.amount);

  if (!form.accountId) errors.accountId = 'Account is mandatory.';
  if (!Number.isFinite(amount) || amount <= 0) errors.amount = 'Amount must be greater than 0.';
  if (!form.transactionDate || Number.isNaN(new Date(form.transactionDate).getTime())) errors.transactionDate = 'Please choose a valid date.';

  if (form.type === 'Transfer') {
    if (!form.transferAccountId) errors.transferAccountId = 'Destination account is mandatory for transfer.';
    if (form.transferAccountId && form.transferAccountId === form.accountId) errors.transferAccountId = 'Destination account must be different.';
  } else if (!form.categoryId) {
    errors.categoryId = 'Category is mandatory.';
  }

  return errors;
}

export function TransactionsManagerPage({ accounts, categories, transactions, initialSearch, onChanged, setError, setToast }: TransactionsManagerPageProps) {
  const [filters, setFilters] = useState<TransactionFilters>(() => readPrefixedFilters('tx_', { search: initialSearch, accountId: '', categoryId: '', type: '', from: '', to: '' }));
  const [items, setItems] = useState(transactions);
  const [form, setForm] = useState<TransactionFormState>(() => getDefaultTransactionForm(accounts, categories));
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [swipedId, setSwipedId] = useState('');
  const [touchStartX, setTouchStartX] = useState(0);
  const [removingId, setRemovingId] = useState('');
  const [highlightIds, setHighlightIds] = useState<string[]>([]);
  const [splitTarget, setSplitTarget] = useState<TransactionDto | null>(null);
  const [splitRows, setSplitRows] = useState<SplitRow[]>([]);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<TransactionFieldKey, string>>>({});
  const groupedItems = useMemo(() => groupTimelineItemsByDay(items), [items]);

  useEffect(() => {
    if (!splitTarget) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSplitTarget(null);
        setSplitRows([]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [splitTarget]);

  useEffect(() => {
    if (!initialSearch) return;
    setFilters((current) => ({ ...current, search: initialSearch }));
  }, [initialSearch]);

  useEffect(() => {
    writePrefixedFilters('tx_', filters);
  }, [filters]);

  useEffect(() => {
    if (!form.accountId && accounts[0]) {
      setForm((current) => ({ ...current, accountId: accounts[0].id }));
    }
  }, [accounts, form.accountId]);

  useEffect(() => {
    const availableCategories = getAvailableCategories(categories, form.type);
    if (form.type === 'Transfer') {
      if (form.categoryId) {
        setForm((current) => ({ ...current, categoryId: '' }));
      }
      return;
    }

    if (!availableCategories.some((item) => item.id === form.categoryId) && availableCategories[0]) {
      setForm((current) => ({ ...current, categoryId: availableCategories[0].id }));
    }
  }, [categories, form.categoryId, form.type]);

  useEffect(() => {
    if (!hasActiveTransactionFilters(filters)) {
      setItems(transactions);
    }
  }, [filters, transactions]);

  useEffect(() => {
    if (highlightIds.length === 0) return;
    const timeout = window.setTimeout(() => setHighlightIds([]), 1400);
    return () => window.clearTimeout(timeout);
  }, [highlightIds]);

  async function loadTransactions(nextFilters: TransactionFilters) {
    setLoading(true);
    setError('');
    try {
      setItems(await api.transactions(getTransactionQuery(nextFilters)));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load transactions.');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingId('');
    setForm(getDefaultTransactionForm(accounts, categories));
    setFormError('');
    setFieldErrors({});
  }

  function startEdit(transaction: TransactionDto) {
    setEditingId(transaction.id);
    setFormError('');
    setFieldErrors({});
    setForm({
      type: transaction.type,
      amount: String(transaction.amount),
      accountId: transaction.accountId,
      transferAccountId: transaction.transferAccountId ?? '',
      categoryId: transaction.categoryId ?? '',
      merchant: transaction.merchant,
      note: transaction.note,
      paymentMethod: transaction.paymentMethod,
      transactionDate: transaction.transactionDate.slice(0, 10),
      tags: transaction.tags.join(', '),
    });
  }

  async function saveTransaction() {
    const nextFieldErrors = getTransactionFieldErrors(form);
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setFormError('Please fill the mandatory fields below.');
      return;
    }

    setFormError('');
    setFieldErrors({});
    const validationError = validateTransactionForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload: TransactionUpsertRequest = {
        accountId: form.accountId,
        transferAccountId: form.type === 'Transfer' ? form.transferAccountId || null : null,
        categoryId: form.type === 'Transfer' ? null : form.categoryId || null,
        type: form.type,
        amount: Number(form.amount),
        transactionDate: new Date(form.transactionDate).toISOString(),
        merchant: form.merchant,
        note: form.note,
        paymentMethod: form.paymentMethod,
        tags: parseTags(form.tags),
      };

      if (editingId) {
        const updated = await api.updateTransaction(editingId, payload);
        setToast('Transaction updated.');
        setHighlightIds([updated.id]);
      } else {
        const created = await api.createTransaction(payload);
        setToast('Transaction saved.');
        setHighlightIds([created.id]);
      }

      resetForm();
      await onChanged();
      await loadTransactions(filters);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not save this transaction. Please review the details and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function removeTransaction(id: string) {
    setRemovingId(id);
    window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        await api.deleteTransaction(id);
        setToast('Transaction deleted.');
        await onChanged();
        await loadTransactions(filters);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'We could not delete this transaction right now. Please try again.');
      } finally {
        setLoading(false);
        setRemovingId('');
      }
    }, 180);
  }

  function beginSplit(transaction: TransactionDto) {
    if (transaction.type === 'Transfer') {
      setError('Transfers cannot be split into multiple lines yet.');
      return;
    }
    const defaultCategory = transaction.categoryId ?? getAvailableCategories(categories, transaction.type)[0]?.id ?? '';
    setSplitTarget(transaction);
    setSplitRows([
      { id: 'base-1', categoryId: defaultCategory, amount: String((transaction.amount / 2).toFixed(2)), note: transaction.note },
      { id: 'base-2', categoryId: defaultCategory, amount: String((transaction.amount / 2).toFixed(2)), note: transaction.note },
    ]);
  }

  async function saveSplit() {
    if (!splitTarget) return;
    const validationError = validateSplitRows(splitRows, splitTarget.amount);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const createdIds: string[] = [];
      for (const row of splitRows) {
        const created = await api.createTransaction({
          accountId: splitTarget.accountId,
          transferAccountId: null,
          categoryId: row.categoryId || null,
          type: splitTarget.type,
          amount: Number(row.amount),
          transactionDate: splitTarget.transactionDate,
          merchant: splitTarget.merchant,
          note: row.note || splitTarget.note,
          paymentMethod: splitTarget.paymentMethod,
          tags: splitTarget.tags,
        });
        createdIds.push(created.id);
      }

      await api.deleteTransaction(splitTarget.id);
      setHighlightIds(createdIds);
      setToast('Transaction split into multiple lines.');
      setSplitTarget(null);
      setSplitRows([]);
      await onChanged();
      await loadTransactions(filters);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not split this transaction right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const availableCategories = getAvailableCategories(categories, form.type);
  const destinationAccounts = accounts.filter((item) => item.id !== form.accountId);
  const missingAccounts = accounts.length === 0;
  const missingCategories = form.type !== 'Transfer' && availableCategories.length === 0;
  const missingTransferDestination = form.type === 'Transfer' && destinationAccounts.length === 0;
  const canSubmitTransaction = !missingAccounts && !missingCategories && !missingTransferDestination;
  const incomeTotal = items.filter((item) => item.type === 'Income').reduce((sum, item) => sum + item.amount, 0);
  const expenseTotal = items.filter((item) => item.type === 'Expense').reduce((sum, item) => sum + item.amount, 0);
  const transferCount = items.filter((item) => item.type === 'Transfer').length;
  const latestTransaction = items[0];
  const splitAvailableCategories = splitTarget ? getAvailableCategories(categories, splitTarget.type) : [];

  return (
    <div className="grid gap-6">
      <section className={uiHeroClass}>
        <div className="grid gap-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/65">Transactions Studio</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">Capture, review, and correct money movement in one flow.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-white/75">Filters, transfers, split flows, and tags all stay in one workspace so review feels fast instead of tedious.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4"><span className="text-xs uppercase tracking-[0.16em] text-white/60">Income in view</span><strong className="mt-2 block text-2xl text-emerald-100">{formatCurrency(incomeTotal)}</strong></div>
            <div className="rounded-2xl border border-orange-300/20 bg-orange-500/10 p-4"><span className="text-xs uppercase tracking-[0.16em] text-white/60">Expense in view</span><strong className="mt-2 block text-2xl text-orange-100">{formatCurrency(expenseTotal)}</strong></div>
            <div className="rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4"><span className="text-xs uppercase tracking-[0.16em] text-white/60">Transfers</span><strong className="mt-2 block text-2xl text-sky-100">{transferCount}</strong></div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-4"><span className="text-xs uppercase tracking-[0.16em] text-white/60">Latest activity</span><strong className="mt-2 block text-2xl text-white">{latestTransaction ? format(new Date(latestTransaction.transactionDate), 'dd MMM') : 'No data'}</strong></div>
          </div>
        </div>
      </section>

      <section className={uiPanelClass}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-[var(--text)]">Refine the feed</h3>
          <span className="text-sm text-[var(--muted)]">{items.length} matching transactions</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-1.5 text-sm text-[var(--muted)]">Search<input className={uiInputClass} value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Merchant or note" /></label>
          <label className="grid gap-1.5 text-sm text-[var(--muted)]">Account<select className={uiInputClass} value={filters.accountId} onChange={(event) => setFilters((current) => ({ ...current, accountId: event.target.value }))}><option value="">All accounts</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm text-[var(--muted)]">Category<select className={uiInputClass} value={filters.categoryId} onChange={(event) => setFilters((current) => ({ ...current, categoryId: event.target.value }))}><option value="">All categories</option>{categories.filter((item) => !item.isArchived).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm text-[var(--muted)]">Transaction type<select className={uiInputClass} value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}><option value="">All types</option><option value="Expense">Expense</option><option value="Income">Income</option><option value="Transfer">Transfer</option></select></label>
          <label className="grid gap-1.5 text-sm text-[var(--muted)]">From date<input className={uiInputClass} type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} /></label>
          <label className="grid gap-1.5 text-sm text-[var(--muted)]">To date<input className={uiInputClass} type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} /></label>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {hasActiveTransactionFilters(filters)
              ? Object.entries(filters).filter(([, value]) => Boolean(value)).map(([key, value]) => <span className={uiChipClass} key={key}>{key}: {value}</span>)
              : <span className={uiChipClass}>Showing the latest 200 records</span>}
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button className={uiButtonClass('ghost')} onClick={() => { const cleared = { search: '', accountId: '', categoryId: '', type: '', from: '', to: '' }; setFilters(cleared); void loadTransactions(cleared); }}>Clear filters</button>
            <button className={uiButtonClass('primary')} disabled={loading} onClick={() => void loadTransactions(filters)}>{loading ? 'Loading...' : 'Apply filters'}</button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(360px,4fr)_minmax(0,8fr)]">
        <section className={uiPanelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">{editingId ? 'Edit transaction' : 'Add transaction'}</h3>
            <span className="text-sm text-[var(--muted)]">{editingId ? 'Update and save changes' : 'Fast capture with tags and transfer flow'}</span>
          </div>
          <p className="mb-3 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Fields marked * are mandatory</p>
          {!canSubmitTransaction && (
            <p className="field-error mb-3">
              {missingAccounts
                ? 'Create at least one account in Accounts before saving transactions.'
                : missingCategories
                  ? 'Create an active category for this transaction type in Accounts.'
                  : 'Add another account to use transfers.'}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Transaction type<select className={uiInputClass} value={form.type} onChange={(event) => { setForm((current) => ({ ...current, type: event.target.value })); setFieldErrors((current) => ({ ...current, categoryId: undefined, transferAccountId: undefined })); setFormError(''); }}><option>Expense</option><option>Income</option><option>Transfer</option></select></label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Amount (INR) *<input className={fieldErrors.amount ? `${uiInputClass} field-invalid` : uiInputClass} value={form.amount} onChange={(event) => { setForm((current) => ({ ...current, amount: event.target.value })); setFieldErrors((current) => ({ ...current, amount: undefined })); setFormError(''); }} placeholder="0.00" />{fieldErrors.amount && <span className="field-error">{fieldErrors.amount}</span>}</label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Account *<select className={fieldErrors.accountId ? `${uiInputClass} field-invalid` : uiInputClass} value={form.accountId} onChange={(event) => { setForm((current) => ({ ...current, accountId: event.target.value })); setFieldErrors((current) => ({ ...current, accountId: undefined, transferAccountId: undefined })); setFormError(''); }}><option value="">{missingAccounts ? 'No accounts available' : 'Select account'}</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{fieldErrors.accountId && <span className="field-error">{fieldErrors.accountId}</span>}</label>
            {form.type === 'Transfer'
              ? <label className="grid gap-1.5 text-sm text-[var(--muted)]">Destination account *<select className={fieldErrors.transferAccountId ? `${uiInputClass} field-invalid` : uiInputClass} value={form.transferAccountId} onChange={(event) => { setForm((current) => ({ ...current, transferAccountId: event.target.value })); setFieldErrors((current) => ({ ...current, transferAccountId: undefined })); setFormError(''); }}><option value="">{missingTransferDestination ? 'No destination account' : 'Select destination account'}</option>{destinationAccounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{fieldErrors.transferAccountId && <span className="field-error">{fieldErrors.transferAccountId}</span>}</label>
              : <label className="grid gap-1.5 text-sm text-[var(--muted)]">Category *<select className={fieldErrors.categoryId ? `${uiInputClass} field-invalid` : uiInputClass} value={form.categoryId} onChange={(event) => { setForm((current) => ({ ...current, categoryId: event.target.value })); setFieldErrors((current) => ({ ...current, categoryId: undefined })); setFormError(''); }}><option value="">{missingCategories ? 'No categories available' : 'Select category'}</option>{availableCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{fieldErrors.categoryId && <span className="field-error">{fieldErrors.categoryId}</span>}</label>}
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Merchant / payee (optional)<input className={uiInputClass} value={form.merchant} onChange={(event) => setForm((current) => ({ ...current, merchant: event.target.value }))} placeholder="Example: Amazon" /></label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Transaction date *<input className={fieldErrors.transactionDate ? `${uiInputClass} field-invalid` : uiInputClass} type="date" value={form.transactionDate} onChange={(event) => { setForm((current) => ({ ...current, transactionDate: event.target.value })); setFieldErrors((current) => ({ ...current, transactionDate: undefined })); setFormError(''); }} />{fieldErrors.transactionDate && <span className="field-error">{fieldErrors.transactionDate}</span>}</label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Payment method (optional)<input className={uiInputClass} value={form.paymentMethod} onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))} placeholder="Card, UPI, bank transfer" /></label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Tags (optional)<input className={uiInputClass} value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="travel, work, reimbursement" /></label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)] sm:col-span-2">Notes (optional)<input className={uiInputClass} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Add any context for this transaction" /></label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className={uiChipClass}>{form.type}</span>
            {form.accountId && <span className={uiChipClass}>{accounts.find((item) => item.id === form.accountId)?.name ?? 'Account selected'}</span>}
            {form.type === 'Transfer'
              ? form.transferAccountId && <span className={uiChipClass}>To {accounts.find((item) => item.id === form.transferAccountId)?.name ?? 'destination'}</span>
              : form.categoryId && <span className={uiChipClass}>{categories.find((item) => item.id === form.categoryId)?.name ?? 'Category selected'}</span>}
          </div>

          {formError && <p className="field-error mt-3">{formError}</p>}
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button className={uiButtonClass('ghost')} onClick={resetForm}>Clear form</button>
            <button className={uiButtonClass('primary')} disabled={loading || !canSubmitTransaction} onClick={() => void saveTransaction()}>{editingId ? 'Update transaction' : 'Save transaction'}</button>
          </div>
        </section>

        <section className={uiPanelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">Activity feed</h3>
            <span className="text-sm text-[var(--muted)]">{hasActiveTransactionFilters(filters) ? buildQueryString(getTransactionQuery(filters)).replace('?', '') || 'custom filters' : 'Latest 200 records'}</span>
          </div>

          <div className="grid gap-3">
            {groupedItems.map((group) => (
              <section key={group.label} className="timeline-group grid gap-3">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{group.label}</div>
                <div className="timeline-group-items grid gap-3">
                  {group.items.map((transaction) => (
                    <article
                      key={transaction.id}
                      className={`transaction-entity rounded-2xl border border-white/10 bg-[#0f1930]/85 p-4 transition ${swipedId === transaction.id ? 'swipe-open' : ''} ${highlightIds.includes(transaction.id) ? 'transaction-animate-in' : ''} ${removingId === transaction.id ? 'transaction-removing' : ''}`}
                      onTouchStart={(event) => setTouchStartX(event.changedTouches[0]?.clientX ?? 0)}
                      onTouchEnd={(event) => {
                        const delta = touchStartX - (event.changedTouches[0]?.clientX ?? 0);
                        if (delta > 48) setSwipedId(transaction.id);
                        if (delta < -24) setSwipedId('');
                      }}
                    >
                      <div className="transaction-entity-main flex gap-3">
                        <div className={`transaction-avatar avatar-${getTransactionTone(transaction.type)} flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold`}>{(transaction.merchant || transaction.type).slice(0, 1).toUpperCase()}</div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-sm font-semibold text-[var(--text)]">{transaction.merchant || transaction.type}</h4>
                            <span className="text-xs text-[var(--muted)]">{format(new Date(transaction.transactionDate), 'dd MMM yyyy')}</span>
                          </div>
                          <p className="text-sm text-[var(--muted)]">{transaction.accountName}{transaction.type === 'Transfer' ? ' transfer' : ` | ${transaction.categoryName ?? 'Uncategorized'}`}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className={`pill ${uiChipClass} ${getTransactionTone(transaction.type)}`}>{transaction.type}</span>
                            <span className={uiChipClass}>{transaction.paymentMethod}</span>
                          </div>
                          {transaction.note && <details className="transaction-note mt-2"><summary className="cursor-pointer text-xs text-[var(--muted)]">View note</summary><p className="mt-1 text-sm text-[var(--muted)]">{transaction.note}</p></details>}
                        </div>
                      </div>

                      <div className="transaction-entity-side mt-3 grid gap-2 justify-items-start md:mt-0 md:justify-items-end">
                        {transaction.tags.length > 0 && <div className="flex flex-wrap gap-2">{transaction.tags.map((tag) => <span className={uiChipClass} key={`${transaction.id}-${tag}`}>{tag}</span>)}</div>}
                        <strong className={`text-base ${transaction.type === 'Income' ? 'text-emerald-300' : transaction.type === 'Expense' ? 'text-orange-300' : 'text-sky-300'}`}>{transaction.type === 'Income' ? '+' : transaction.type === 'Expense' ? '-' : ''}{formatCurrency(transaction.amount)}</strong>
                        <div className="transaction-actions flex flex-wrap gap-2">
                          <button className={uiButtonClass('ghost')} onClick={() => startEdit(transaction)}>Edit</button>
                          {transaction.type !== 'Transfer' && <button className={uiButtonClass('ghost')} onClick={() => beginSplit(transaction)}>Split</button>}
                          <button className={uiButtonClass('ghost')} onClick={() => void removeTransaction(transaction.id)}>Delete</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
            {items.length === 0 && <p className="text-sm text-[var(--muted)]">No transactions match these filters yet.</p>}
          </div>
        </section>
      </div>

      {splitTarget && (
        <div className="split-modal-backdrop" onClick={() => { setSplitTarget(null); setSplitRows([]); }}>
          <section className="split-modal split-panel rounded-3xl border border-sky-300/30 bg-sky-500/5 p-5 md:p-6" role="dialog" aria-modal="true" aria-label={`Split ${splitTarget.merchant || splitTarget.type}`} onClick={(event) => event.stopPropagation()}>
            <div className="split-modal-header mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text)]">Split {splitTarget.merchant || splitTarget.type}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">Press Esc or click outside to close.</p>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-sm text-[var(--muted)]">{formatCurrency(splitTarget.amount)} total must be preserved</span>
                <button className={uiButtonClass('ghost')} onClick={() => { setSplitTarget(null); setSplitRows([]); }}>Close</button>
              </div>
            </div>

            <div className="split-modal-content grid gap-3">
              {splitRows.map((row, index) => (
                <div key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-[var(--text)]">Split line {index + 1}</h4>
                    {splitRows.length > 2 && <button className={uiButtonClass('ghost')} onClick={() => setSplitRows((current) => current.filter((item) => item.id !== row.id))}>Remove</button>}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-sm text-[var(--muted)]">Category<select className={uiInputClass} value={row.categoryId} onChange={(event) => setSplitRows((current) => current.map((item) => item.id === row.id ? { ...item, categoryId: event.target.value } : item))}>{splitAvailableCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                    <label className="grid gap-1.5 text-sm text-[var(--muted)]">Amount<input className={uiInputClass} value={row.amount} onChange={(event) => setSplitRows((current) => current.map((item) => item.id === row.id ? { ...item, amount: event.target.value } : item))} /></label>
                    <label className="grid gap-1.5 text-sm text-[var(--muted)] sm:col-span-2">Note<input className={uiInputClass} value={row.note} onChange={(event) => setSplitRows((current) => current.map((item) => item.id === row.id ? { ...item, note: event.target.value } : item))} /></label>
                  </div>
                </div>
              ))}
            </div>

            <div className="split-modal-footer mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                <span className={uiChipClass}>Split total: {formatCurrency(splitRows.reduce((sum, row) => sum + Number(row.amount || 0), 0))}</span>
                <span className={`${uiChipClass} border-sky-200/30 bg-sky-500/20`}>Original: {formatCurrency(splitTarget.amount)}</span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button className={uiButtonClass('ghost')} onClick={() => setSplitRows((current) => [...current, createSplitRow(splitAvailableCategories[0]?.id ?? '')])}>Add split line</button>
                <button className={uiButtonClass('ghost')} onClick={() => { setSplitTarget(null); setSplitRows([]); }}>Cancel</button>
                <button className={uiButtonClass('primary')} disabled={loading} onClick={() => void saveSplit()}>Save split</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
