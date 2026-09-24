import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChangeOrder } from '../models/changeOrder.entity';
import { AuditAction, ChangeOrderStatus, ChangeType } from '../types/enums';
import { AuthenticatedUser, RequestContext } from '../types/interfaces';
import { calculateChangedAmount, toMoney } from '../utils/calculator';
import { AuditLogService } from './auditLog.service';

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
    private readonly auditLogService: AuditLogService
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

    changeOrder.status = approved ? ChangeOrderStatus.Approved : ChangeOrderStatus.Rejected;
    changeOrder.approverId = reviewer.id;
    changeOrder.approvedAt = new Date();

    const saved = await this.changeOrderRepository.save(changeOrder);
    await this.writeAudit(approved ? AuditAction.ChangeOrderApproved : AuditAction.ChangeOrderRejected, saved, context, {
      approverId: reviewer.id
    });
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
