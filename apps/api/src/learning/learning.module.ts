import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { AttemptsService } from './attempts.service.js';
import { SessionsController } from './sessions.controller.js';
import { SessionsService } from './sessions.service.js';

/**
 * Practice: sessions, the questions they ask, and what the learner's answers do to
 * their mastery and XP (FR-030–FR-042, FR-060).
 */
@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [SessionsController],
  providers: [SessionsService, AttemptsService],
})
export class LearningModule {}
