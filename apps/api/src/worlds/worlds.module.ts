import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { WorldsController } from './worlds.controller.js';
import { WorldsService } from './worlds.service.js';

/** Worlds: a name, a photo, and later the words found in it (FR-010–FR-017). */
@Module({
  imports: [PrismaModule, StorageModule, AuthModule],
  controllers: [WorldsController],
  providers: [WorldsService],
})
export class WorldsModule {}
