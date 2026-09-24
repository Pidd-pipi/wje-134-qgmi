import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { reportRoutes } from '../routes/report.routes';
import { ReportService } from '../services/report.service';
import { UserRole } from '../types/enums';
import { RequestContext } from '../types/interfaces';
import { RbacMiddleware, Roles } from '../middlewares/rbac.middleware';
import { ok } from '../utils/response';
import { GenerateReportDto } from './dto/report.dto';

@ApiTags(reportRoutes.tag)
@ApiBearerAuth()
@Controller(reportRoutes.base)
@UseGuards(RbacMiddleware)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get()
  @Roles(UserRole.Admin, UserRole.FinanceManager, UserRole.ProjectManager, UserRole.Accountant, UserRole.Viewer)
  @ApiQuery({ name: 'projectId', required: false })
  @ApiOperation({ summary: '查询成本分析报告列表' })
  async list(@Query('projectId') projectId: string | undefined, @Req() request: Request) {
    return ok(await this.reportService.list(projectId), '成本分析报告列表', request.requestId);
  }

  @Post(reportRoutes.generate)
  @Roles(UserRole.Admin, UserRole.FinanceManager, UserRole.ProjectManager)
  @ApiOperation({ summary: '生成成本分析报告，使用 Redis 缓存报告结果' })
  async generate(@Body() body: GenerateReportDto, @Req() request: Request) {
    return ok(await this.reportService.generate(body, this.context(request)), '成本分析报告已生成', request.requestId);
  }

  private context(request: Request): RequestContext {
    return {
      requestId: request.requestId ?? '',
      ip: request.ip ?? request.socket.remoteAddress ?? 'unknown',
      user: request.user
    };
  }
}
