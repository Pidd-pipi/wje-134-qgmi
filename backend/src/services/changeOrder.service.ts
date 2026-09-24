import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ChangeOrder } from '../models/changeOrder.entity';
import { AuditAction, ChangeOrderStatus, ChangeType } from '../types/enums';
import { AuthenticatedUser, RequestContext } from '../types/interfaces';
import { calculateChangedAmount, toMoney } from '../utils/calculator';
import { AuditLogService } from './auditLog.service';
import { BudgetService } from './budget.service';
import { ReportService } from './report.service';

export interface CreateChangeOrderInput {
  projectId: string;
  changeType: ChangeType;
  description: string;
  originalAmount: number;
  changeAmount: number;
  applicationReason: string;
}

@Injectable()
export class ChangeOrderService {
  constructor(
    @InjectRepository(ChangeOrder)
    private readonly changeOrderRepository: Repository<ChangeOrder>,
    private readonly budgetService: BudgetService,
    private readonly reportService: ReportService,
    private readonly auditLogService: AuditLogService,
    private readonly dataSource: DataSource
  ) {}

  async list(projectId?: string): Promise<ChangeOrder[]> {
    return this.changeOrderRepository.find({
      where: projectId ? { projectId } : {},
      order: { createdAt: 'DESC' }
    });
  }

  async getById(id: string): Promise<ChangeOrder> {
    const changeOrder = await this.changeOrderRepository.findOne({ where: { id } });
    if (!changeOrder) {
      throw new NotFoundException('变更单不存在');
    }

    return changeOrder;
  }

  async create(input: CreateChangeOrderInput, applicant: AuthenticatedUser, context: RequestContext): Promise<ChangeOrder> {
    const changeOrder = this.changeOrderRepository.create({
      projectId: input.projectId,
      changeType: input.changeType,
      description: input.description,
      originalAmount: toMoney(input.originalAmount),
      changeAmount: toMoney(input.changeAmount),
      changedAmount: calculateChangedAmount(input.originalAmount, input.changeAmount),
      applicationReason: input.applicationReason,
      status: ChangeOrderStatus.Draft,
      applicantId: applicant.id,
      appliedAt: new Date()
    });

    const saved = await this.changeOrderRepository.save(changeOrder);
    await this.writeAudit(AuditAction.ChangeOrderCreated, saved, context);
    return saved;
  }

  async submit(id: string, context: RequestContext): Promise<ChangeOrder> {
    const changeOrder = await this.getById(id);
    if (changeOrder.status !== ChangeOrderStatus.Draft && changeOrder.status !== ChangeOrderStatus.Rejected) {
      throw new BadRequestException('只有草稿或已驳回变更单可以提交');
    }

    changeOrder.status = ChangeOrderStatus.Submitted;
    const saved = await this.changeOrderRepository.save(changeOrder);
    await this.writeAudit(AuditAction.ChangeOrderSubmitted, saved, context);
    return saved;
  }

  async review(id: string, approved: boolean, reviewer: AuthenticatedUser, context: RequestContext): Promise<ChangeOrder> {
    const changeOrder = await this.getById(id);
    if (changeOrder.status !== ChangeOrderStatus.Submitted) {
      throw new BadRequestException('只有已提交变更单可以审批');
    }

    let appliedChange:
      | { previousTotalAmount: string; adjustedTotalAmount: string; adjustmentAmount: string; incurredCostAmount: string }
      | undefined;

    if (!approved) {
      changeOrder.status = ChangeOrderStatus.Rejected;
      changeOrder.approverId = reviewer.id;
      changeOrder.approvedAt = new Date();
      const saved = await this.changeOrderRepository.save(changeOrder);
      await this.writeAudit(AuditAction.ChangeOrderRejected, saved, context, { approverId: reviewer.id });
      return saved;
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const lockedChangeOrder = await manager.findOne(ChangeOrder, {
        where: { id },
        lock: { mode: 'pessimistic_write' }
      });

      if (!lockedChangeOrder) {
        throw new NotFoundException('变更单不存在');
      }

      if (lockedChangeOrder.status !== ChangeOrderStatus.Submitted) {
        throw new BadRequestException('只有已提交变更单可以审批');
      }

      // 审批通过：把变更金额增减并入项目唯一生效预算，校验不通过则整笔回滚
      const result = await this.budgetService.applyApprovedChangeOrder(
        lockedChangeOrder.projectId,
        lockedChangeOrder.id,
        lockedChangeOrder.changeAmount,
        manager
      );

      lockedChangeOrder.status = ChangeOrderStatus.Approved;
      lockedChangeOrder.approverId = reviewer.id;
      lockedChangeOrder.approvedAt = new Date();

      appliedChange = {
        previousTotalAmount: result.previousTotalAmount,
        adjustedTotalAmount: result.adjustedTotalAmount,
        adjustmentAmount: result.adjustmentAmount,
        incurredCostAmount: result.incurredCostAmount
      };

      return manager.save(lockedChangeOrder);
    });

    await this.writeAudit(AuditAction.ChangeOrderApproved, saved, context, {
      approverId: reviewer.id,
      previousBudgetTotal: appliedChange?.previousTotalAmount,
      adjustmentAmount: appliedChange?.adjustmentAmount,
      adjustedBudgetTotal: appliedChange?.adjustedTotalAmount,
      incurredCostAmount: appliedChange?.incurredCostAmount
    });

    // 生效预算总额已调整，成本报告必须按新数展示
    await this.reportService.invalidateProjectCache(saved.projectId);

    return saved;
  }

  async cancel(id: string, context: RequestContext): Promise<ChangeOrder> {
    const changeOrder = await this.getById(id);
    if (changeOrder.status === ChangeOrderStatus.Approved) {
      throw new BadRequestException('已审批通过的变更单不能作废');
    }

    changeOrder.status = ChangeOrderStatus.Cancelled;
    const saved = await this.changeOrderRepository.save(changeOrder);
    await this.writeAudit(AuditAction.ChangeOrderCancelled, saved, context);
    return saved;
  }

  private async writeAudit(
    action: AuditAction,
    changeOrder: ChangeOrder,
    context: RequestContext,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    await this.auditLogService.write({
      action,
      entityType: 'ChangeOrder',
      entityId: changeOrder.id,
      user: context.user,
      requestId: context.requestId,
      ipAddress: context.ip,
      metadata
    });
  }
}
