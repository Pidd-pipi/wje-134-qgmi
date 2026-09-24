import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Currency } from '../../types/enums';

export class CreateBudgetDto {
  @ApiProperty({ example: '4d5eb37e-02c2-4d6e-a715-6cdcc6c52361' })
  @IsUUID()
  projectId: string;

  @ApiProperty({ example: '一期主体结构预算' })
  @IsString()
  budgetName: string;

  @ApiProperty({ example: 1250000 })
  @IsNumber()
  @Min(0)
  totalAmount: number;

  @ApiPropertyOptional({ example: 80000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  reservedAmount?: number;

  @ApiPropertyOptional({ enum: Currency, default: Currency.CNY })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({ example: '含钢筋、水泥和模板工程预算' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class ReviewBudgetDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  approved: boolean;

  @ApiPropertyOptional({ example: '预算依据充分，审批通过' })
  @IsOptional()
  @IsString()
  remark?: string;
}
