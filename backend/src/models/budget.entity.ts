import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { CostItem } from './costItem.entity';
import { BudgetStatus, Currency } from '../types/enums';

@Entity({ name: 'project_budgets' })
export class ProjectBudget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @Column({ name: 'budget_name', type: 'varchar', length: 160 })
  budgetName: string;

  @Column({ name: 'total_amount', type: 'numeric', precision: 14, scale: 2 })
  totalAmount: string;

  @Column({ name: 'used_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  usedAmount: string;

  @Column({ name: 'reserved_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  reservedAmount: string;

  @Column({ type: 'enum', enum: Currency, default: Currency.CNY })
  currency: Currency;

  @Column({ type: 'enum', enum: BudgetStatus, default: BudgetStatus.Draft })
  status: BudgetStatus;

  @Column({ name: 'approver_id', type: 'uuid', nullable: true })
  approverId?: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  remark?: string | null;

  @OneToMany(() => CostItem, (costItem) => costItem.budget)
  costItems: CostItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
