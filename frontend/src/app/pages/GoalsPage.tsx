import { format } from 'date-fns';
import { useState } from 'react';
import { api, type AccountDto, type GoalDto } from '../../services/api';
import { getGoalProgressPercent, validateGoalEntryAmount, validateGoalForm } from '../viewModels';
import { uiButtonClass, uiChipClass, uiEntityCardClass, uiHeroClass, uiInputClass, uiPanelClass, uiStatCardClass } from './finance/ui';

type GoalsStudioPageProps = {
  goals: GoalDto[];
  accounts: AccountDto[];
  onChanged: () => Promise<void>;
  setError: (value: string) => void;
  setToast: (value: string) => void;
};

type GoalFieldKey = 'name' | 'targetAmount';

export function GoalsStudioPage({ goals, accounts, onChanged, setError, setToast }: GoalsStudioPageProps) {
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState({ name: '', targetAmount: '', targetDate: '', linkedAccountId: '', icon: 'target', color: '#0EA5E9' });
  const [entryAmounts, setEntryAmounts] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<GoalFieldKey, string>>>({});
  const [entryErrors, setEntryErrors] = useState<Record<string, string>>({});

  function resetForm() {
    setEditingId('');
    setForm({ name: '', targetAmount: '', targetDate: '', linkedAccountId: '', icon: 'target', color: '#0EA5E9' });
    setFormError('');
    setFieldErrors({});
  }

  function startEdit(goal: GoalDto) {
    setEditingId(goal.id);
    setFormError('');
    setFieldErrors({});
    setForm({
      name: goal.name,
      targetAmount: String(goal.targetAmount),
      targetDate: goal.targetDate?.slice(0, 10) ?? '',
      linkedAccountId: goal.linkedAccountId ?? '',
      icon: goal.icon,
      color: goal.color,
    });
  }

  async function saveGoal() {
    const nextFieldErrors: Partial<Record<GoalFieldKey, string>> = {};
    if (form.name.trim().length < 2) nextFieldErrors.name = 'Goal name is mandatory.';
    if (!Number.isFinite(Number(form.targetAmount)) || Number(form.targetAmount) <= 0) nextFieldErrors.targetAmount = 'Target amount must be greater than 0.';
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setFormError('Please complete the mandatory fields below.');
      return;
    }

    setFormError('');
    setFieldErrors({});
    const validationError = validateGoalForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      const payload = {
        name: form.name,
        targetAmount: Number(form.targetAmount),
        targetDate: form.targetDate ? new Date(form.targetDate).toISOString() : null,
        linkedAccountId: form.linkedAccountId || null,
        icon: form.icon,
        color: form.color,
      };
      if (editingId) {
        await api.updateGoal(editingId, payload);
        setToast('Goal updated.');
      } else {
        await api.createGoal(payload);
        setToast('Goal created.');
      }
      resetForm();
      await onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not save this goal right now. Please review the details and try again.');
    }
  }

  async function submitEntry(goal: GoalDto, type: 'Contribution' | 'Withdrawal') {
    const validationError = validateGoalEntryAmount(entryAmounts[goal.id] ?? '');
    if (validationError) {
      setEntryErrors((current) => ({ ...current, [goal.id]: validationError }));
      return;
    }

    setEntryErrors((current) => ({ ...current, [goal.id]: '' }));
    const amount = Number(entryAmounts[goal.id] ?? '0');
    try {
      await api.addGoalEntry(goal.id, {
        accountId: goal.linkedAccountId ?? null,
        type,
        amount,
        note: type === 'Contribution' ? 'Contribution added from goal studio.' : 'Withdrawal recorded from goal studio.',
      });
      setEntryAmounts((current) => ({ ...current, [goal.id]: '' }));
      setToast(type === 'Contribution' ? 'Contribution added.' : 'Withdrawal recorded.');
      await onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not update this goal right now. Please try again.');
    }
  }

  async function completeGoal(goal: GoalDto) {
    try {
      await api.completeGoal(goal.id);
      setToast('Goal marked complete.');
      await onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not mark this goal as complete right now. Please try again.');
    }
  }

  const activeGoals = goals.filter((goal) => goal.status !== 'Completed').length;
  const sharedGoals = goals.filter((goal) => goal.isShared).length;
  const completedGoals = goals.filter((goal) => goal.status === 'Completed').length;
  const participantCount = goals.reduce((count, goal) => count + goal.participants.length, 0);

  return (
    <div className="grid gap-6">
      <section className={uiHeroClass}>
        <div className="grid gap-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/65">Goals Studio</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">Make progress visible for yourself and everyone sharing it.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-white/75">Shared goals work well for a home fund, emergency buffer, or travel plan. Link a goal to shared accounts and keep everyone aligned.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className={uiStatCardClass('base')}><span className="text-xs uppercase tracking-[0.16em] text-white/60">Active goals</span><strong className="mt-2 block text-2xl text-white">{activeGoals}</strong></div>
            <div className={uiStatCardClass('positive')}><span className="text-xs uppercase tracking-[0.16em] text-white/60">Shared goals</span><strong className="mt-2 block text-2xl text-emerald-100">{sharedGoals}</strong></div>
            <div className={uiStatCardClass('neutral')}><span className="text-xs uppercase tracking-[0.16em] text-white/60">Completed</span><strong className="mt-2 block text-2xl text-sky-100">{completedGoals}</strong></div>
            <div className={uiStatCardClass('base')}><span className="text-xs uppercase tracking-[0.16em] text-white/60">Participants</span><strong className="mt-2 block text-2xl text-white">{participantCount}</strong></div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className={uiPanelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">{editingId ? 'Edit goal' : 'Create goal'}</h3>
            <span className="text-sm text-[var(--muted)]">Track a personal or shared target</span>
          </div>
          <p className="mb-3 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Fields marked * are mandatory</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm text-[var(--muted)] sm:col-span-2">Goal name (required) *<input className={fieldErrors.name ? `${uiInputClass} field-invalid` : uiInputClass} value={form.name} onChange={(event) => { setForm((current) => ({ ...current, name: event.target.value })); setFieldErrors((current) => ({ ...current, name: undefined })); setFormError(''); }} placeholder="Example: Emergency Fund" />{fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}</label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Target amount (INR, required) *<input className={fieldErrors.targetAmount ? `${uiInputClass} field-invalid` : uiInputClass} value={form.targetAmount} onChange={(event) => { setForm((current) => ({ ...current, targetAmount: event.target.value })); setFieldErrors((current) => ({ ...current, targetAmount: undefined })); setFormError(''); }} placeholder="500000" />{fieldErrors.targetAmount && <span className="field-error">{fieldErrors.targetAmount}</span>}</label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Target date (optional)<input className={uiInputClass} type="date" value={form.targetDate} onChange={(event) => setForm((current) => ({ ...current, targetDate: event.target.value }))} /></label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Linked account (optional)<select className={uiInputClass} value={form.linkedAccountId} onChange={(event) => setForm((current) => ({ ...current, linkedAccountId: event.target.value }))}><option value="">Personal goal</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Accent color (optional)<input className={uiInputClass} value={form.color} onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))} placeholder="#0EA5E9" /></label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)] sm:col-span-2">Icon label (optional)<input className={uiInputClass} value={form.icon} onChange={(event) => setForm((current) => ({ ...current, icon: event.target.value }))} placeholder="target" /></label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={uiChipClass}>{form.linkedAccountId ? 'Shared goal' : 'Personal goal'}</span>
            <span className={uiChipClass}>Accent {form.color}</span>
          </div>
          {formError && <p className="field-error mt-3">{formError}</p>}
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button className={uiButtonClass('ghost')} onClick={resetForm}>Clear form</button>
            <button className={uiButtonClass('primary')} onClick={() => void saveGoal()}>{editingId ? 'Update goal' : 'Save goal'}</button>
          </div>
        </section>

        <section className={uiPanelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">Goal board</h3>
            <span className="text-sm text-[var(--muted)]">{goals.length} goal cards</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {goals.map((goal) => {
              const progress = getGoalProgressPercent(goal.currentAmount, goal.targetAmount);
              return (
                <article key={goal.id} className={uiEntityCardClass} style={{ borderColor: goal.color }}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-[var(--text)]">{goal.name}</h4>
                    <span className="text-xs text-[var(--muted)]">{goal.status}</span>
                  </div>
                  <p className="text-sm text-[var(--muted)]">{goal.isShared ? `Shared via ${goal.linkedAccountName ?? 'account'}` : 'Personal goal'}</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <span className="block h-full rounded-full" style={{ width: `${progress}%`, background: goal.color }} />
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-[var(--muted)]">
                    <div className="flex items-center justify-between"><strong className="text-[var(--text)]">Saved</strong><span>{goal.currentAmount.toLocaleString()}</span></div>
                    <div className="flex items-center justify-between"><strong className="text-[var(--text)]">Target</strong><span>{goal.targetAmount.toLocaleString()}</span></div>
                    <div className="flex items-center justify-between"><strong className="text-[var(--text)]">Due</strong><span>{goal.targetDate ? format(new Date(goal.targetDate), 'dd MMM yyyy') : 'Open ended'}</span></div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {goal.participants.map((participant) => <span className={uiChipClass} key={`${goal.id}-${participant.userId}`}>{participant.displayName} | {participant.role}</span>)}
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <div className="grid gap-1">
                      <input className={entryErrors[goal.id] ? `${uiInputClass} field-invalid` : uiInputClass} value={entryAmounts[goal.id] ?? ''} onChange={(event) => { setEntryAmounts((current) => ({ ...current, [goal.id]: event.target.value })); setEntryErrors((current) => ({ ...current, [goal.id]: '' })); }} placeholder="Amount (INR)" />
                      {entryErrors[goal.id] && <span className="field-error">{entryErrors[goal.id]}</span>}
                    </div>
                    <button className={uiButtonClass('ghost')} onClick={() => void submitEntry(goal, 'Contribution')}>Add money</button>
                    <button className={uiButtonClass('ghost')} onClick={() => void submitEntry(goal, 'Withdrawal')}>Withdraw money</button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2.5">
                    <button className={uiButtonClass('ghost')} onClick={() => startEdit(goal)}>Edit</button>
                    {goal.status !== 'Completed' && <button className={uiButtonClass('primary')} onClick={() => void completeGoal(goal)}>Mark complete</button>}
                  </div>
                </article>
              );
            })}
            {goals.length === 0 && <p className="text-sm text-[var(--muted)]">No goals yet. Create one to start tracking progress.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
