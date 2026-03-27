import { useEffect, useMemo, useRef, useState } from 'react';
import type { AccountDto, CategoryDto, TransactionDto } from '../../services/api';
import { api } from '../../services/api';
import { validateQuickAddDraft } from '../viewModels';

type ParsedQuickAdd = {
  type: string;
  amount: number;
  categoryHint?: string;
  accountHint?: string;
  merchant: string;
  transactionDate: string;
  chips: string[];
};

type QuickAddDraft = ParsedQuickAdd & {
  accountId: string;
  categoryId: string;
  note: string;
  paymentMethod: string;
};

function getSuggestedPrompts(transactions: TransactionDto[]) {
  return transactions.slice(0, 4).map((transaction) => `${transaction.amount} ${transaction.merchant || transaction.categoryName || transaction.type} from ${transaction.accountName}`);
}

function buildDraft(parsed: ParsedQuickAdd, accounts: AccountDto[], categories: CategoryDto[]): QuickAddDraft {
  const account = accounts.find((item) => item.name.toLowerCase().includes((parsed.accountHint ?? '').toLowerCase())) ?? accounts[0];
  const category = categories.find((item) => item.name.toLowerCase() === (parsed.categoryHint ?? '').toLowerCase()) ?? categories.find((item) => item.type === parsed.type) ?? categories[0];
  return {
    ...parsed,
    accountId: account?.id ?? '',
    categoryId: category?.id ?? '',
    note: 'Quick add',
    paymentMethod: 'Quick add',
  };
}

export function QuickAddPalette({
  accounts,
  categories,
  recentTransactions,
  onClose,
  onSaved,
}: {
  accounts: AccountDto[];
  categories: CategoryDto[];
  recentTransactions: TransactionDto[];
  onClose: () => void;
  onSaved: (transaction: TransactionDto) => Promise<void>;
}) {
  const [input, setInput] = useState('spent 420 on groceries with card today');
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<QuickAddDraft | null>(null);
  const [error, setError] = useState('');
  const [chipDraft, setChipDraft] = useState('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const suggestions = useMemo(() => getSuggestedPrompts(recentTransactions), [recentTransactions]);
  const previewCategoryOptions = useMemo(() => categories.filter((item) => !item.isArchived && item.type === (draft?.type === 'Income' ? 'Income' : 'Expense')), [categories, draft?.type]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function parse() {
    setLoading(true);
    setError('');
    try {
      const parsed = await api.quickParse(input);
      setDraft(buildDraft(parsed, accounts, categories));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not understand that entry. Try wording it a little more clearly.');
    } finally {
      setLoading(false);
    }
  }

  function removeChip(chip: string) {
    setDraft((current) => current ? { ...current, chips: current.chips.filter((item) => item !== chip) } : current);
  }

  function addChip() {
    if (!chipDraft.trim()) return;
    setDraft((current) => current ? { ...current, chips: [...current.chips, chipDraft.trim()] } : current);
    setChipDraft('');
  }

  async function save() {
    if (!draft) return;
    const validationError = validateQuickAddDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const transaction = await api.createTransaction({
        accountId: draft.accountId,
        transferAccountId: null,
        categoryId: draft.type === 'Transfer' ? null : draft.categoryId || null,
        type: draft.type,
        amount: Number(draft.amount),
        transactionDate: new Date(draft.transactionDate).toISOString(),
        merchant: draft.merchant,
        note: draft.note,
        paymentMethod: draft.paymentMethod,
        tags: draft.chips,
      });
      await onSaved(transaction);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not save this quick transaction right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="palette-backdrop quick-add-backdrop" onClick={onClose}>
      <div className="palette premium-palette" role="dialog" aria-modal="true" aria-label="Quick add transaction" onClick={(event) => event.stopPropagation()}>
        <div className="section-heading">
          <div>
            <h3>Quick Add</h3>
            <span>Keyboard-first cash capture. Press Esc or click outside to close.</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="pill accent">Ctrl/Cmd + K</span>
            <button className="ghost-button quick-add-close-inline" onClick={onClose} aria-label="Close quick add">Close</button>
          </div>
        </div>
        <textarea ref={inputRef} rows={4} value={input} onChange={(event) => setInput(event.target.value)} placeholder="500 groceries yesterday from HDFC" />
        <div className="pill-list">
          {suggestions.map((suggestion) => (
            <button className="pill quick-add-suggestion" key={suggestion} onClick={() => setInput(suggestion)}>{suggestion}</button>
          ))}
        </div>
        <div className="row-actions">
          <button className="ghost-button" onClick={onClose}>Close (Esc)</button>
          <button className="primary-button" onClick={() => void parse()}>{loading ? 'Parsing...' : 'Parse input'}</button>
        </div>
        {error && <p className="error-text">{error}</p>}
        {draft && (
          <div className="quick-add-preview">
            <div className="quick-add-preview-grid">
              <div className="card-soft-block">
                <div className="section-heading compact-heading"><h3>Live preview</h3><span>{draft.type}</span></div>
                <div className="form-grid expanded-form-grid">
                  <label>Amount<input value={draft.amount} onChange={(event) => setDraft((current) => current ? { ...current, amount: Number(event.target.value) || 0 } : current)} /></label>
                  <label>Type<select value={draft.type} onChange={(event) => setDraft((current) => current ? { ...current, type: event.target.value, categoryId: '' } : current)}><option>Expense</option><option>Income</option><option>Transfer</option></select></label>
                  <label>Merchant<input value={draft.merchant} onChange={(event) => setDraft((current) => current ? { ...current, merchant: event.target.value } : current)} /></label>
                  <label>Date<input type="date" value={draft.transactionDate.slice(0, 10)} onChange={(event) => setDraft((current) => current ? { ...current, transactionDate: event.target.value } : current)} /></label>
                  <label>Account<select value={draft.accountId} onChange={(event) => setDraft((current) => current ? { ...current, accountId: event.target.value } : current)}>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                  {draft.type !== 'Transfer' && (
                    <label>Category<select value={draft.categoryId} onChange={(event) => setDraft((current) => current ? { ...current, categoryId: event.target.value } : current)}>{previewCategoryOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                  )}
                  <label className="full-width-field">Payment method<input value={draft.paymentMethod} onChange={(event) => setDraft((current) => current ? { ...current, paymentMethod: event.target.value } : current)} /></label>
                  <label className="full-width-field">Note<input value={draft.note} onChange={(event) => setDraft((current) => current ? { ...current, note: event.target.value } : current)} /></label>
                </div>
              </div>
              <div className="card-soft-block">
                <div className="section-heading compact-heading"><h3>Editable chips</h3><span>{draft.chips.length} tokens</span></div>
                <div className="pill-list">
                  {draft.chips.map((chip) => <button className="pill accent chip-button" key={chip} onClick={() => removeChip(chip)}>{chip}</button>)}
                </div>
                <div className="inline-form">
                  <input value={chipDraft} onChange={(event) => setChipDraft(event.target.value)} placeholder="Add chip" />
                  <button className="ghost-button" onClick={addChip}>Add</button>
                </div>
                <div className="quick-add-highlight">
                  <strong>Pattern memory</strong>
                  <p className="muted">Recent entries from this workspace are suggested above so the palette gets faster the more you use it.</p>
                </div>
              </div>
            </div>
            <div className="row-actions">
              <button className="ghost-button" onClick={() => setDraft(null)}>Reset preview</button>
              <button className="primary-button quick-add-save-button" disabled={loading} onClick={() => void save()}>{loading ? 'Saving...' : 'Save transaction'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
