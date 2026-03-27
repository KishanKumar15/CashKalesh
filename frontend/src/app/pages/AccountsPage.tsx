import { useState } from 'react';
import { api, type AccountDto, type AccountMemberDto, type CategoryDto } from '../../services/api';
import type { InviteFormState, RequestEditState } from '../types';
import { validateAccountForm, validateCategoryForm } from '../viewModels';
import { uiButtonClass, uiChipClass, uiHeroClass, uiInputClass, uiPanelClass } from './finance/ui';

type AccountsStudioPageProps = {
  accounts: AccountDto[];
  categories: CategoryDto[];
  accountMembers: Record<string, AccountMemberDto[]>;
  currentUserEmail: string;
  inviteForms: InviteFormState;
  onInviteFormChange: (value: InviteFormState | ((current: InviteFormState) => InviteFormState)) => void;
  onInvite: (accountId: string) => void;
  onRoleChange: (accountId: string, memberUserId: string, role: string) => void;
  requestEditForms: RequestEditState;
  onRequestEditFormChange: (value: RequestEditState | ((current: RequestEditState) => RequestEditState)) => void;
  onRequestEdit: (accountId: string) => void;
  acceptInviteToken: string;
  onAcceptInviteTokenChange: (value: string) => void;
  onAcceptInvitation: () => void;
  onChanged: () => Promise<void>;
  setError: (value: string) => void;
  setToast: (value: string) => void;
};

type AccountFieldKey = 'name' | 'type' | 'openingBalance';
type CategoryFieldKey = 'name' | 'type';

