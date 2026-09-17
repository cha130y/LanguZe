import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
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

  it('responds 503 when a dependency is down', async () => {
    healthService.check.mockResolvedValue({
      status: 'error',
      database: 'down',
    });

    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
