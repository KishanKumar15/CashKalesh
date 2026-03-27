import type { AuthMode } from './types';

export type QueryParams = Record<string, string | number | boolean | null | undefined>;
export type TimelineItem = { id: string; transactionDate: string };
export type AuthValidationInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
  resetToken: string;
};

type TransactionValidationInput = {
  type: string;
  amount: string;
  accountId: string;
  transferAccountId: string;
  categoryId: string;
  transactionDate: string;
};

type BudgetValidationInput = {
  categoryId: string;
  month: string;
  year: string;
  amount: string;
  alertThresholdPercent: string;
};

type GoalValidationInput = {
  name: string;
  targetAmount: string;
  targetDate: string;
};

type RecurringValidationInput = {
  title: string;
  amount: string;
  accountId: string;
  categoryId: string;
  type: string;
  startDate: string;
  endDate: string;
};

type AccountValidationInput = {
  name: string;
  type: string;
  openingBalance: string;
};

type CategoryValidationInput = {
  name: string;
  type: string;
};

type QuickAddValidationInput = {
  type: string;
  amount: number;
  accountId: string;
  categoryId: string;
  transactionDate: string;
  merchant: string;
};

function isValidDateInput(value: string) {
  return Boolean(value) && !Number.isNaN(new Date(value).getTime());
}

function parseNumericInput(value: string) {
  return Number(value);
}

export function getAuthHelperText(mode: AuthMode) {
  if (mode === 'forgotPassword') return 'Enter your account email and we will send a reset link.';
  if (mode === 'resetPassword') return 'Choose a new password with at least 8 characters, including upper, lower, and numeric characters.';
  if (mode === 'signup') return 'Your first workspace starts with INR and en-IN defaults so you can begin right away.';
  return '';
}

export function getAuthSubmitText(mode: AuthMode) {
  if (mode === 'signup') return 'Create account';
  if (mode === 'forgotPassword') return 'Send reset link';
  if (mode === 'resetPassword') return 'Save new password';
  return 'Sign in';
}

export function getGoalProgressPercent(currentAmount: number, targetAmount: number) {
  if (targetAmount <= 0) return 0;
  return Math.min(100, (currentAmount / targetAmount) * 100);
}

export function buildQueryString(params: QueryParams) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export function hasActiveTransactionFilters(filters: { search?: string; accountId?: string; categoryId?: string; type?: string; from?: string; to?: string }) {
  return Boolean(filters.search || filters.accountId || filters.categoryId || filters.type || filters.from || filters.to);
}

export function getBudgetPeriodLabel(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function validateAuthForm(mode: AuthMode, form: AuthValidationInput) {
  const email = form.email.trim();
  if ((mode === 'login' || mode === 'signup' || mode === 'forgotPassword') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Please enter a valid email address.';
  }

  if (mode === 'signup' && form.firstName.trim().length < 2) {
    return 'Please enter your first name.';
  }

  if (mode === 'signup' && form.lastName.trim().length < 2) {
    return 'Please enter your last name.';
  }

  if ((mode === 'login' || mode === 'signup' || mode === 'resetPassword') && form.password.length < 8) {
    return 'Please enter a password with at least 8 characters.';
  }

  if ((mode === 'signup' || mode === 'resetPassword') && (!/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/\d/.test(form.password))) {
    return 'Use at least one uppercase letter, one lowercase letter, and one number in your password.';
  }

  if (mode === 'signup' && !form.termsAccepted) {
    return 'Please agree to the Terms and Conditions to continue.';
  }

  if (mode === 'resetPassword' && form.resetToken.trim().length < 6) {
    return 'This reset link looks incomplete. Please open the link from your email again.';
  }

  if (mode === 'resetPassword' && form.confirmPassword.length < 8) {
    return 'Please confirm your new password.';
  }

  if (mode === 'resetPassword' && form.password !== form.confirmPassword) {
    return 'Your new password and confirmation do not match yet.';
  }

  return '';
}

export function validateTransactionForm(form: TransactionValidationInput) {
  const amount = parseNumericInput(form.amount);
  if (!form.accountId) return 'Please choose the account for this transaction.';
  if (!Number.isFinite(amount) || amount <= 0) return 'Please enter an amount greater than 0.';
  if (!isValidDateInput(form.transactionDate)) return 'Please choose a valid transaction date.';
  if (form.type === 'Transfer') {
    if (!form.transferAccountId) return 'Please choose where this transfer is going.';
    if (form.transferAccountId === form.accountId) return 'Choose a different destination account for the transfer.';
    return '';
  }
  if (!form.categoryId) return 'Please choose a category for this transaction.';
  return '';
}

export function validateSplitRows(rows: Array<{ categoryId: string; amount: string }>, originalAmount: number) {
  if (rows.length < 2) return 'Please add at least two split lines.';
  for (const row of rows) {
    if (!row.categoryId) return 'Please choose a category for each split line.';
    const amount = parseNumericInput(row.amount);
    if (!Number.isFinite(amount) || amount <= 0) return 'Each split line needs an amount greater than 0.';
  }
  const total = rows.reduce((sum, row) => sum + parseNumericInput(row.amount || '0'), 0);
  if (Math.abs(total - originalAmount) > 0.01) return 'Split amounts must add up to the original transaction total.';
  return '';
}

export function validateBudgetForm(form: BudgetValidationInput) {
  const amount = parseNumericInput(form.amount);
  const month = parseNumericInput(form.month);
  const year = parseNumericInput(form.year);
  const threshold = parseNumericInput(form.alertThresholdPercent);
  if (!form.categoryId) return 'Please choose a category for this budget.';
  if (!Number.isFinite(amount) || amount <= 0) return 'Please enter a budget amount greater than 0.';
  if (!Number.isFinite(month) || month < 1 || month > 12) return 'Please choose a valid month.';
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return 'Please enter a valid year.';
  if (!Number.isFinite(threshold) || threshold < 1 || threshold > 100) return 'Please enter an alert threshold between 1 and 100.';
  return '';
}

export function validateGoalForm(form: GoalValidationInput) {
  const targetAmount = parseNumericInput(form.targetAmount);
  if (form.name.trim().length < 2) return 'Please enter a clear name for this goal.';
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) return 'Please enter a target amount greater than 0.';
  if (form.targetDate && !isValidDateInput(form.targetDate)) return 'Please choose a valid target date.';
  return '';
}

