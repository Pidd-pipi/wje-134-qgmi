import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { databaseConfig } from '../../config/database.config';
import { Role } from '../../models/role.entity';
import { UserRole } from '../../types/enums';

const rolePermissions: Record<UserRole, string[]> = {
  [UserRole.Admin]: ['*'],
  [UserRole.FinanceManager]: ['budget:review', 'change-order:review', 'report:generate', 'cost-item:review'],
  [UserRole.ProjectManager]: ['budget:create', 'budget:submit', 'change-order:create', 'change-order:submit', 'report:view'],
  [UserRole.Accountant]: ['cost-item:create', 'cost-item:review', 'report:view'],
  [UserRole.Viewer]: ['budget:view', 'cost-item:view', 'change-order:view', 'report:view']
};

async function seed(): Promise<void> {
  const dataSource = new DataSource(databaseConfig() as DataSourceOptions);
  await dataSource.initialize();
  const roleRepository = dataSource.getRepository(Role);

  for (const [name, permissions] of Object.entries(rolePermissions)) {
    const existing = await roleRepository.findOne({ where: { name: name as UserRole } });
    await roleRepository.save({
      id: existing?.id,
      name: name as UserRole,
      permissions
    });
  }

  await dataSource.destroy();
}

void seed();
