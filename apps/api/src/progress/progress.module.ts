import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ProgressController } from './progress.controller.js';
import { ProgressService } from './progress.service.js';

/** What the learner has to show for their practice (FR-060, FR-061). */
@Module({
  imports: [PrismaModule],
  controllers: [ProgressController],
  providers: [ProgressService],
})
export class ProgressModule {}
