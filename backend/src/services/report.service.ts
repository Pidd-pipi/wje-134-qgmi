import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CostReport } from '../models/costReport.entity';
import { ProjectBudget } from '../models/budget.entity';
import { AuditAction, BudgetStatus, ReportPeriod, ReportType } from '../types/enums';
import { RequestContext } from '../types/interfaces';
import { AuditLogService } from './auditLog.service';
import { AnalyticsService } from './analytics.service';
import { RedisService } from './redis.service';
import { logger } from '../utils/logger';

export interface GenerateReportInput {
  projectId: string;
  period: ReportPeriod;
  reportType: ReportType;
}

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(CostReport)
    private readonly reportRepository: Repository<CostReport>,
    @InjectRepository(ProjectBudget)
    private readonly budgetRepository: Repository<ProjectBudget>,
    private readonly analyticsService: AnalyticsService,
    private readonly auditLogService: AuditLogService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService
  ) {}

  async list(projectId?: string): Promise<CostReport[]> {
    return this.reportRepository.find({
      where: projectId ? { projectId } : {},
      order: { generatedAt: 'DESC' }
    });
  }

  async generate(input: GenerateReportInput, context: RequestContext): Promise<CostReport> {
    const cacheKey = `reports:${input.projectId}:${input.period}:${input.reportType}`;
    const cached = await this.redisService.getJson<CostReport>(cacheKey);
    if (cached) {
      return cached;
    }

    const budgets = await this.budgetRepository.find({
      where: { projectId: input.projectId, status: BudgetStatus.Approved },
      relations: ['costItems'],
      order: { approvedAt: 'DESC', createdAt: 'DESC' }
    });
    // 生效口径：一个项目只有一份生效预算；成本与预算对比均以其调整后的总额为准
    const effectiveBudget = budgets[0];
    const costItems = effectiveBudget?.costItems ?? [];
    const approvedBudgetTotal = effectiveBudget ? Number(effectiveBudget.totalAmount) : 0;
    const summary = this.analyticsService.summarize(costItems, approvedBudgetTotal);

    const report = this.reportRepository.create({
      projectId: input.projectId,
      period: input.period,
      reportType: input.reportType,
      laborCostTotal: summary.laborCostTotal,
      materialCostTotal: summary.materialCostTotal,
      equipmentCostTotal: summary.equipmentCostTotal,
      otherCostTotal: summary.otherCostTotal,
      totalCost: summary.totalCost,
      profitLossAnalysis: summary.profitLossAnalysis,
      generatedAt: new Date()
    });

    const saved = await this.reportRepository.save(report);
    await this.auditLogService.write({
      action: AuditAction.ReportGenerated,
      entityType: 'CostReport',
      entityId: saved.id,
      user: context.user,
      requestId: context.requestId,
      ipAddress: context.ip,
      metadata: { projectId: input.projectId, reportType: input.reportType }
    });
    await this.redisService.setJson(
      cacheKey,
      saved,
      this.configService.get<number>('redis.reportCacheSeconds') ?? 300
    );
    return saved;
  }

  /** 生效预算或变更单导致预算口径变化时，作废该项目全部成本报告缓存 */
  async invalidateProjectCache(projectId: string): Promise<void> {
    try {
      await this.redisService.deleteByPattern(`reports:${projectId}:*`);
    } catch (error) {
      logger.warn('invalidate report cache failed', {
        projectId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
