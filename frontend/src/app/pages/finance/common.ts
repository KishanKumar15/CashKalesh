import type {
  AccountDto,
  BudgetDto,
  CategoryDto,
  ForecastDailyPoint,
  ForecastMonthResponse,
  RecurringItemDto,
  ReportQueryParams,
  ReportResponse,
  TransactionQueryParams,
  TransactionDto,
} from '../../../services/api';

export type FeedbackHandlers = {
  setError: (value: string) => void;
  setToast: (value: string) => void;
};

export type TransactionsManagerPageProps = FeedbackHandlers & {
  accounts: AccountDto[];
  categories: CategoryDto[];
  transactions: TransactionDto[];
  initialSearch: string;
  onChanged: () => Promise<void>;
};

export type BudgetsManagerPageProps = FeedbackHandlers & {
  accounts: AccountDto[];
  categories: CategoryDto[];
  initialBudgets: BudgetDto[];
  onChanged: () => Promise<void>;
};

export type ReportsManagerPageProps = FeedbackHandlers & {
  reports: ReportResponse;
  forecastDaily: ForecastDailyPoint[];
  forecastMonth: ForecastMonthResponse;
  recurring: RecurringItemDto[];
  accounts: AccountDto[];
  categories: CategoryDto[];
};

export type RecurringManagerPageProps = FeedbackHandlers & {
  items: RecurringItemDto[];
  accounts: AccountDto[];
  categories: CategoryDto[];
  onChanged: () => Promise<void>;
};

export type TransactionFilters = {
  search: string;
  accountId: string;
  categoryId: string;
  type: string;
  from: string;
  to: string;
};

export type TransactionFormState = {
  type: string;
  amount: string;
  accountId: string;
  transferAccountId: string;
  categoryId: string;
  merchant: string;
  note: string;
  paymentMethod: string;
  transactionDate: string;
  tags: string;
};

export type BudgetFormState = {
  categoryId: string;
  accountId: string;
  month: string;
  year: string;
  amount: string;
  alertThresholdPercent: string;
};

export type RecurringFormState = {
  title: string;
  type: string;
  amount: string;
  accountId: string;
  categoryId: string;
  frequency: string;
  startDate: string;
  endDate: string;
  autoCreateTransaction: boolean;
  isPaused: boolean;
};

export type ReportFilters = {
  from: string;
  to: string;
  accountId: string;
  categoryId: string;
  type: string;
};

export function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export function getCurrentMonth() {
  return String(new Date().getMonth() + 1);
}

export function getCurrentYear() {
  return String(new Date().getFullYear());
}

export function getDefaultTransactionForm(accounts: AccountDto[], categories: CategoryDto[]): TransactionFormState {
  const defaultExpenseCategory = categories.find((item) => item.type === 'Expense' && !item.isArchived) ?? categories[0];
  return {
    type: 'Expense',
    amount: '',
    accountId: accounts[0]?.id ?? '',
    transferAccountId: '',
    categoryId: defaultExpenseCategory?.id ?? '',
    merchant: '',
    note: '',
    paymentMethod: 'Card',
    transactionDate: getToday(),
    tags: '',
  };
}

export function getDefaultBudgetForm(categories: CategoryDto[]): BudgetFormState {
  const defaultExpenseCategory = categories.find((item) => item.type === 'Expense' && !item.isArchived) ?? categories[0];
  return {
    categoryId: defaultExpenseCategory?.id ?? '',
    accountId: '',
    month: getCurrentMonth(),
    year: getCurrentYear(),
    amount: '',
    alertThresholdPercent: '80',
  };
}

export function getDefaultRecurringForm(accounts: AccountDto[], categories: CategoryDto[]): RecurringFormState {
  const defaultExpenseCategory = categories.find((item) => item.type === 'Expense' && !item.isArchived) ?? categories[0];
  return {
    title: '',
    type: 'Expense',
    amount: '',
    accountId: accounts[0]?.id ?? '',
    categoryId: defaultExpenseCategory?.id ?? '',
    frequency: 'Monthly',
    startDate: getToday(),
    endDate: '',
    autoCreateTransaction: true,
    isPaused: false,
  };
}

export function getTransactionQuery(filters: TransactionFilters): TransactionQueryParams {
  return {
    search: filters.search || undefined,
    accountId: filters.accountId || undefined,
    categoryId: filters.categoryId || undefined,
    type: filters.type || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    pageSize: 200,
  };
}

export function getReportQuery(filters: ReportFilters): ReportQueryParams {
  return {
    from: filters.from || undefined,
    to: filters.to || undefined,
    accountId: filters.accountId || undefined,
    categoryId: filters.categoryId || undefined,
    type: filters.type || undefined,
  };
}

export function parseTags(tags: string) {
  return tags.split(',').map((item) => item.trim()).filter(Boolean);
}

export function getAvailableCategories(categories: CategoryDto[], type: string) {
  if (type === 'Transfer') return [];
  return categories.filter((item) => !item.isArchived && item.type === (type === 'Income' ? 'Income' : 'Expense'));
}

export function formatCurrency(value: number) {
  return value.toLocaleString('en-IN');
}

export function getTransactionTone(type: string) {
  if (type === 'Income') return 'positive';
  if (type === 'Transfer') return 'neutral';
  return 'warning';
}

export function getBudgetTone(healthPercent: number) {
  if (healthPercent >= 100) return 'danger';
  if (healthPercent >= 80) return 'warning';
  return 'safe';
}

export function getBudgetStatus(healthPercent: number) {
  if (healthPercent >= 100) return 'Overspent';
  if (healthPercent >= 80) return 'At risk';
  return 'On track';
}
