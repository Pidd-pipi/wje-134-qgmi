import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../models/auditLog.entity';
import { AuditAction } from '../types/enums';
import { AuthenticatedUser } from '../types/interfaces';

interface WriteAuditLogInput {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  user?: AuthenticatedUser;
  requestId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>
  ) {}

  async write(input: WriteAuditLogInput): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create({
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      actorId: input.user?.id ?? null,
      actorRole: input.user?.role ?? null,
      requestId: input.requestId ?? null,
      ipAddress: input.ipAddress ?? null,
      metadata: input.metadata ?? {}
    });

    return this.auditLogRepository.save(auditLog);
  }
}
