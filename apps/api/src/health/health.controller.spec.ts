import { Test } from '@nestjs/testing';
import { AppError } from '../platform/errors/app-error.js';
import { ErrorCode } from '../platform/errors/error-codes.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

describe('HealthController', () => {
  const healthService = { check: vi.fn() };
  let controller: HealthController;

  beforeEach(async () => {
    healthService.check.mockReset();

    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: healthService }],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it('returns the health report when everything is up', async () => {
    healthService.check.mockResolvedValue({ status: 'ok', database: 'up' });

    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });
  });

  it('responds 503 SERVICE_UNAVAILABLE with the report when a dependency is down', async () => {
    healthService.check.mockResolvedValue({
      status: 'error',
      database: 'down',
    });

    const error = await controller.check().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      code: ErrorCode.SERVICE_UNAVAILABLE,
      details: { status: 'error', database: 'down' },
    });
    expect((error as AppError).getStatus()).toBe(503);
  });
});
