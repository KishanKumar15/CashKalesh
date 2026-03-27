import { useEffect, useMemo, useState } from 'react';
import { api, type BudgetUpsertRequest } from '../../../services/api';
import { getBudgetPeriodLabel, validateBudgetForm } from '../../viewModels';
import {
  formatCurrency,
  getBudgetStatus,
  getBudgetTone,
  getCurrentMonth,
  getCurrentYear,
  getDefaultBudgetForm,
  type BudgetFormState,
  type BudgetsManagerPageProps,
} from './common';
import { uiButtonClass, uiChipClass, uiHeroClass, uiInputClass, uiPanelClass, uiStatCardClass } from './ui';

type BudgetFieldKey = 'categoryId' | 'amount' | 'month' | 'year' | 'alertThresholdPercent';

function getPreviousPeriod(month: string, year: string) {
  const currentMonth = Number(month);
  const currentYear = Number(year);
  if (currentMonth === 1) {
    return { month: 12, year: currentYear - 1 };
  }
  return { month: currentMonth - 1, year: currentYear };
}

function calculateControlScore(totalBudgeted: number, totalSpent: number, overspentCount: number, onTrackCount: number, totalCount: number) {
  if (totalCount === 0 || totalBudgeted <= 0) return 0;
  const utilization = Math.min(100, (totalSpent / totalBudgeted) * 100);
  const onTrackBonus = (onTrackCount / totalCount) * 22;
  const overspendPenalty = overspentCount * 14;
  return Math.max(0, Math.min(100, Math.round(100 - utilization * 0.38 - overspendPenalty + onTrackBonus)));
}

function budgetCardToneClass(healthPercent: number) {
  const tone = getBudgetTone(healthPercent);
  if (tone === 'danger') return 'border-rose-300/25 bg-rose-500/10';
  if (tone === 'warning') return 'border-amber-300/25 bg-amber-500/10';
  return 'border-emerald-300/25 bg-emerald-500/10';
}

