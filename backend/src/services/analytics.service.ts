import { Injectable } from '@nestjs/common';
import { CostItem } from '../models/costItem.entity';
import { normalizeOtherCostCategory, sumMoney, toMoney } from '../utils/calculator';

export interface CostAnalysisSummary {
  laborCostTotal: string;
  materialCostTotal: string;
  equipmentCostTotal: string;
  otherCostTotal: string;
  totalCost: string;
  profitLossAnalysis: string;
}

@Injectable()
export class AnalyticsService {
  summarize(costItems: CostItem[], approvedBudgetTotal: number): CostAnalysisSummary {
    const buckets = {
      labor: 0,
      material: 0,
      equipment: 0,
      other: 0
    };

    for (const item of costItems) {
      const bucket = normalizeOtherCostCategory(item.category);
      buckets[bucket] += Number(item.actualAmount);
    }

    const totalCost = Number(sumMoney([buckets.labor, buckets.material, buckets.equipment, buckets.other]));
    const delta = approvedBudgetTotal - totalCost;
    const profitLossAnalysis =
      delta >= 0
        ? `当前成本低于预算 ${toMoney(delta)}，项目成本处于可控区间。`
        : `当前成本超出预算 ${toMoney(Math.abs(delta))}，需复核异常成本和变更单。`;

    return {
      laborCostTotal: toMoney(buckets.labor),
      materialCostTotal: toMoney(buckets.material),
      equipmentCostTotal: toMoney(buckets.equipment),
      otherCostTotal: toMoney(buckets.other),
      totalCost: toMoney(totalCost),
      profitLossAnalysis
    };
  }
}