export function validateGoalEntryAmount(value: string) {
  const amount = parseNumericInput(value);
  if (!Number.isFinite(amount) || amount <= 0) return 'Please enter an amount greater than 0 before updating this goal.';
  return '';
}

export function validateRecurringForm(form: RecurringValidationInput) {
  const amount = parseNumericInput(form.amount);
  if (form.title.trim().length < 2) return 'Please enter a clear name for this recurring item.';
  if (!Number.isFinite(amount) || amount <= 0) return 'Please enter an amount greater than 0.';
  if (!form.accountId) return 'Please choose which account this recurring item belongs to.';
  if (form.type !== 'Transfer' && !form.categoryId) return 'Please choose a category for this recurring item.';
  if (!isValidDateInput(form.startDate)) return 'Please choose a valid start date.';
  if (form.endDate && !isValidDateInput(form.endDate)) return 'Please choose a valid end date.';
  if (form.endDate && new Date(form.endDate).getTime() < new Date(form.startDate).getTime()) return 'End date must be after the start date.';
  return '';
}

export function validateAccountForm(form: AccountValidationInput) {
  const openingBalance = parseNumericInput(form.openingBalance || '0');
  if (form.name.trim().length < 2) return 'Please enter a clear account name.';
  if (!form.type) return 'Please choose the type of account.';
  if (!Number.isFinite(openingBalance)) return 'Please enter a valid opening balance.';
  return '';
}

export function validateCategoryForm(form: CategoryValidationInput) {
  if (form.name.trim().length < 2) return 'Please enter a clear category name.';
  if (!form.type) return 'Please choose whether this category is for income or expense.';
  return '';
}

export function validateInvitationEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Please enter a valid email address before sending the invitation.';
  return '';
}

export function validateInvitationToken(token: string) {
  if (token.trim().length < 6) return 'Please paste the invitation token you received.';
  return '';
}

export function validateEditRequestMessage(message: string) {
  if (message.trim().length < 8) return 'Please add a short message so the account owner understands your request.';
  return '';
}

export function validateQuickAddDraft(draft: QuickAddValidationInput) {
  if (!Number.isFinite(draft.amount) || draft.amount <= 0) return 'Please enter an amount greater than 0 before saving.';
  if (!draft.accountId) return 'Please choose the account for this transaction.';
  if (!isValidDateInput(draft.transactionDate)) return 'Please choose a valid transaction date.';
  if (draft.type !== 'Transfer' && !draft.categoryId) return 'Please choose a category before saving.';
  if (draft.merchant.trim().length < 2) return 'Please add a short merchant or label so you can recognize this transaction later.';
  return '';
}

export function readPrefixedFilters<T extends Record<string, string>>(prefix: string, template: T) {
  const searchParams = new URLSearchParams(window.location.search);
  return Object.keys(template).reduce((accumulator, key) => {
    accumulator[key as keyof T] = (searchParams.get(`${prefix}${key}`) ?? template[key as keyof T]) as T[keyof T];
    return accumulator;
  }, { ...template });
}

export function writePrefixedFilters(prefix: string, filters: Record<string, string>) {
  const url = new URL(window.location.href);
  Object.entries(filters).forEach(([key, value]) => {
    const paramKey = `${prefix}${key}`;
    if (value) {
      url.searchParams.set(paramKey, value);
    } else {
      url.searchParams.delete(paramKey);
    }
  });
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

export function groupTimelineItemsByDay<T extends TimelineItem>(items: T[]) {
  const formatter = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  return items.reduce<Array<{ label: string; items: T[] }>>((groups, item) => {
    const label = formatter.format(new Date(item.transactionDate));
    const currentGroup = groups[groups.length - 1];
    if (!currentGroup || currentGroup.label !== label) {
      groups.push({ label, items: [item] });
      return groups;
    }
    currentGroup.items.push(item);
    return groups;
  }, []);
}

export function summarizeSeries(data: Array<{ label?: string; date?: string; income?: number; expense?: number; balance?: number; projectedBalance?: number }>, context: string) {
  if (data.length === 0) return `No ${context.toLowerCase()} data is available for this view.`;
  const first = data[0];
  const last = data[data.length - 1];
  const start = first.label ?? first.date ?? 'the start';
  const end = last.label ?? last.date ?? 'the latest point';
  const firstValue = first.balance ?? first.projectedBalance ?? ((first.income ?? 0) - (first.expense ?? 0));
  const lastValue = last.balance ?? last.projectedBalance ?? ((last.income ?? 0) - (last.expense ?? 0));
  const direction = lastValue > firstValue ? 'rose' : lastValue < firstValue ? 'fell' : 'stayed flat';
  return `${context} ${direction} from ${start} to ${end}, ending at ${lastValue.toLocaleString('en-IN')}.`;
}