export function AccountsStudioPage({
  accounts,
  categories,
  accountMembers,
  currentUserEmail,
  inviteForms,
  onInviteFormChange,
  onInvite,
  onRoleChange,
  requestEditForms,
  onRequestEditFormChange,
  onRequestEdit,
  acceptInviteToken,
  onAcceptInviteTokenChange,
  onAcceptInvitation,
  onChanged,
  setError,
  setToast,
}: AccountsStudioPageProps) {
  const [accountForm, setAccountForm] = useState({ name: '', type: 'Savings', openingBalance: '', institutionName: '', color: '#2563EB', icon: 'wallet' });
  const [categoryForm, setCategoryForm] = useState({ name: '', type: 'Expense', color: '#F97316', icon: 'tag', isArchived: false });
  const [editingAccountId, setEditingAccountId] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState('');
  const [accountFormError, setAccountFormError] = useState('');
  const [accountFieldErrors, setAccountFieldErrors] = useState<Partial<Record<AccountFieldKey, string>>>({});
  const [categoryFormError, setCategoryFormError] = useState('');
  const [categoryFieldErrors, setCategoryFieldErrors] = useState<Partial<Record<CategoryFieldKey, string>>>({});

  function resetAccountForm() {
    setEditingAccountId('');
    setAccountForm({ name: '', type: 'Savings', openingBalance: '', institutionName: '', color: '#2563EB', icon: 'wallet' });
    setAccountFormError('');
    setAccountFieldErrors({});
  }

  function resetCategoryForm() {
    setEditingCategoryId('');
    setCategoryForm({ name: '', type: 'Expense', color: '#F97316', icon: 'tag', isArchived: false });
    setCategoryFormError('');
    setCategoryFieldErrors({});
  }

  async function saveAccount() {
    const nextFieldErrors: Partial<Record<AccountFieldKey, string>> = {};
    if (accountForm.name.trim().length < 2) nextFieldErrors.name = 'Name is mandatory.';
    if (!accountForm.type) nextFieldErrors.type = 'Type is mandatory.';
    if (!Number.isFinite(Number(accountForm.openingBalance || '0'))) nextFieldErrors.openingBalance = 'Opening balance must be a valid number.';
    if (Object.keys(nextFieldErrors).length > 0) {
      setAccountFieldErrors(nextFieldErrors);
      setAccountFormError('Please complete the mandatory fields below.');
      return;
    }

    setAccountFormError('');
    setAccountFieldErrors({});
    const validationError = validateAccountForm(accountForm);
    if (validationError) {
      setAccountFormError(validationError);
      return;
    }

    try {
      const payload = {
        name: accountForm.name,
        type: accountForm.type,
        openingBalance: Number(accountForm.openingBalance || '0'),
        institutionName: accountForm.institutionName || null,
        color: accountForm.color,
        icon: accountForm.icon,
      };
      if (editingAccountId) {
        await api.updateAccount(editingAccountId, payload);
        setToast('Account updated.');
      } else {
        await api.createAccount(payload);
        setToast('Account created.');
      }
      resetAccountForm();
      await onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not save this account right now. Please review the details and try again.');
    }
  }

  async function saveCategory() {
    const nextFieldErrors: Partial<Record<CategoryFieldKey, string>> = {};
    if (categoryForm.name.trim().length < 2) nextFieldErrors.name = 'Name is mandatory.';
    if (!categoryForm.type) nextFieldErrors.type = 'Type is mandatory.';
    if (Object.keys(nextFieldErrors).length > 0) {
      setCategoryFieldErrors(nextFieldErrors);
      setCategoryFormError('Please complete the mandatory fields below.');
      return;
    }

    setCategoryFormError('');
    setCategoryFieldErrors({});
    const validationError = validateCategoryForm(categoryForm);
    if (validationError) {
      setCategoryFormError(validationError);
      return;
    }

    try {
      const payload = {
        name: categoryForm.name,
        type: categoryForm.type,
        color: categoryForm.color,
        icon: categoryForm.icon,
        isArchived: categoryForm.isArchived,
      };
      if (editingCategoryId) {
        await api.updateCategory(editingCategoryId, payload);
        setToast('Category updated.');
      } else {
        await api.createCategory(payload);
        setToast('Category created.');
      }
      resetCategoryForm();
      await onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not save this category right now. Please review the details and try again.');
    }
  }

  async function toggleCategoryArchive(category: CategoryDto) {
    try {
      await api.updateCategory(category.id, {
        name: category.name,
        type: category.type,
        color: category.color,
        icon: category.icon,
        isArchived: !category.isArchived,
      });
      setToast(category.isArchived ? 'Category restored.' : 'Category archived.');
      await onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not update this category right now. Please try again.');
    }
  }

  const sharedAccounts = accounts.filter((account) => (accountMembers[account.id] ?? []).length > 1).length;

  return (
    <div className="grid gap-6">
      <section className={uiHeroClass}>
        <div className="grid gap-5">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/65">Accounts and Sharing</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">Manage account spaces, categories, and collaborator access in one place.</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-white/75">Create accounts, shape transaction categories, and control owner, editor, and viewer permissions without leaving the workspace.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-4"><span className="text-xs uppercase tracking-[0.16em] text-white/60">Accounts</span><strong className="mt-2 block text-2xl text-white">{accounts.length}</strong></div>
            <div className="rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4"><span className="text-xs uppercase tracking-[0.16em] text-white/60">Categories</span><strong className="mt-2 block text-2xl text-sky-100">{categories.length}</strong></div>
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4"><span className="text-xs uppercase tracking-[0.16em] text-white/60">Shared accounts</span><strong className="mt-2 block text-2xl text-emerald-100">{sharedAccounts}</strong></div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-4"><span className="text-xs uppercase tracking-[0.16em] text-white/60">Archived categories</span><strong className="mt-2 block text-2xl text-white">{categories.filter((category) => category.isArchived).length}</strong></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input className={uiInputClass} value={acceptInviteToken} onChange={(event) => onAcceptInviteTokenChange(event.target.value)} placeholder="Paste invitation token (required)" />
            <button className={uiButtonClass('primary')} onClick={onAcceptInvitation}>Accept invite</button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className={uiPanelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">{editingAccountId ? 'Edit account' : 'Create account'}</h3>
            <span className="text-sm text-[var(--muted)]">Bank, savings, card, or wallet</span>
          </div>
          <p className="mb-3 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Fields marked * are mandatory</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Account name *<input className={accountFieldErrors.name ? `${uiInputClass} field-invalid` : uiInputClass} value={accountForm.name} onChange={(event) => { setAccountForm((current) => ({ ...current, name: event.target.value })); setAccountFieldErrors((current) => ({ ...current, name: undefined })); setAccountFormError(''); }} placeholder="Example: Salary Account" />{accountFieldErrors.name && <span className="field-error">{accountFieldErrors.name}</span>}</label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Type *<select className={accountFieldErrors.type ? `${uiInputClass} field-invalid` : uiInputClass} value={accountForm.type} onChange={(event) => { setAccountForm((current) => ({ ...current, type: event.target.value })); setAccountFieldErrors((current) => ({ ...current, type: undefined })); setAccountFormError(''); }}><option value="Bank">Bank</option><option value="Savings">Savings</option><option value="CreditCard">Credit card</option><option value="CashWallet">Cash wallet</option></select>{accountFieldErrors.type && <span className="field-error">{accountFieldErrors.type}</span>}</label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Opening balance (INR) *<input className={accountFieldErrors.openingBalance ? `${uiInputClass} field-invalid` : uiInputClass} value={accountForm.openingBalance} onChange={(event) => { setAccountForm((current) => ({ ...current, openingBalance: event.target.value })); setAccountFieldErrors((current) => ({ ...current, openingBalance: undefined })); setAccountFormError(''); }} placeholder="0.00" />{accountFieldErrors.openingBalance && <span className="field-error">{accountFieldErrors.openingBalance}</span>}</label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Institution (optional)<input className={uiInputClass} value={accountForm.institutionName} onChange={(event) => setAccountForm((current) => ({ ...current, institutionName: event.target.value }))} placeholder="Example: HDFC Bank" /></label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Theme color (optional)<input className={uiInputClass} value={accountForm.color} onChange={(event) => setAccountForm((current) => ({ ...current, color: event.target.value }))} placeholder="#2563EB" /></label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Icon name (optional)<input className={uiInputClass} value={accountForm.icon} onChange={(event) => setAccountForm((current) => ({ ...current, icon: event.target.value }))} placeholder="wallet" /></label>
          </div>
          {accountFormError && <p className="field-error mt-3">{accountFormError}</p>}
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button className={uiButtonClass('ghost')} onClick={resetAccountForm}>Clear form</button>
            <button className={uiButtonClass('primary')} onClick={() => void saveAccount()}>{editingAccountId ? 'Update account' : 'Save account'}</button>
          </div>
        </section>

        <section className={uiPanelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">{editingCategoryId ? 'Edit category' : 'Create category'}</h3>
            <span className="text-sm text-[var(--muted)]">Shape transaction labeling</span>
          </div>
          <p className="mb-3 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Fields marked * are mandatory</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Category name *<input className={categoryFieldErrors.name ? `${uiInputClass} field-invalid` : uiInputClass} value={categoryForm.name} onChange={(event) => { setCategoryForm((current) => ({ ...current, name: event.target.value })); setCategoryFieldErrors((current) => ({ ...current, name: undefined })); setCategoryFormError(''); }} placeholder="Example: Groceries" />{categoryFieldErrors.name && <span className="field-error">{categoryFieldErrors.name}</span>}</label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Type *<select className={categoryFieldErrors.type ? `${uiInputClass} field-invalid` : uiInputClass} value={categoryForm.type} onChange={(event) => { setCategoryForm((current) => ({ ...current, type: event.target.value })); setCategoryFieldErrors((current) => ({ ...current, type: undefined })); setCategoryFormError(''); }}><option value="Expense">Expense</option><option value="Income">Income</option></select>{categoryFieldErrors.type && <span className="field-error">{categoryFieldErrors.type}</span>}</label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Theme color (optional)<input className={uiInputClass} value={categoryForm.color} onChange={(event) => setCategoryForm((current) => ({ ...current, color: event.target.value }))} placeholder="#F97316" /></label>
            <label className="grid gap-1.5 text-sm text-[var(--muted)]">Icon name (optional)<input className={uiInputClass} value={categoryForm.icon} onChange={(event) => setCategoryForm((current) => ({ ...current, icon: event.target.value }))} placeholder="tag" /></label>
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-[var(--muted)] sm:col-span-2"><input type="checkbox" checked={categoryForm.isArchived} onChange={(event) => setCategoryForm((current) => ({ ...current, isArchived: event.target.checked }))} />Create as archived</label>
          </div>
          {categoryFormError && <p className="field-error mt-3">{categoryFormError}</p>}
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button className={uiButtonClass('ghost')} onClick={resetCategoryForm}>Clear form</button>
            <button className={uiButtonClass('primary')} onClick={() => void saveCategory()}>{editingCategoryId ? 'Update category' : 'Save category'}</button>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className={uiPanelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">Accounts</h3>
            <span className="text-sm text-[var(--muted)]">{accounts.length} spaces available</span>
          </div>
          <div className="grid gap-3">
            {accounts.map((account) => (
              <article key={account.id} className="rounded-2xl border border-white/10 bg-[#0f1930]/85 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-[var(--text)]">{account.name}</h4>
                  <span className="text-xs text-[var(--muted)]">{account.type}</span>
                </div>
                <p className="text-sm text-[var(--muted)]">{account.institutionName ?? 'Personal account'}</p>
                <strong className="mt-2 block text-xl text-[var(--text)]">{account.currentBalance.toLocaleString('en-IN')}</strong>
                <div className="mt-3">
                  <button
                    className={uiButtonClass('ghost')}
                    onClick={() => {
                      setEditingAccountId(account.id);
                      setAccountFormError('');
                      setAccountFieldErrors({});
                      setAccountForm({
                        name: account.name,
                        type: account.type,
                        openingBalance: String(account.openingBalance),
                        institutionName: account.institutionName ?? '',
                        color: account.color,
                        icon: account.icon,
                      });
                    }}
                  >
                    Edit
                  </button>
                </div>
              </article>
            ))}
            {accounts.length === 0 && <p className="text-sm text-[var(--muted)]">No accounts yet. Create one to start tracking balances.</p>}
          </div>
        </section>

        <section className={uiPanelClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text)]">Categories</h3>
            <span className="text-sm text-[var(--muted)]">{categories.length} labels</span>
          </div>
          <div className="grid gap-3">
            {categories.map((category) => (
              <article key={category.id} className="rounded-2xl border border-white/10 bg-[#0f1930]/85 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-[var(--text)]">{category.name}</h4>
                  <span className="text-xs text-[var(--muted)]">{category.type}</span>
                </div>
                <p className="text-sm text-[var(--muted)]">{category.icon} | {category.color}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={uiChipClass}>{category.isArchived ? 'Archived' : 'Active'}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2.5">
                  <button
                    className={uiButtonClass('ghost')}
                    onClick={() => {
                      setEditingCategoryId(category.id);
                      setCategoryFormError('');
                      setCategoryFieldErrors({});
                      setCategoryForm({
                        name: category.name,
                        type: category.type,
                        color: category.color,
                        icon: category.icon,
                        isArchived: category.isArchived,
                      });
                    }}
                  >
                    Edit
                  </button>
                  <button className={uiButtonClass('ghost')} onClick={() => void toggleCategoryArchive(category)}>{category.isArchived ? 'Restore' : 'Archive'}</button>
                </div>
              </article>
            ))}
            {categories.length === 0 && <p className="text-sm text-[var(--muted)]">No categories yet. Create categories to organize transactions.</p>}
          </div>
        </section>
      </div>

      <section className={uiPanelClass}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-[var(--text)]">Shared account access</h3>
          <span className="text-sm text-[var(--muted)]">Owner, editor, and viewer workflows</span>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {accounts.map((account) => {
            const members = accountMembers[account.id] ?? [];
            const currentRole = members.find((member) => member.email.toLowerCase() === currentUserEmail.toLowerCase())?.role ?? 'Viewer';
            const invite = inviteForms[account.id] ?? { email: '', role: 'Viewer' };
            const requestMessage = requestEditForms[account.id] ?? '';

            return (
              <article key={account.id} className="rounded-2xl border bg-white/[0.03] p-4" style={{ borderColor: account.color }}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-[var(--text)]">{account.name}</h4>
                  <span className={uiChipClass}>{currentRole}</span>
                </div>

                <div className="grid gap-2">
                  {members.map((member) => (
                    <div key={`${account.id}-${member.userId}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="grid gap-1 text-sm">
                        <strong className="text-[var(--text)]">{member.displayName}</strong>
                        <span className="text-[var(--muted)]">{member.email}</span>
                        <span className="text-[var(--muted)]">{member.permissions}</span>
                      </div>
                      <div className="mt-2">
                        {currentRole === 'Owner' && member.role !== 'Owner' ? (
                          <select className={uiInputClass} value={member.role} onChange={(event) => onRoleChange(account.id, member.userId, event.target.value)}>
                            <option value="Viewer">Viewer</option>
                            <option value="Editor">Editor</option>
                          </select>
                        ) : (
                          <span className={uiChipClass}>{member.role}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {currentRole === 'Owner' && (
                  <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <h5 className="text-sm font-semibold text-[var(--text)]">Invite collaborator</h5>
                    <p className="mt-1 text-xs text-[var(--muted)]">Send an email invite and choose access level.</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_auto]">
                      <input className={uiInputClass} value={invite.email} onChange={(event) => onInviteFormChange((current) => ({ ...current, [account.id]: { ...invite, email: event.target.value } }))} placeholder="name@example.com" />
                      <select className={uiInputClass} value={invite.role} onChange={(event) => onInviteFormChange((current) => ({ ...current, [account.id]: { ...invite, role: event.target.value } }))}><option value="Viewer">Viewer</option><option value="Editor">Editor</option></select>
                      <button className={uiButtonClass('primary')} onClick={() => onInvite(account.id)}>Send invite</button>
                    </div>
                  </div>
                )}

                {currentRole === 'Viewer' && (
                  <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <h5 className="text-sm font-semibold text-[var(--text)]">Request editor access</h5>
                    <textarea className={`${uiInputClass} mt-2 min-h-20`} rows={3} value={requestMessage} onChange={(event) => onRequestEditFormChange((current) => ({ ...current, [account.id]: event.target.value }))} />
                    <div className="mt-2 flex flex-wrap gap-2.5">
                      <button className={uiButtonClass('ghost')} onClick={() => onRequestEditFormChange((current) => ({ ...current, [account.id]: 'Please upgrade my access to editor so I can help manage this account.' }))}>Reset message</button>
                      <button className={uiButtonClass('primary')} onClick={() => onRequestEdit(account.id)}>Request access</button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
