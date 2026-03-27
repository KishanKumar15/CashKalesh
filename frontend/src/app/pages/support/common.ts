import type {
  AccountDto,
  CategoryDto,
  InsightCardDto,
  RuleActionDto,
  RuleConditionDto,
  RuleDto,
  RuleUpsertRequest,
} from '../../../services/api';

export type RuleConditionForm = RuleConditionDto & { id: string };
export type RuleActionForm = RuleActionDto & { id: string };
export type RuleComposerState = {
  priority: string;
  isActive: boolean;
  conditions: RuleConditionForm[];
  actions: RuleActionForm[];
};

export const ruleFieldOptions = ['merchant', 'note', 'amount', 'type'] as const;
export const ruleOperatorOptions = ['Equals', 'Contains', 'StartsWith', 'GreaterThan', 'LessThan', 'InList'] as const;
export const ruleActionOptions = ['SetCategory', 'AddTag', 'SetAccount', 'TriggerAlert', 'FlagReview'] as const;

function createId() {
  return Math.random().toString(36).slice(2, 10);
}

export function createConditionForm(condition?: Partial<RuleConditionDto>): RuleConditionForm {
  return {
    id: createId(),
    field: condition?.field ?? 'merchant',
    operator: condition?.operator ?? 'Contains',
    value: condition?.value ?? '',
  };
}

export function createActionForm(action?: Partial<RuleActionDto>): RuleActionForm {
  return {
    id: createId(),
    type: action?.type ?? 'TriggerAlert',
    value: action?.value ?? '',
  };
}

export function createEmptyRuleComposer(): RuleComposerState {
  return {
    priority: '1',
    isActive: true,
    conditions: [createConditionForm()],
    actions: [createActionForm()],
  };
}

export function mapRuleToComposer(rule: RuleDto): RuleComposerState {
  return {
    priority: String(rule.priority),
    isActive: rule.isActive,
    conditions: rule.conditions.length > 0 ? rule.conditions.map((condition) => createConditionForm(condition)) : [createConditionForm()],
    actions: rule.actions.length > 0 ? rule.actions.map((action) => createActionForm(action)) : [createActionForm()],
  };
}

export function mapComposerToRequest(composer: RuleComposerState): RuleUpsertRequest {
  return {
    priority: Number(composer.priority) || 1,
    isActive: composer.isActive,
    conditions: composer.conditions.map(({ id: _id, ...condition }) => condition).filter((condition) => condition.value.trim()),
    actions: composer.actions.map(({ id: _id, ...action }) => action).filter((action) => action.value.trim() || action.type === 'FlagReview'),
  };
}

export function getRuleActionValueLabel(action: RuleActionDto, accounts: AccountDto[], categories: CategoryDto[]) {
  if (action.type === 'SetCategory') {
    return categories.find((item) => item.id === action.value)?.name ?? action.value;
  }

  if (action.type === 'SetAccount') {
    return accounts.find((item) => item.id === action.value)?.name ?? action.value;
  }

  return action.value || 'No value';
}

export function getInsightGroup(insight: InsightCardDto) {
  const source = `${insight.title} ${insight.message}`.toLowerCase();

  if (source.includes('save') || source.includes('goal')) return 'Savings behavior';
  if (source.includes('forecast') || source.includes('risk') || source.includes('safe')) return 'Forecast risk';
  if (source.includes('budget')) return 'Budget control';
  return 'Spending behavior';
}

export function createRuleDraftFromInsight(insight: InsightCardDto): RuleComposerState {
  return {
    priority: '1',
    isActive: true,
    conditions: [createConditionForm()],
    actions: [createActionForm({ type: 'TriggerAlert', value: insight.title })],
  };
}

export function getInsightStorageKey(kind: 'saved' | 'dismissed') {
  return `cashkalesh_insights_${kind}`;
}
