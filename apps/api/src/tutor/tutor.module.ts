import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TutorToolsService } from './tutor-tools.service.js';
import { TutorController } from './tutor.controller.js';
import { TutorService } from './tutor.service.js';

/** The AI tutor: one conversation per learner (FR-070–FR-076). */
@Module({
  imports: [PrismaModule],
  controllers: [TutorController],
  providers: [TutorService, TutorToolsService],
  exports: [TutorService, TutorToolsService],
})
export class TutorModule {}