export function BudgetsManagerPage({ accounts, categories, initialBudgets, onChanged, setError, setToast }: BudgetsManagerPageProps) {
  const [budgets, setBudgets] = useState(initialBudgets);
  const [month, setMonth] = useState(getCurrentMonth());
  const [year, setYear] = useState(getCurrentYear());
  const [form, setForm] = useState<BudgetFormState>(() => getDefaultBudgetForm(categories));
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [previousPeriodBudgets, setPreviousPeriodBudgets] = useState(initialBudgets);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<BudgetFieldKey, string>>>({});

  const expenseCategories = categories.filter((item) => item.type === 'Expense' && !item.isArchived);

  useEffect(() => {
    if (!form.categoryId && expenseCategories[0]) {
      setForm((current) => ({ ...current, categoryId: expenseCategories[0].id }));
    }
  }, [expenseCategories, form.categoryId]);

  useEffect(() => {
    setForm((current) => ({ ...current, month, year }));
  }, [month, year]);

  useEffect(() => {
    void loadBudgets(month, year);
    void loadPreviousPeriodBudgets(month, year);
  }, [month, year]);

  useEffect(() => {
    if (month === getCurrentMonth() && year === getCurrentYear()) {
      setBudgets(initialBudgets);
    }
  }, [initialBudgets, month, year]);

  async function loadBudgets(targetMonth: string, targetYear: string) {
    setLoading(true);
    setError('');
    try {
      setBudgets(await api.budgets({ month: Number(targetMonth), year: Number(targetYear) }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load budgets.');
    } finally {
      setLoading(false);
    }
  }

  async function loadPreviousPeriodBudgets(targetMonth: string, targetYear: string) {
    const previousPeriod = getPreviousPeriod(targetMonth, targetYear);
    try {
      setPreviousPeriodBudgets(await api.budgets(previousPeriod));
    } catch {
      setPreviousPeriodBudgets([]);
    }
  }

  function resetForm() {
    setEditingId('');
    setForm({ ...getDefaultBudgetForm(categories), month, year });
    setFormError('');
    setFieldErrors({});
  }

  function startEdit(budget: (typeof budgets)[number]) {
    setEditingId(budget.id);
    setFormError('');
    setFieldErrors({});
    setForm({
      categoryId: budget.categoryId,
      accountId: budget.accountId ?? '',
      month: String(budget.month),
      year: String(budget.year),
      amount: String(budget.amount),
      alertThresholdPercent: '80',
    });
  }

  async function saveBudget() {
    const nextFieldErrors: Partial<Record<BudgetFieldKey, string>> = {};
    if (!form.categoryId) nextFieldErrors.categoryId = 'Category is mandatory.';
    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) nextFieldErrors.amount = 'Amount must be greater than 0.';
    if (!Number.isFinite(Number(form.month)) || Number(form.month) < 1 || Number(form.month) > 12) nextFieldErrors.month = 'Enter a valid month.';
    if (!Number.isFinite(Number(form.year)) || Number(form.year) < 2000 || Number(form.year) > 2100) nextFieldErrors.year = 'Enter a valid year.';
    if (!Number.isFinite(Number(form.alertThresholdPercent)) || Number(form.alertThresholdPercent) < 1 || Number(form.alertThresholdPercent) > 100) nextFieldErrors.alertThresholdPercent = 'Threshold must be between 1 and 100.';
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setFormError('Please complete the mandatory fields below.');
      return;
    }

    setFormError('');
    setFieldErrors({});
    const validationError = validateBudgetForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload: BudgetUpsertRequest = {
        categoryId: form.categoryId,
        accountId: form.accountId || null,
        month: Number(form.month),
        year: Number(form.year),
        amount: Number(form.amount),
        alertThresholdPercent: Number(form.alertThresholdPercent),
      };

      if (editingId) {
        await api.updateBudget(editingId, payload);
        setToast('Budget updated.');
      } else {
        await api.createBudget(payload);
        setToast('Budget created.');
      }

      resetForm();
      await onChanged();
      await loadBudgets(month, year);
      await loadPreviousPeriodBudgets(month, year);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not save this budget right now. Please review the details and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function removeBudget(id: string) {
    setLoading(true);
    setError('');
    try {
      await api.deleteBudget(id);
      setToast('Budget deleted.');
      await onChanged();
      await loadBudgets(month, year);
      await loadPreviousPeriodBudgets(month, year);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not delete this budget right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function duplicateLastMonth() {
    setLoading(true);
    setError('');
    try {
      await api.duplicateLastMonthBudget();
      setToast('Last month budgets duplicated.');
      await onChanged();
      await loadBudgets(month, year);
      await loadPreviousPeriodBudgets(month, year);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not copy last month\'s budgets right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const totalBudgeted = budgets.reduce((sum, budget) => sum + budget.amount, 0);
  const totalSpent = budgets.reduce((sum, budget) => sum + budget.spent, 0);
  const overspentCount = budgets.filter((budget) => budget.healthPercent >= 100).length;
  const sharedCount = budgets.filter((budget) => budget.isShared).length;
  const onTrackCount = budgets.filter((budget) => budget.healthPercent < 80).length;
  const previousOverspentCount = previousPeriodBudgets.filter((budget) => budget.healthPercent >= 100).length;
  const streak = overspentCount === 0 ? (previousOverspentCount === 0 ? 2 : 1) : 0;
  const controlScore = calculateControlScore(totalBudgeted, totalSpent, overspentCount, onTrackCount, budgets.length);
  const celebrationReady = budgets.length > 0 && overspentCount === 0 && totalSpent <= totalBudgeted;
  const smallWins = [
    onTrackCount > 0 ? `${onTrackCount} budget ${onTrackCount === 1 ? 'line is' : 'lines are'} comfortably on track.` : '',
    sharedCount > 0 ? `${sharedCount} shared budget ${sharedCount === 1 ? 'line is' : 'lines are'} visible in the same board.` : '',
    celebrationReady ? 'No categories are overspent in this period.' : '',
  ].filter(Boolean);

  const bestBudget = useMemo(
    () => (budgets.length > 0 ? budgets.reduce((best, budget) => budget.healthPercent < best.healthPercent ? budget : best, budgets[0]!) : undefined),
    [budgets],
  );
  const hasExpenseCategories = expenseCategories.length > 0;

  return (
    <div className="grid gap-6">
      <section className={`${uiHeroClass} ${celebrationReady ? 'border-emerald-300/35 from-emerald-500/20 via-[#2a355d]/20 to-[#11213b]/35' : ''}`}>
        <div className="grid gap-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/65">Budget Planner</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">{celebrationReady ? 'You are running a disciplined month.' : 'Shape spending limits before the month shapes them for you.'}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-white/75">Personal and shared budgets stay in one planning board, with pressure signals that surface what needs attention first.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className={uiStatCardClass('base')}><span className="text-xs uppercase tracking-[0.16em] text-white/60">Planned</span><strong className="mt-2 block text-2xl text-white">{formatCurrency(totalBudgeted)}</strong></div>
            <div className={uiStatCardClass('base')}><span className="text-xs uppercase tracking-[0.16em] text-white/60">Spent</span><strong className="mt-2 block text-2xl text-white">{formatCurrency(totalSpent)}</strong></div>
            <div className={uiStatCardClass(controlScore >= 70 ? 'positive' : controlScore >= 45 ? 'neutral' : 'warning')}><span className="text-xs uppercase tracking-[0.16em] text-white/60">Control score</span><strong className={`mt-2 block text-2xl ${controlScore >= 70 ? 'text-emerald-200' : controlScore >= 45 ? 'text-sky-200' : 'text-orange-200'}`}>{controlScore}/100</strong></div>
            <div className={uiStatCardClass(streak > 0 ? 'positive' : 'warning')}><span className="text-xs uppercase tracking-[0.16em] text-white/60">Streak</span><strong className="mt-2 block text-2xl text-white">{streak > 0 ? `${streak} mo` : 'Reset'}</strong></div>
          </div>
          <div className="flex flex-wrap gap-2">
            {smallWins.length > 0 ? smallWins.map((win) => <span className={`${uiChipClass} border-emerald-200/25 bg-emerald-500/20`} key={win}>{win}</span>) : <span className={uiChipClass}>This month needs a tighter budget rhythm.</span>}
          </div>
        </div>
      </section>

      <section className={uiPanelClass}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-[var(--text)]">Budget period</h3>
          <span className="text-sm text-[var(--muted)]">{getBudgetPeriodLabel(Number(month), Number(year))}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:max-w-md">
          <label className="grid gap-1.5 text-sm text-[var(--muted)]">Report month<select className={uiInputClass} value={month} onChange={(event) => setMonth(event.target.value)}>{Array.from({ length: 12 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{new Date(2026, value - 1, 1).toLocaleDateString('en-IN', { month: 'long' })}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm text-[var(--muted)]">Report year<input className={uiInputClass} value={year} onChange={(event) => setYear(event.target.value)} placeholder="2026" /></label>
        </div>
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <span className={uiChipClass}>{budgets.length} categories budgeted</span>
            <span className={uiChipClass}>{sharedCount > 0 ? `${sharedCount} shared budget ${sharedCount === 1 ? 'line' : 'lines'}` : 'Personal budget view ready'}</span>
            {bestBudget && <span className={`${uiChipClass} border-sky-200/25 bg-sky-500/20`}>Best controlled: {bestBudget.categoryName}</span>}
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button className={uiButtonClass('ghost')} disabled={loading} onClick={() => void duplicateLastMonth()}>Duplicate last month</button>
            <button className={uiButtonClass('primary')} disabled={loading} onClick={() => void loadBudgets(month, year)}>{loading ? 'Loading...' : 'Refresh budgets'}</button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className={uiPanelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">{editingId ? 'Edit budget' : 'Create budget'}</h3>
            <span className="text-sm text-[var(--muted)]">Plan by category, account scope, and alert target</span>
          </div>
          <p className="mb-3 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Fields marked * are mandatory</p>
          {!hasExpenseCategories && <p className="field-error mb-3">Create at least one active expense category in Accounts before creating a budget.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Category (required) *<select className={fieldErrors.categoryId ? `${uiInputClass} field-invalid` : uiInputClass} value={form.categoryId} onChange={(event) => { setForm((current) => ({ ...current, categoryId: event.target.value })); setFieldErrors((current) => ({ ...current, categoryId: undefined })); setFormError(''); }}><option value="">{hasExpenseCategories ? 'Choose a category' : 'No active expense categories'}</option>{expenseCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}{editingId && !expenseCategories.some((item) => item.id === form.categoryId) && <option value={form.categoryId}>Current shared category</option>}</select>{fieldErrors.categoryId && <span className="field-error">{fieldErrors.categoryId}</span>}</label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Budget scope (optional)<select className={uiInputClass} value={form.accountId} onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))}><option value="">Personal budget</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Amount (INR, required) *<input className={fieldErrors.amount ? `${uiInputClass} field-invalid` : uiInputClass} value={form.amount} onChange={(event) => { setForm((current) => ({ ...current, amount: event.target.value })); setFieldErrors((current) => ({ ...current, amount: undefined })); setFormError(''); }} placeholder="0.00" />{fieldErrors.amount && <span className="field-error">{fieldErrors.amount}</span>}</label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Budget month (required) *<select className={fieldErrors.month ? `${uiInputClass} field-invalid` : uiInputClass} value={form.month} onChange={(event) => { setForm((current) => ({ ...current, month: event.target.value })); setFieldErrors((current) => ({ ...current, month: undefined })); setFormError(''); }}>{Array.from({ length: 12 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{new Date(2026, value - 1, 1).toLocaleDateString('en-IN', { month: 'long' })}</option>)}</select>{fieldErrors.month && <span className="field-error">{fieldErrors.month}</span>}</label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Budget year (required) *<input className={fieldErrors.year ? `${uiInputClass} field-invalid` : uiInputClass} value={form.year} onChange={(event) => { setForm((current) => ({ ...current, year: event.target.value })); setFieldErrors((current) => ({ ...current, year: undefined })); setFormError(''); }} placeholder="2026" />{fieldErrors.year && <span className="field-error">{fieldErrors.year}</span>}</label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Alert threshold (%, required) *<input className={fieldErrors.alertThresholdPercent ? `${uiInputClass} field-invalid` : uiInputClass} value={form.alertThresholdPercent} onChange={(event) => { setForm((current) => ({ ...current, alertThresholdPercent: event.target.value })); setFieldErrors((current) => ({ ...current, alertThresholdPercent: undefined })); setFormError(''); }} placeholder="80" />{fieldErrors.alertThresholdPercent && <span className="field-error">{fieldErrors.alertThresholdPercent}</span>}</label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={`${uiChipClass} border-sky-200/25 bg-sky-500/20`}>{form.accountId ? 'Shared budget' : 'Personal budget'}</span>
            <span className={uiChipClass}>{getBudgetPeriodLabel(Number(form.month), Number(form.year))}</span>
          </div>
          {formError && <p className="field-error mt-3">{formError}</p>}
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button className={uiButtonClass('ghost')} onClick={resetForm}>Clear form</button>
            <button className={uiButtonClass('primary')} disabled={loading || !hasExpenseCategories} onClick={() => void saveBudget()}>{editingId ? 'Update budget' : 'Save budget'}</button>
          </div>
        </section>

        <section className={uiPanelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">Budget board</h3>
            <span className="text-sm text-[var(--muted)]">{budgets.length} categories budgeted</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {budgets.map((budget) => {
              const remaining = Math.max(0, budget.amount - budget.spent);
              const positiveCue = budget.healthPercent < 60 ? 'Cruising' : budget.healthPercent < 80 ? 'Watch lightly' : getBudgetStatus(budget.healthPercent);

              return (
                <article key={budget.id} className={`rounded-2xl border p-4 ${budgetCardToneClass(budget.healthPercent)}`}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-[var(--text)]">{budget.categoryName}</h4>
                    <span className="text-xs text-white/70">{positiveCue}</span>
                  </div>
                  <strong className="text-xl font-semibold text-[var(--text)]">{formatCurrency(budget.amount)}</strong>
                  <p className="mt-1 text-sm text-[var(--muted)]">{budget.isShared ? `Shared via ${budget.accountName ?? 'account'}` : 'Personal budget line'}</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-gradient-to-r from-[#6fa5ff] to-[#8f65ff]" style={{ width: `${Math.min(100, budget.healthPercent)}%` }} /></div>
                  <div className="mt-3 grid gap-2 text-sm text-[var(--muted)]">
                    <div className="flex items-center justify-between"><span>Spent</span><strong className="text-[var(--text)]">{formatCurrency(budget.spent)}</strong></div>
                    <div className="flex items-center justify-between"><span>Usage</span><strong className="text-[var(--text)]">{budget.healthPercent}% used</strong></div>
                    <div className="flex items-center justify-between"><span>Remaining</span><strong className="text-[var(--text)]">{formatCurrency(remaining)}</strong></div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`${uiChipClass} ${budget.healthPercent < 60 ? 'border-emerald-300/25 bg-emerald-500/20' : budget.healthPercent < 80 ? 'border-sky-300/25 bg-sky-500/20' : 'border-orange-300/25 bg-orange-500/20'}`}>{budget.healthPercent < 60 ? 'Small win' : budget.healthPercent < 80 ? 'Steady' : 'Needs attention'}</span>
                    {budget.isShared && <span className={uiChipClass}>Shared</span>}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    {budget.canEdit ? (
                      <>
                        <button className={uiButtonClass('ghost')} onClick={() => startEdit(budget)}>Edit</button>
                        <button className={uiButtonClass('ghost')} onClick={() => void removeBudget(budget.id)}>Delete</button>
                      </>
                    ) : (
                      <span className={uiChipClass}>View only</span>
                    )}
                  </div>
                </article>
              );
            })}
            {budgets.length === 0 && <p className="text-sm text-[var(--muted)]">No budgets are set for this month yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
