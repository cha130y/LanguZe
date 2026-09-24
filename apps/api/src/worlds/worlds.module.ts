import { forwardRef, Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { AnalysisService } from './analysis.service.js';
import { StaleAnalysisService } from './stale-analysis.service.js';
import { WorldsController } from './worlds.controller.js';
import { WorldsService } from './worlds.service.js';

/** Worlds: a name, a photo, and later the words found in it (FR-010–FR-017). */
@Module({
  imports: [
    PrismaModule,
    StorageModule,
    forwardRef(() => AuthModule),
    AiModule,
  ],
  controllers: [WorldsController],
  providers: [WorldsService, AnalysisService, StaleAnalysisService],
  exports: [AnalysisService],
})
export class WorldsModule {}
