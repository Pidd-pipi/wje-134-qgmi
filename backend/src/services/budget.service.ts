import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ProjectBudget } from '../models/budget.entity';
import { ChangeOrder } from '../models/changeOrder.entity';
import { CostItem } from '../models/costItem.entity';
import { AuditAction, BudgetStatus, Currency } from '../types/enums';
import { AuthenticatedUser, RequestContext } from '../types/interfaces';
import { sumMoney, toMoney } from '../utils/calculator';
import { AuditLogService } from './auditLog.service';
import { RedisService } from './redis.service';

export interface CreateBudgetInput {
  projectId: string;
  budgetName: string;
  totalAmount: number;
  reservedAmount?: number;
  currency?: Currency;
  remark?: string;
}

export interface ReviewBudgetInput {
  approved: boolean;
  remark?: string;
}

export interface ChangeOrderBudgetAdjustment {
  budget: ProjectBudget;
  previousTotalAmount: string;
  adjustedTotalAmount: string;
}

@Injectable()
export class BudgetService {
  constructor(
    @InjectRepository(ProjectBudget)
    private readonly budgetRepository: Repository<ProjectBudget>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
    private readonly redisService: RedisService
  ) {}

  async list(projectId?: string): Promise<ProjectBudget[]> {
    return this.budgetRepository.find({
      where: projectId ? { projectId } : {},
      relations: ['costItems'],
      order: { createdAt: 'DESC' }
    });
  }

  async getById(id: string): Promise<ProjectBudget> {
    const budget = await this.budgetRepository.findOne({
      where: { id },
      relations: ['costItems']
    });

    if (!budget) {
      throw new NotFoundException('项目预算不存在');
    }

    return budget;
  }

  async create(input: CreateBudgetInput, context: RequestContext): Promise<ProjectBudget> {
    const budget = this.budgetRepository.create({
      projectId: input.projectId,
      budgetName: input.budgetName,
      totalAmount: toMoney(input.totalAmount),
      usedAmount: toMoney(0),
      reservedAmount: toMoney(input.reservedAmount ?? 0),
      currency: input.currency ?? Currency.CNY,
      status: BudgetStatus.Draft,
      remark: input.remark ?? null
    });

    const saved = await this.budgetRepository.save(budget);
    await this.writeAudit(AuditAction.BudgetCreated, saved, context, { totalAmount: saved.totalAmount });
    return saved;
  }

  async submit(id: string, context: RequestContext): Promise<ProjectBudget> {
    const budget = await this.getById(id);
    if (budget.status !== BudgetStatus.Draft && budget.status !== BudgetStatus.Rejected) {
      throw new BadRequestException('只有草稿或已驳回预算可以提交审批');
    }

    budget.status = BudgetStatus.Submitted;
    const saved = await this.budgetRepository.save(budget);
    await this.writeAudit(AuditAction.BudgetSubmitted, saved, context);
    return saved;
  }

  async review(id: string, input: ReviewBudgetInput, reviewer: AuthenticatedUser, context: RequestContext): Promise<ProjectBudget> {
    let saved: ProjectBudget;
    try {
      saved = await this.dataSource.transaction(async (manager) => {
        const budget = await manager.getRepository(ProjectBudget).findOne({
          where: { id },
          lock: { mode: 'pessimistic_write' }
        });
        if (!budget) {
          throw new NotFoundException('项目预算不存在');
        }
        if (budget.status !== BudgetStatus.Submitted) {
          throw new BadRequestException('只有已提交预算可以审批');
        }

        if (input.approved) {
          await this.ensureNoOtherApprovedBudget(manager, budget);
        }

        budget.status = input.approved ? BudgetStatus.Approved : BudgetStatus.Rejected;
        budget.approverId = reviewer.id;
        budget.approvedAt = new Date();
        budget.remark = input.remark ?? budget.remark;

        return manager.getRepository(ProjectBudget).save(budget);
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new BadRequestException('该项目已存在审批通过的预算，不能再次审批通过其他预算');
      }
      throw error;
    }

    await this.writeAudit(input.approved ? AuditAction.BudgetApproved : AuditAction.BudgetRejected, saved, context, {
      approverId: reviewer.id,
      remark: input.remark
    });
    if (input.approved) {
      await this.invalidateProjectReportCache(saved.projectId);
    }
    return saved;
  }

  async recalculateUsedAmount(id: string): Promise<ProjectBudget> {
    const budget = await this.getById(id);
    const usedAmount = budget.costItems.reduce((sum, item) => sum + Number(item.actualAmount), 0);
    budget.usedAmount = toMoney(usedAmount);
    return this.budgetRepository.save(budget);
  }

  async applyChangeOrderAdjustment(manager: EntityManager, changeOrder: ChangeOrder): Promise<ChangeOrderBudgetAdjustment> {
    const budget = await manager.getRepository(ProjectBudget).findOne({
      where: { projectId: changeOrder.projectId, status: BudgetStatus.Approved },
      lock: { mode: 'pessimistic_write' }
    });
    if (!budget) {
      throw new BadRequestException('项目不存在审批通过的预算，变更单不能审批通过');
    }

    const incurredCost = await this.sumIncurredCost(manager, budget.id);
    const previousTotalAmount = budget.totalAmount;
    const adjustedTotalAmount = sumMoney([previousTotalAmount, changeOrder.changeAmount]);
    const adjustedTotal = Number(adjustedTotalAmount);

    if (adjustedTotal < 0) {
      throw new BadRequestException('变更后预算总额不能低于零，变更单不能审批通过');
    }
    if (adjustedTotal < incurredCost) {
      throw new BadRequestException('变更后预算总额不能低于已发生成本，变更单不能审批通过');
    }

    budget.totalAmount = adjustedTotalAmount;
    const saved = await manager.getRepository(ProjectBudget).save(budget);
    return { budget: saved, previousTotalAmount, adjustedTotalAmount };
  }

  private async ensureNoOtherApprovedBudget(manager: EntityManager, budget: ProjectBudget): Promise<void> {
    const existingApproved = await manager.getRepository(ProjectBudget).findOne({
      where: { projectId: budget.projectId, status: BudgetStatus.Approved },
      lock: { mode: 'pessimistic_write' }
    });

    if (existingApproved && existingApproved.id !== budget.id) {
      throw new BadRequestException('该项目已存在审批通过的预算，不能再次审批通过其他预算');
    }
  }

  private async sumIncurredCost(manager: EntityManager, budgetId: string): Promise<number> {
    const costItems = await manager.getRepository(CostItem).find({ where: { budgetId } });
    return costItems.reduce((sum, item) => sum + Number(item.actualAmount), 0);
  }

  private async invalidateProjectReportCache(projectId: string): Promise<void> {
    await this.redisService.deleteByPattern(`reports:${projectId}:*`);
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const candidate = error as { code?: string; driverError?: { code?: string } };
    return candidate.code === '23505' || candidate.driverError?.code === '23505';
  }

  private async writeAudit(
    action: AuditAction,
    budget: ProjectBudget,
    context: RequestContext,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    await this.auditLogService.write({
      action,
      entityType: 'ProjectBudget',
      entityId: budget.id,
      user: context.user,
      requestId: context.requestId,
      ipAddress: context.ip,
      metadata
    });
  }
}
