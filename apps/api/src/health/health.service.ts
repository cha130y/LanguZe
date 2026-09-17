import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthResponseDto } from './health-response.dto.js';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthResponseDto> {
    const databaseUp = await this.isDatabaseUp();

    return {
      status: databaseUp ? 'ok' : 'error',
      database: databaseUp ? 'up' : 'down',
    };
  }

  private async isDatabaseUp(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      // Log only the error code/name: Prisma messages are multi-line and may include query text.
      const code = (error as { code?: unknown } | null)?.code;
      const reason =
        typeof code === 'string'
          ? code
          : error instanceof Error
            ? error.name
            : 'unknown error';
      this.logger.warn(`Database health check failed: ${reason}`);
      return false;
    }
  }
}
