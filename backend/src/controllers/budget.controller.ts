import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { budgetRoutes } from '../routes/budget.routes';
import { BudgetService } from '../services/budget.service';
import { UserRole } from '../types/enums';
import { RequestContext } from '../types/interfaces';
import { ok } from '../utils/response';
import { RbacMiddleware, Roles } from '../middlewares/rbac.middleware';
import { CreateBudgetDto, ReviewBudgetDto } from './dto/budget.dto';

@ApiTags(budgetRoutes.tag)
@ApiBearerAuth()
@Controller(budgetRoutes.base)
@UseGuards(RbacMiddleware)
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Get()
  @Roles(UserRole.Admin, UserRole.FinanceManager, UserRole.ProjectManager, UserRole.Accountant, UserRole.Viewer)
  @ApiQuery({ name: 'projectId', required: false })
  @ApiOperation({ summary: '查询项目预算列表' })
  async list(@Query('projectId') projectId: string | undefined, @Req() request: Request) {
    return ok(await this.budgetService.list(projectId), '预算列表', request.requestId);
  }

  @Get(budgetRoutes.byId)
  @Roles(UserRole.Admin, UserRole.FinanceManager, UserRole.ProjectManager, UserRole.Accountant, UserRole.Viewer)
  @ApiOperation({ summary: '查询单个预算详情' })
  async getById(@Param('id') id: string, @Req() request: Request) {
    return ok(await this.budgetService.getById(id), '预算详情', request.requestId);
  }

  @Post()
  @Roles(UserRole.Admin, UserRole.FinanceManager, UserRole.ProjectManager)
  @ApiOperation({ summary: '编制预算' })
  async create(@Body() body: CreateBudgetDto, @Req() request: Request) {
    return ok(await this.budgetService.create(body, this.context(request)), '预算已创建', request.requestId);
  }

  @Post(budgetRoutes.submit)
  @Roles(UserRole.Admin, UserRole.FinanceManager, UserRole.ProjectManager)
  @ApiOperation({ summary: '提交预算审批' })
  async submit(@Param('id') id: string, @Req() request: Request) {
    return ok(await this.budgetService.submit(id, this.context(request)), '预算已提交审批', request.requestId);
  }

  @Post(budgetRoutes.review)
  @Roles(UserRole.Admin, UserRole.FinanceManager)
  @ApiOperation({ summary: '审批通过或驳回预算' })
  async review(@Param('id') id: string, @Body() body: ReviewBudgetDto, @Req() request: Request) {
    return ok(
      await this.budgetService.review(id, body, request.user!, this.context(request)),
      '预算审批已处理',
      request.requestId
    );
  }

  private context(request: Request): RequestContext {
    return {
      requestId: request.requestId ?? '',
      ip: request.ip ?? request.socket.remoteAddress ?? 'unknown',
      user: request.user
    };
  }
}
