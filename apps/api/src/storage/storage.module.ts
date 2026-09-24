import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PhotoCleanupService } from './photo-cleanup.service.js';
import { PhotoPreparationService } from './photo-preparation.service.js';
import { PhotoStorage } from './photo-storage.js';
import { S3PhotoStorage } from './s3-photo-storage.js';

/**
 * Prepared photos and the object store that holds them (A3, FR-017, NFR-009).
 * The module owns the files; the rows that point at them belong to the domains that
 * create them, which is why the cleanup records are written by those transactions and
 * only removed here.
 */
@Module({
  imports: [PrismaModule],
  providers: [
    { provide: PhotoStorage, useClass: S3PhotoStorage },
    PhotoPreparationService,
    PhotoCleanupService,
  ],
  exports: [PhotoStorage, PhotoPreparationService],
})
export class StorageModule {}
