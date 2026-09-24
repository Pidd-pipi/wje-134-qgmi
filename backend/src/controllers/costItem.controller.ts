import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { costItemRoutes } from '../routes/costItem.routes';
import { CostItemService } from '../services/costItem.service';
import { UserRole } from '../types/enums';
import { RequestContext } from '../types/interfaces';
import { RbacMiddleware, Roles } from '../middlewares/rbac.middleware';
import { ok } from '../utils/response';
import { CreateCostItemDto, MarkCostExceptionDto } from './dto/costItem.dto';

@ApiTags(costItemRoutes.tag)
@ApiBearerAuth()
@Controller(costItemRoutes.base)
@UseGuards(RbacMiddleware)
export class CostItemController {
  constructor(private readonly costItemService: CostItemService) {}

  @Get()
  @Roles(UserRole.Admin, UserRole.FinanceManager, UserRole.ProjectManager, UserRole.Accountant, UserRole.Viewer)
  @ApiQuery({ name: 'budgetId', required: false })
  @ApiOperation({ summary: '查询成本项列表' })
  async list(@Query('budgetId') budgetId: string | undefined, @Req() request: Request) {
    return ok(await this.costItemService.list(budgetId), '成本项列表', request.requestId);
  }

  @Post()
  @Roles(UserRole.Admin, UserRole.Accountant)
  @ApiOperation({ summary: '录入成本项，自动计算差异金额' })
  async create(@Body() body: CreateCostItemDto, @Req() request: Request) {
    return ok(await this.costItemService.create(body, this.context(request)), '成本项已录入', request.requestId);
  }

  @Post(costItemRoutes.reviewVariance)
  @Roles(UserRole.Admin, UserRole.FinanceManager, UserRole.Accountant)
  @ApiOperation({ summary: '核对成本差异' })
  async reviewVariance(@Param('id') id: string, @Req() request: Request) {
    return ok(await this.costItemService.reviewVariance(id, this.context(request)), '成本差异已核对', request.requestId);
  }

  @Post(costItemRoutes.markException)
  @Roles(UserRole.Admin, UserRole.FinanceManager, UserRole.Accountant)
  @ApiOperation({ summary: '标记异常成本项' })
  async markException(@Param('id') id: string, @Body() body: MarkCostExceptionDto, @Req() request: Request) {
    return ok(
      await this.costItemService.markException(id, body.reason, this.context(request)),
      '成本项已标记异常',
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
