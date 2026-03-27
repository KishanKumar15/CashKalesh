import type {
  AccountDto,
  AccountMemberDto,
  AppBrandingResponse,
  CategoryDto,
  DashboardResponse,
  ForecastDailyPoint,
  GoalDto,
  InsightCardDto,
  NotificationDto,
  RecurringItemDto,
  ReportResponse,
  RuleDto,
  TransactionDto,
} from '../services/api';

export type Section =
  | 'dashboard'
  | 'transactions'
  | 'budgets'
  | 'goals'
  | 'reports'
  | 'recurring'
  | 'accounts'
  | 'notifications'
  | 'insights'
  | 'rules'
  | 'settings';

export type AppBundle = {
  branding: AppBrandingResponse;
  dashboard: DashboardResponse;
  accounts: AccountDto[];
  accountMembers: Record<string, AccountMemberDto[]>;
  categories: CategoryDto[];
  transactions: TransactionDto[];
  goals: GoalDto[];
  recurring: RecurringItemDto[];
  notifications: NotificationDto[];
  reports: ReportResponse;
  forecastDaily: ForecastDailyPoint[];
  insights: InsightCardDto[];
  rules: RuleDto[];
};

export type TransactionForm = {
  type: string;
  amount: string;
  accountId: string;
  categoryId: string;
  merchant: string;
  note: string;
  paymentMethod: string;
  transactionDate: string;
};

export type AuthMode = 'login' | 'signup' | 'forgotPassword' | 'resetPassword';

export type AuthFormState = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
  resetToken: string;
};

export type InviteFormState = Record<string, { email: string; role: string }>;
export type RequestEditState = Record<string, string>;

export type AppToast = {
  message: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
};
