import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { changeOrderRoutes } from '../routes/changeOrder.routes';
import { ChangeOrderService } from '../services/changeOrder.service';
import { UserRole } from '../types/enums';
import { RequestContext } from '../types/interfaces';
import { RbacMiddleware, Roles } from '../middlewares/rbac.middleware';
import { ok } from '../utils/response';
import { CreateChangeOrderDto, ReviewChangeOrderDto } from './dto/changeOrder.dto';

@ApiTags(changeOrderRoutes.tag)
@ApiBearerAuth()
@Controller(changeOrderRoutes.base)
@UseGuards(RbacMiddleware)
export class ChangeOrderController {
  constructor(private readonly changeOrderService: ChangeOrderService) {}

  @Get()
  @Roles(UserRole.Admin, UserRole.FinanceManager, UserRole.ProjectManager, UserRole.Accountant, UserRole.Viewer)
  @ApiQuery({ name: 'projectId', required: false })
  @ApiOperation({ summary: '查询变更单列表' })
  async list(@Query('projectId') projectId: string | undefined, @Req() request: Request) {
    return ok(await this.changeOrderService.list(projectId), '变更单列表', request.requestId);
  }

  @Post()
  @Roles(UserRole.Admin, UserRole.ProjectManager)
  @ApiOperation({ summary: '发起变更单，自动计算变更后金额' })
  async create(@Body() body: CreateChangeOrderDto, @Req() request: Request) {
    return ok(
      await this.changeOrderService.create(body, request.user!, this.context(request)),
      '变更单已创建',
      request.requestId
    );
  }

  @Post(changeOrderRoutes.submit)
  @Roles(UserRole.Admin, UserRole.ProjectManager)
  @ApiOperation({ summary: '提交变更单审批' })
  async submit(@Param('id') id: string, @Req() request: Request) {
    return ok(await this.changeOrderService.submit(id, this.context(request)), '变更单已提交', request.requestId);
  }

  @Post(changeOrderRoutes.review)
  @Roles(UserRole.Admin, UserRole.FinanceManager)
  @ApiOperation({ summary: '审批或驳回变更单' })
  async review(@Param('id') id: string, @Body() body: ReviewChangeOrderDto, @Req() request: Request) {
    return ok(
      await this.changeOrderService.review(id, body.approved, request.user!, this.context(request)),
      '变更单审批已处理',
      request.requestId
    );
  }

  @Post(changeOrderRoutes.cancel)
  @Roles(UserRole.Admin, UserRole.ProjectManager)
  @ApiOperation({ summary: '作废变更单' })
  async cancel(@Param('id') id: string, @Req() request: Request) {
    return ok(await this.changeOrderService.cancel(id, this.context(request)), '变更单已作废', request.requestId);
  }

  private context(request: Request): RequestContext {
    return {
      requestId: request.requestId ?? '',
      ip: request.ip ?? request.socket.remoteAddress ?? 'unknown',
      user: request.user
    };
  }
}
