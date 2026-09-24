import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { ReportPeriod, ReportType } from '../../types/enums';

export class GenerateReportDto {
  @ApiProperty({ example: '4d5eb37e-02c2-4d6e-a715-6cdcc6c52361' })
  @IsUUID()
  projectId: string;

  @ApiProperty({ enum: ReportPeriod, example: ReportPeriod.Monthly })
  @IsEnum(ReportPeriod)
  period: ReportPeriod;

  @ApiProperty({ enum: ReportType, example: ReportType.Monthly })
  @IsEnum(ReportType)
  reportType: ReportType;
}
