import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { ProjectBudget } from './budget.entity';
import { CostCategory, CostItemStatus } from '../types/enums';

@Entity({ name: 'cost_items' })
export class CostItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'budget_id', type: 'uuid' })
  budgetId: string;

  @ManyToOne(() => ProjectBudget, (budget) => budget.costItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'budget_id' })
  budget: ProjectBudget;

  @Column({ type: 'enum', enum: CostCategory })
  category: CostCategory;

  @Column({ name: 'cost_name', type: 'varchar', length: 180 })
  costName: string;

  @Column({ name: 'budget_amount', type: 'numeric', precision: 14, scale: 2 })
  budgetAmount: string;

  @Column({ name: 'actual_amount', type: 'numeric', precision: 14, scale: 2 })
  actualAmount: string;

  @Column({ name: 'variance_amount', type: 'numeric', precision: 14, scale: 2 })
  varianceAmount: string;

  @Column({ name: 'occurred_at', type: 'date' })
  occurredAt: string;

  @Column({ name: 'voucher_no', type: 'varchar', length: 80 })
  voucherNo: string;

  @Column({ name: 'material_usage_id', type: 'uuid', nullable: true })
  materialUsageId?: string | null;

  @Column({ name: 'labor_time_record_id', type: 'uuid', nullable: true })
  laborTimeRecordId?: string | null;

  @Column({ type: 'enum', enum: CostItemStatus, default: CostItemStatus.Normal })
  status: CostItemStatus;

  @Column({ name: 'exception_reason', type: 'text', nullable: true })
  exceptionReason?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
