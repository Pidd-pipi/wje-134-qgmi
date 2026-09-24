import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ReportPeriod, ReportType } from '../types/enums';

@Entity({ name: 'cost_reports' })
export class CostReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Column({ type: 'enum', enum: ReportPeriod })
  period: ReportPeriod;

  @Column({ type: 'enum', enum: ReportType })
  reportType: ReportType;

  @Column({ name: 'labor_cost_total', type: 'numeric', precision: 14, scale: 2, default: 0 })
  laborCostTotal: string;

  @Column({ name: 'material_cost_total', type: 'numeric', precision: 14, scale: 2, default: 0 })
  materialCostTotal: string;

  @Column({ name: 'equipment_cost_total', type: 'numeric', precision: 14, scale: 2, default: 0 })
  equipmentCostTotal: string;

  @Column({ name: 'other_cost_total', type: 'numeric', precision: 14, scale: 2, default: 0 })
  otherCostTotal: string;

  @Column({ name: 'total_cost', type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalCost: string;

  @Column({ name: 'profit_loss_analysis', type: 'text' })
  profitLossAnalysis: string;

  @Column({ name: 'generated_at', type: 'timestamptz' })
  generatedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
