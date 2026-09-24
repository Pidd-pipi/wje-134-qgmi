import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CostItem } from '../models/costItem.entity';
import { AuditAction, BudgetStatus, CostCategory, CostItemStatus } from '../types/enums';
import { RequestContext } from '../types/interfaces';
import { calculateVarianceAmount, toMoney } from '../utils/calculator';
import { AuditLogService } from './auditLog.service';
import { BudgetService } from './budget.service';

export interface CreateCostItemInput {
  budgetId: string;
  category: CostCategory;
  costName: string;
  budgetAmount: number;
  actualAmount: number;
  occurredAt: string;
  voucherNo: string;
  materialUsageId?: string;
  laborTimeRecordId?: string;
}

@Injectable()
export class CostItemService {
  constructor(
    @InjectRepository(CostItem)
    private readonly costItemRepository: Repository<CostItem>,
    private readonly budgetService: BudgetService,
    private readonly auditLogService: AuditLogService
  ) {}

  async list(budgetId?: string): Promise<CostItem[]> {
    return this.costItemRepository.find({
      where: budgetId ? { budgetId } : {},
      order: { occurredAt: 'DESC', createdAt: 'DESC' }
    });
  }

  async getById(id: string): Promise<CostItem> {
    const costItem = await this.costItemRepository.findOne({ where: { id } });
    if (!costItem) {
      throw new NotFoundException('成本项不存在');
    }

    return costItem;
  }

  async create(input: CreateCostItemInput, context: RequestContext): Promise<CostItem> {
    const budget = await this.budgetService.getById(input.budgetId);
    if (budget.status !== BudgetStatus.Approved) {
      throw new BadRequestException('只能在已审批预算下录入成本');
    }

    const costItem = this.costItemRepository.create({
      budgetId: input.budgetId,
      category: input.category,
      costName: input.costName,
      budgetAmount: toMoney(input.budgetAmount),
      actualAmount: toMoney(input.actualAmount),
      varianceAmount: calculateVarianceAmount(input.budgetAmount, input.actualAmount),
      occurredAt: input.occurredAt,
      voucherNo: input.voucherNo,
      materialUsageId: input.materialUsageId ?? null,
      laborTimeRecordId: input.laborTimeRecordId ?? null,
      status: CostItemStatus.Normal
    });

    const saved = await this.costItemRepository.save(costItem);
    await this.budgetService.recalculateUsedAmount(input.budgetId);
    await this.writeAudit(AuditAction.CostItemCreated, saved, context, {
      varianceAmount: saved.varianceAmount
    });
    return saved;
  }

  async reviewVariance(id: string, context: RequestContext): Promise<CostItem> {
    const costItem = await this.getById(id);
    costItem.varianceAmount = calculateVarianceAmount(costItem.budgetAmount, costItem.actualAmount);
    costItem.status = CostItemStatus.VarianceReviewed;

    const saved = await this.costItemRepository.save(costItem);
    await this.writeAudit(AuditAction.CostItemReviewed, saved, context, {
      varianceAmount: saved.varianceAmount
    });
    return saved;
  }

  async markException(id: string, reason: string, context: RequestContext): Promise<CostItem> {
    const costItem = await this.getById(id);
    costItem.status = CostItemStatus.Exception;
    costItem.exceptionReason = reason;

    const saved = await this.costItemRepository.save(costItem);
    await this.writeAudit(AuditAction.CostItemMarkedException, saved, context, { reason });
    return saved;
  }

  private async writeAudit(
    action: AuditAction,
    costItem: CostItem,
    context: RequestContext,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    await this.auditLogService.write({
      action,
      entityType: 'CostItem',
      entityId: costItem.id,
      user: context.user,
      requestId: context.requestId,
      ipAddress: context.ip,
      metadata
    });
  }
}
