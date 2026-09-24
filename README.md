# 建筑工程项目成本管控 API

`cost-control-api` 是一个纯后端 NestJS 服务，面向建筑公司财务与项目管理团队，提供项目预算编制、成本归集、变更管理、成本分析报告、RBAC 权限控制、审计日志和 Redis 限流能力。

## API 功能列表

- 项目预算：创建预算、查询预算、提交审批、审批通过、审批驳回。
- 成本项：录入成本、自动计算差异金额、核对差异、标记异常。
- 变更单：发起变更、提交审批、审批通过、驳回、作废。
- 成本分析报告：按项目生成月度/季度/年度/自定义报告，汇总人工、材料、设备和其他成本。
- 横切能力：JWT 鉴权、RBAC 角色校验、审计日志、Redis 每 IP 每分钟 60 次限流、请求日志、统一异常响应。

## Docker 快速启动

```bash
cp .env.example .env
docker compose up --build
```

服务启动后访问：

- 健康检查：http://localhost:19203/health
- Swagger 文档：http://localhost:19203/api-docs

停止并清理容器：

```bash
docker compose down
```

## 本地开发方式

```bash
cd backend
npm install
npm run start:dev
```

本地开发默认读取项目根目录 `.env` 或 `backend/.env`，数据库使用 PostgreSQL 15，缓存使用 Redis 7。业务接口需要 Bearer JWT，Token payload 示例：

```json
{
  "sub": "4d5eb37e-02c2-4d6e-a715-6cdcc6c52361",
  "role": "Admin",
  "name": "Local Admin"
}
```

## 技术栈

| 类别 | 技术 |
| --- | --- |
| 后端框架 | NestJS + TypeScript |
| ORM | TypeORM |
| 数据库 | PostgreSQL 15 |
| 缓存 | Redis 7 |
| 认证 | JWT |
| API 文档 | Swagger |
| 部署编排 | Docker Compose |

## 目录结构

```text
backend/src/
├── routes/           # budget.routes.ts, costItem.routes.ts, changeOrder.routes.ts, report.routes.ts
├── controllers/      # budget.controller.ts, costItem.controller.ts, changeOrder.controller.ts, report.controller.ts
├── services/         # budget.service.ts, costItem.service.ts, changeOrder.service.ts, report.service.ts, analytics.service.ts
├── models/           # budget.entity.ts, costItem.entity.ts, changeOrder.entity.ts, costReport.entity.ts
├── middlewares/      # auth.middleware.ts, rbac.middleware.ts, auditLog.middleware.ts, errorHandler.middleware.ts, rateLimit.middleware.ts, requestLogger.middleware.ts
├── types/            # enums.ts, interfaces.ts
├── utils/            # logger.ts, response.ts, calculator.ts
├── config/           # database.config.ts, jwt.config.ts, redis.config.ts, swagger.config.ts
└── database/         # migrations/, seeds/
```

## 枚举定义位置

所有共享枚举集中定义在 `backend/src/types/enums.ts`：

- `BudgetStatus`：`Draft` / `Submitted` / `Approved` / `Rejected`
- `CostCategory`：`Material` / `Labor` / `Equipment` / `Subcontract` / `Overhead` / `Other`
- `ChangeType`：`ScopeChange` / `DesignChange` / `PriceAdjustment` / `UnforeseenCondition`
- `ChangeOrderStatus`：`Draft` / `Submitted` / `Approved` / `Rejected` / `Cancelled`
- `UserRole`：`Admin` / `FinanceManager` / `ProjectManager` / `Accountant` / `Viewer`
- `ReportPeriod`、`ReportType`、`AuditAction` 也在同一文件维护。

## License

MIT
