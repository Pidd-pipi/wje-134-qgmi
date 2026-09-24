import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('健康检查')
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string; service: string; timestamp: string } {
    return {
      status: 'ok',
      service: 'cost-control-api',
      timestamp: new Date().toISOString()
    };
  }
}
