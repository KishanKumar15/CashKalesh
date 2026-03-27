import { useEffect, useMemo, useState } from 'react';
import { api, type AccountDto, type CategoryDto, type RuleDto } from '../../../services/api';
import { uiButtonClass, uiChipClass, uiHeroClass, uiInputClass, uiPanelClass } from '../finance/ui';
import {
  createActionForm,
  createConditionForm,
  createEmptyRuleComposer,
  getRuleActionValueLabel,
  mapComposerToRequest,
  mapRuleToComposer,
  ruleActionOptions,
  ruleFieldOptions,
  ruleOperatorOptions,
  type RuleComposerState,
} from './common';

export function RulesStudioPage({
  rules,
  accounts,
  categories,
  pendingDraft,
  onDraftApplied,
  onChanged,
  setError,
  setToast,
}: {
  rules: RuleDto[];
  accounts: AccountDto[];
  categories: CategoryDto[];
  pendingDraft: RuleComposerState | null;
  onDraftApplied: () => void;
  onChanged: () => Promise<void>;
  setError: (value: string) => void;
  setToast: (value: string) => void;
}) {
  const [composer, setComposer] = useState<RuleComposerState>(() => createEmptyRuleComposer());
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(false);
  const activeRules = rules.filter((rule) => rule.isActive).length;
  const inactiveRules = rules.length - activeRules;
  const nextPriority = useMemo(() => String(rules.reduce((max, rule) => Math.max(max, rule.priority), 0) + 1), [rules]);

  useEffect(() => {
    if (!pendingDraft) return;
    setEditingId('');
    setComposer({ ...pendingDraft, priority: pendingDraft.priority || nextPriority });
    onDraftApplied();
  }, [nextPriority, onDraftApplied, pendingDraft]);

  function resetComposer() {
    setEditingId('');
    setComposer({ ...createEmptyRuleComposer(), priority: nextPriority });
  }

  function startEdit(rule: RuleDto) {
    setEditingId(rule.id);
    setComposer(mapRuleToComposer(rule));
  }

  function updateCondition(id: string, key: 'field' | 'operator' | 'value', value: string) {
    setComposer((current) => ({
      ...current,
      conditions: current.conditions.map((condition) => (condition.id === id ? { ...condition, [key]: value } : condition)),
    }));
  }

  function updateAction(id: string, key: 'type' | 'value', value: string) {
    setComposer((current) => ({
      ...current,
      actions: current.actions.map((action) => (action.id === id ? { ...action, [key]: value } : action)),
    }));
  }

  async function saveRule() {
    const payload = mapComposerToRequest(composer);
    if (payload.conditions.length === 0) {
      setError('Add at least one rule condition with a value.');
      return;
    }
    if (payload.actions.length === 0) {
      setError('Add at least one rule action.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (editingId) {
        await api.updateRule(editingId, payload);
        setToast('Automation rule updated.');
      } else {
        await api.createRule(payload);
        setToast('Automation rule created.');
      }
      resetComposer();
      await onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save automation rule.');
    } finally {
      setLoading(false);
    }
  }

  async function removeRule(id: string) {
    setLoading(true);
    setError('');
    try {
      await api.deleteRule(id);
      setToast('Automation rule deleted.');
      if (editingId === id) resetComposer();
      await onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to delete rule.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      <section className={uiHeroClass}>
        <div className="grid gap-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/65">Automation Studio</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">Build automation rules you can tune in minutes.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-white/75">Compose conditions, map actions, and spin up rules from insight signals without backend-only workflows.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-4"><span className="text-xs uppercase tracking-[0.16em] text-white/60">Total rules</span><strong className="mt-2 block text-2xl text-white">{rules.length}</strong></div>
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4"><span className="text-xs uppercase tracking-[0.16em] text-white/60">Enabled</span><strong className="mt-2 block text-2xl text-emerald-100">{activeRules}</strong></div>
            <div className="rounded-2xl border border-orange-300/20 bg-orange-500/10 p-4"><span className="text-xs uppercase tracking-[0.16em] text-white/60">Disabled</span><strong className="mt-2 block text-2xl text-orange-100">{inactiveRules}</strong></div>
            <div className="rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4"><span className="text-xs uppercase tracking-[0.16em] text-white/60">Next priority</span><strong className="mt-2 block text-2xl text-sky-100">{nextPriority}</strong></div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(360px,5fr)_minmax(0,7fr)]">
        <section className={uiPanelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">{editingId ? 'Edit automation rule' : 'Create automation rule'}</h3>
            <span className="text-sm text-[var(--muted)]">{editingId ? 'Update live policy' : 'New rule for tagging, routing, or alerting'}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Priority<input className={uiInputClass} value={composer.priority} onChange={(event) => setComposer((current) => ({ ...current, priority: event.target.value }))} /></label>
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-[var(--muted)]"><input type="checkbox" checked={composer.isActive} onChange={(event) => setComposer((current) => ({ ...current, isActive: event.target.checked }))} />Rule active</label>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-[var(--text)]">Conditions</h4>
              <button className={uiButtonClass('ghost')} onClick={() => setComposer((current) => ({ ...current, conditions: [...current.conditions, createConditionForm()] }))}>Add condition</button>
            </div>
            {composer.conditions.map((condition, index) => (
              <div key={condition.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h5 className="text-sm font-semibold text-[var(--text)]">Condition {index + 1}</h5>
                  {composer.conditions.length > 1 && <button className={uiButtonClass('ghost')} onClick={() => setComposer((current) => ({ ...current, conditions: current.conditions.filter((item) => item.id !== condition.id) }))}>Remove</button>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm text-[var(--muted)]">Field<select className={uiInputClass} value={condition.field} onChange={(event) => updateCondition(condition.id, 'field', event.target.value)}>{ruleFieldOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
                  <label className="grid gap-1.5 text-sm text-[var(--muted)]">Operator<select className={uiInputClass} value={condition.operator} onChange={(event) => updateCondition(condition.id, 'operator', event.target.value)}>{ruleOperatorOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
                  <label className="grid gap-1.5 text-sm text-[var(--muted)] sm:col-span-2">Value<input className={uiInputClass} value={condition.value} onChange={(event) => updateCondition(condition.id, 'value', event.target.value)} placeholder={condition.field === 'amount' ? '1500' : 'Netflix'} /></label>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-[var(--text)]">Actions</h4>
              <button className={uiButtonClass('ghost')} onClick={() => setComposer((current) => ({ ...current, actions: [...current.actions, createActionForm()] }))}>Add action</button>
            </div>
            {composer.actions.map((action, index) => (
              <div key={action.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h5 className="text-sm font-semibold text-[var(--text)]">Action {index + 1}</h5>
                  {composer.actions.length > 1 && <button className={uiButtonClass('ghost')} onClick={() => setComposer((current) => ({ ...current, actions: current.actions.filter((item) => item.id !== action.id) }))}>Remove</button>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm text-[var(--muted)]">Action<select className={uiInputClass} value={action.type} onChange={(event) => updateAction(action.id, 'type', event.target.value)}>{ruleActionOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
                  {action.type === 'SetCategory' ? (
                    <label className="grid gap-1.5 text-sm text-[var(--muted)]">Category<select className={uiInputClass} value={action.value} onChange={(event) => updateAction(action.id, 'value', event.target.value)}><option value="">Choose category</option>{categories.filter((item) => !item.isArchived).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                  ) : action.type === 'SetAccount' ? (
                    <label className="grid gap-1.5 text-sm text-[var(--muted)]">Account<select className={uiInputClass} value={action.value} onChange={(event) => updateAction(action.id, 'value', event.target.value)}><option value="">Choose account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
                  ) : (
                    <label className="grid gap-1.5 text-sm text-[var(--muted)]">{action.type === 'AddTag' ? 'Tag' : 'Value'}<input className={uiInputClass} value={action.value} onChange={(event) => updateAction(action.id, 'value', event.target.value)} placeholder={action.type === 'FlagReview' ? 'Optional note' : 'Rule value'} /></label>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <button className={uiButtonClass('ghost')} onClick={resetComposer}>Reset</button>
            <button className={uiButtonClass('primary')} disabled={loading} onClick={() => void saveRule()}>{editingId ? 'Update rule' : 'Save rule'}</button>
          </div>
        </section>

        <section className={uiPanelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">Live automation policies</h3>
            <span className="text-sm text-[var(--muted)]">{rules.length} rules in workspace</span>
          </div>
          <div className="grid gap-3">
            {rules.map((rule) => (
              <article key={rule.id} className="rounded-2xl border border-white/10 bg-[#0f1930]/85 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-[var(--text)]">Priority {rule.priority}</h4>
                  <span className={uiChipClass}>{rule.isActive ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div className="mb-2">
                  <strong className="text-sm text-[var(--text)]">Conditions</strong>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {rule.conditions.map((condition, index) => <span className={uiChipClass} key={`${rule.id}-condition-${index}`}>{condition.field} {condition.operator} {condition.value}</span>)}
                  </div>
                </div>
                <div>
                  <strong className="text-sm text-[var(--text)]">Actions</strong>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {rule.actions.map((action, index) => <span className={`${uiChipClass} border-sky-300/30 bg-sky-500/20`} key={`${rule.id}-action-${index}`}>{action.type}: {getRuleActionValueLabel(action, accounts, categories)}</span>)}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2.5">
                  <button className={uiButtonClass('ghost')} onClick={() => startEdit(rule)}>Edit</button>
                  <button className={uiButtonClass('ghost')} onClick={() => void removeRule(rule.id)}>Delete</button>
                </div>
              </article>
            ))}
            {rules.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <strong className="text-[var(--text)]">No automation rules yet.</strong>
                <p className="mt-1 text-sm text-[var(--muted)]">Create your first rule to auto-tag merchants, route transactions, or trigger review alerts.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

