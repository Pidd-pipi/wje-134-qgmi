import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CostReport } from '../models/costReport.entity';
import { ProjectBudget } from '../models/budget.entity';
import { AuditAction, ReportPeriod, ReportType } from '../types/enums';
import { RequestContext } from '../types/interfaces';
import { AuditLogService } from './auditLog.service';
import { AnalyticsService } from './analytics.service';
import { RedisService } from './redis.service';

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
      where: { projectId: input.projectId },
      relations: ['costItems']
    });
    const costItems = budgets.flatMap((budget) => budget.costItems);
    const approvedBudgetTotal = budgets.reduce((sum, budget) => sum + Number(budget.totalAmount), 0);
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
}
