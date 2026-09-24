import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ProjectBudget } from '../models/budget.entity';
import { CostItem } from '../models/costItem.entity';
import { AuditAction, BudgetStatus, Currency } from '../types/enums';
import { AuthenticatedUser, RequestContext } from '../types/interfaces';
import { toMoney } from '../utils/calculator';
import { AuditLogService } from './auditLog.service';
import { ReportService } from './report.service';

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

export interface AppliedChangeOrderResult {
  budget: ProjectBudget;
  previousTotalAmount: string;
  adjustmentAmount: string;
  adjustedTotalAmount: string;
  incurredCostAmount: string;
}

// PostgreSQL 唯一约束冲突错误码
const UNIQUE_VIOLATION_CODE = '23505';
const EFFECTIVE_BUDGET_EXISTS_MESSAGE = '该项目已存在审批通过的生效预算，不能重复审批其他预算';

@Injectable()
export class BudgetService {
  constructor(
    @InjectRepository(ProjectBudget)
    private readonly budgetRepository: Repository<ProjectBudget>,
    private readonly auditLogService: AuditLogService,
    private readonly reportService: ReportService,
    private readonly dataSource: DataSource
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
    try {
      const saved = await this.dataSource.transaction(async (manager) => {
        const budget = await manager.findOne(ProjectBudget, {
          where: { id },
          relations: ['costItems'],
          lock: { mode: 'pessimistic_write' }
        });

        if (!budget) {
          throw new NotFoundException('项目预算不存在');
        }

        if (budget.status !== BudgetStatus.Submitted) {
          throw new BadRequestException('只有已提交预算可以审批');
        }

        // 生效口径收紧：一个项目只能有一份审批通过的预算
        if (input.approved) {
          const effectiveBudget = await manager.findOne(ProjectBudget, {
            where: { projectId: budget.projectId, status: BudgetStatus.Approved }
          });

          if (effectiveBudget && effectiveBudget.id !== budget.id) {
            throw new BadRequestException(EFFECTIVE_BUDGET_EXISTS_MESSAGE);
          }
        }

        budget.status = input.approved ? BudgetStatus.Approved : BudgetStatus.Rejected;
        budget.approverId = reviewer.id;
        budget.approvedAt = new Date();
        budget.remark = input.remark ?? budget.remark;

        return manager.save(budget);
      });

      await this.writeAudit(input.approved ? AuditAction.BudgetApproved : AuditAction.BudgetRejected, saved, context, {
        approverId: reviewer.id,
        remark: input.remark
      });

      // 生效预算状态变化会影响成本报告口径，作废相关缓存
      await this.reportService.invalidateProjectCache(saved.projectId);

      return saved;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new BadRequestException(EFFECTIVE_BUDGET_EXISTS_MESSAGE);
      }

      throw error;
    }
  }

  /**
   * 将已审批通过的变更单金额增减并入项目唯一生效预算的总额。
   * 可加入调用方事务（传入 manager），与变更单状态更新原子提交。
   */
  async applyApprovedChangeOrder(
    projectId: string,
    changeOrderId: string,
    changeAmount: string | number,
    manager?: EntityManager
  ): Promise<AppliedChangeOrderResult> {
    const apply = async (entityManager: EntityManager): Promise<AppliedChangeOrderResult> => {
      const effectiveBudget = await entityManager.findOne(ProjectBudget, {
        where: { projectId, status: BudgetStatus.Approved },
        lock: { mode: 'pessimistic_write' }
      });

      if (!effectiveBudget) {
        throw new BadRequestException('该项目尚无审批通过的生效预算，变更单不能审批通过');
      }

      const incurredCostAmount = await this.sumIncurredCost(projectId, entityManager);
      const previousTotalAmount = toMoney(effectiveBudget.totalAmount);
      const adjustmentAmount = toMoney(changeAmount);
      const adjustedTotalAmount = toMoney(Number(previousTotalAmount) + Number(adjustmentAmount));

      if (Number(adjustedTotalAmount) < 0) {
        throw new BadRequestException(
          `并入变更金额后生效预算总额为 ${adjustedTotalAmount}，低于零，变更单 ${changeOrderId} 不能审批通过`
        );
      }

      if (Number(adjustedTotalAmount) < Number(incurredCostAmount)) {
        throw new BadRequestException(
          `并入变更金额后生效预算总额 ${adjustedTotalAmount} 低于已发生成本 ${incurredCostAmount}，变更单 ${changeOrderId} 不能审批通过`
        );
      }

      effectiveBudget.totalAmount = adjustedTotalAmount;
      const savedBudget = await entityManager.save(effectiveBudget);

      return {
        budget: savedBudget,
        previousTotalAmount,
        adjustmentAmount,
        adjustedTotalAmount,
        incurredCostAmount
      };
    };

    return manager ? apply(manager) : this.dataSource.transaction(apply);
  }

  /** 汇总项目下所有生效（审批通过）预算已发生的实际成本 */
  private async sumIncurredCost(projectId: string, manager: EntityManager): Promise<string> {
    const result = await manager
      .createQueryBuilder(CostItem, 'costItem')
      .innerJoin(ProjectBudget, 'budget', 'budget.id = costItem.budget_id')
      .where('budget.project_id = :projectId', { projectId })
      .andWhere('budget.status = :status', { status: BudgetStatus.Approved })
      .select('COALESCE(SUM(costItem.actual_amount), 0)', 'total')
      .getRawOne<{ total: string }>();

    return toMoney(result?.total ?? 0);
  }

  async recalculateUsedAmount(id: string): Promise<ProjectBudget> {
    const budget = await this.getById(id);
    const usedAmount = budget.costItems.reduce((sum, item) => sum + Number(item.actualAmount), 0);
    budget.usedAmount = toMoney(usedAmount);
    return this.budgetRepository.save(budget);
  }

  private isUniqueViolation(error: unknown): boolean {
    const driverError = (error as { driverError?: { code?: string } })?.driverError;
    return driverError?.code === UNIQUE_VIOLATION_CODE;
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
