import { CostCategory } from '../types/enums';

export function toMoney(value: string | number): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    throw new Error('金额必须是有效数字');
  }

  return amount.toFixed(2);
}

export function calculateVarianceAmount(budgetAmount: string | number, actualAmount: string | number): string {
  return toMoney(Number(actualAmount) - Number(budgetAmount));
}

export function calculateChangedAmount(originalAmount: string | number, changeAmount: string | number): string {
  return toMoney(Number(originalAmount) + Number(changeAmount));
}

export function sumMoney(values: Array<string | number>): string {
  return toMoney(values.reduce<number>((sum, current) => sum + Number(current), 0));
}

export function normalizeOtherCostCategory(category: CostCategory): 'labor' | 'material' | 'equipment' | 'other' {
  if (category === CostCategory.Labor) {
    return 'labor';
  }

  if (category === CostCategory.Material) {
    return 'material';
  }

  if (category === CostCategory.Equipment) {
    return 'equipment';
  }

  return 'other';
}
