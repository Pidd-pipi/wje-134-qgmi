import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { CostCategory } from '../../types/enums';

export class CreateCostItemDto {
  @ApiProperty({ example: '4d5eb37e-02c2-4d6e-a715-6cdcc6c52361' })
  @IsUUID()
  budgetId: string;

  @ApiProperty({ enum: CostCategory, example: CostCategory.Material })
  @IsEnum(CostCategory)
  category: CostCategory;

  @ApiProperty({ example: '钢筋采购' })
  @IsString()
  costName: string;

  @ApiProperty({ example: 420000 })
  @IsNumber()
  @Min(0)
  budgetAmount: number;

  @ApiProperty({ example: 432000 })
  @IsNumber()
  @Min(0)
  actualAmount: number;

  @ApiProperty({ example: '2026-06-12' })
  @IsDateString()
  occurredAt: string;

  @ApiProperty({ example: 'VOUCHER-20260612-001' })
  @IsString()
  voucherNo: string;

  @ApiPropertyOptional({ example: '4d5eb37e-02c2-4d6e-a715-6cdcc6c52362' })
  @IsOptional()
  @IsUUID()
  materialUsageId?: string;

  @ApiPropertyOptional({ example: '4d5eb37e-02c2-4d6e-a715-6cdcc6c52363' })
  @IsOptional()
  @IsUUID()
  laborTimeRecordId?: string;
}

export class MarkCostExceptionDto {
  @ApiProperty({ example: '实际金额超预算超过审批阈值' })
  @IsString()
  reason: string;
}
