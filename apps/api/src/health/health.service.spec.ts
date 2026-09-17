import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  const prisma = { $queryRaw: vi.fn() };
  let service: HealthService;

  beforeEach(async () => {
    prisma.$queryRaw.mockReset();

    const moduleRef = await Test.createTestingModule({
      providers: [HealthService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(HealthService);
  });

  it('reports ok when the database answers', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });
  });

  it('reports an error when the database query fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(service.check()).resolves.toEqual({
      status: 'error',
      database: 'down',
    });
  });
});
