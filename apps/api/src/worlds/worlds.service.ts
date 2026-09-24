import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service.js';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { PhotoDeletionReason } from '../generated/prisma/enums.js';
import type {
  StoredPhotoModel,
  VocabularyWordModel,
  WordOccurrenceModel,
  WorldModel,
} from '../generated/prisma/models.js';
import { AppError } from '../platform/errors/app-error.js';
import { ErrorCode } from '../platform/errors/error-codes.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  PhotoPreparationService,
  type PreparedImage,
} from '../storage/photo-preparation.service.js';
import { PhotoStorage, newStorageKey } from '../storage/photo-storage.js';
import { AnalysisService } from './analysis.service.js';
import type {
  WorldDetailDto,
  WorldStatusDto,
  WorldSummaryDto,
} from './dto/worlds.dto.js';

/** The largest upload accepted, before preparation shrinks it (FR-011). */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/** What the file interceptor hands over, typed here so multer's types are not needed. */
export interface UploadedPhoto {
  buffer: Buffer;
  size: number;
}

type WorldWithPhotos = WorldModel & {
  photo: StoredPhotoModel | null;
  thumbnail: StoredPhotoModel | null;
  occurrences?: (WordOccurrenceModel & {
    vocabularyWord: VocabularyWordModel;
  })[];
};

/** A world with everything the detail and the list need, in one query. */
const WITH_PHOTOS_AND_WORDS = {
  photo: true,
  thumbnail: true,
  occurrences: {
    include: { vocabularyWord: true },
    orderBy: { createdAt: 'asc' },
  },
} as const;

@Injectable()
export class WorldsService {
  private readonly worldLimit: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PhotoStorage,
    private readonly preparation: PhotoPreparationService,
    private readonly auth: AuthService,
    private readonly analysis: AnalysisService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.worldLimit = config.get('WORLD_LIMIT', { infer: true });
  }

  /**
   * Creates a world from an uploaded photo (FR-010–FR-012, FR-017).
   *
   * The file is prepared first and the original is never stored (FR-017). The two
   * objects go to storage before the rows exist, because a row pointing at a file
   * that failed to upload would be a broken world; if the rows then fail to write,
   * the files are recorded for cleanup rather than left behind (NFR-009).
   */
  async create(
    learnerId: string,
    name: string,
    upload: UploadedPhoto | undefined,
  ): Promise<WorldDetailDto> {
    if (!upload) {
      throw new AppError(
        ErrorCode.VALIDATION_FAILED,
        HttpStatus.BAD_REQUEST,
        'A photo is required.',
        { fields: { photo: 'A photo is required.' } },
      );
    }
    await this.requireVerified(learnerId);
    await this.requireRoomForAnotherWorld(learnerId);

    const { prepared, thumbnail } = await this.preparation.prepare(
      upload.buffer,
    );
    /*
     * The analysis is taken before anything is stored, so a learner who has used
     * their ten for today is refused without a world or a photo being left behind
     * (FR-020). It is given back below if the world cannot be created.
     */
    const analysisId = await this.analysis.take(learnerId);
    const photoKey = newStorageKey('PREPARED');
    const thumbnailKey = newStorageKey('THUMBNAIL');
    await this.storage.store({
      key: photoKey,
      body: prepared.data,
      contentType: prepared.contentType,
    });
    await this.storage.store({
      key: thumbnailKey,
      body: thumbnail.data,
      contentType: thumbnail.contentType,
    });

    try {
      const world = await this.prisma.$transaction(async (tx) => {
        const photoRow = await tx.storedPhoto.create({
          data: this.photoRow(learnerId, photoKey, 'PREPARED', prepared),
        });
        const thumbnailRow = await tx.storedPhoto.create({
          data: this.photoRow(learnerId, thumbnailKey, 'THUMBNAIL', thumbnail),
        });
        return tx.world.create({
          data: {
            learnerId,
            name,
            photoId: photoRow.id,
            thumbnailId: thumbnailRow.id,
          },
          include: WITH_PHOTOS_AND_WORDS,
        });
      });

      // The learner is answered now; the words arrive later (P2, FR-021).
      await this.analysis.begin(analysisId, world.id, photoKey);
      return await this.detailOf(world);
    } catch (error) {
      await this.analysis.release(analysisId);
      await this.prisma.photoDeletion.createMany({
        data: [photoKey, thumbnailKey].map((storageKey) => ({
          storageKey,
          reason: PhotoDeletionReason.UPLOAD_FAILED,
        })),
      });
      throw error;
    }
  }

  /** The learner's worlds, newest first (FR-013). */
  async list(learnerId: string): Promise<WorldSummaryDto[]> {
    const worlds = await this.prisma.world.findMany({
      where: { learnerId },
      orderBy: { createdAt: 'desc' },
      include: WITH_PHOTOS_AND_WORDS,
    });

    return Promise.all(worlds.map((world) => this.summaryOf(world)));
  }

  /** One world with its photo (FR-014). */
  async get(learnerId: string, worldId: string): Promise<WorldDetailDto> {
    return this.detailOf(await this.own(learnerId, worldId));
  }

  /** Status alone, which the waiting page asks for repeatedly (FR-021, P3). */
  async status(learnerId: string, worldId: string): Promise<WorldStatusDto> {
    const world = await this.own(learnerId, worldId);
    return { status: world.status, failureReason: world.failureReason };
  }

  /** Renames a world (FR-016). */
  async rename(
    learnerId: string,
    worldId: string,
    name: string,
  ): Promise<WorldDetailDto> {
    await this.own(learnerId, worldId);
    const world = await this.prisma.world.update({
      where: { id: worldId },
      data: { name },
      include: WITH_PHOTOS_AND_WORDS,
    });
    return this.detailOf(world);
  }

  /**
   * Deletes a world and leaves its photos for the cleanup task (FR-015, NFR-009).
   *
   * The rows and the cleanup records are written together, so a photo can never be
   * orphaned in storage: the record exists exactly when a file still has to go.
   */
  async remove(learnerId: string, worldId: string): Promise<void> {
    const world = await this.own(learnerId, worldId);
    const photos = [world.photo, world.thumbnail].filter(
      (photo): photo is StoredPhotoModel => photo !== null,
    );

    await this.prisma.$transaction([
      this.prisma.photoDeletion.createMany({
        data: photos.map((photo) => ({
          storageKey: photo.storageKey,
          reason: PhotoDeletionReason.WORLD_DELETED,
        })),
      }),
      this.prisma.world.delete({ where: { id: worldId } }),
      this.prisma.storedPhoto.deleteMany({
        where: { id: { in: photos.map((photo) => photo.id) } },
      }),
    ]);
  }

  /**
   * The learner's own world, or nothing. Another learner's world answers NOT_FOUND
   * rather than FORBIDDEN, so the API never confirms that it exists (FR-008).
   */
  private async own(
    learnerId: string,
    worldId: string,
  ): Promise<WorldWithPhotos> {
    const world = await this.prisma.world.findFirst({
      where: { id: worldId, learnerId },
      include: WITH_PHOTOS_AND_WORDS,
    });
    if (!world) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        HttpStatus.NOT_FOUND,
        'This world does not exist.',
      );
    }
    return world;
  }

  /** Photo analysis is an AI feature, so it needs a verified account (FR-006). */
  private async requireVerified(learnerId: string): Promise<void> {
    if (await this.auth.isVerifiedForAi(learnerId)) return;

    throw new AppError(
      ErrorCode.NOT_VERIFIED,
      HttpStatus.FORBIDDEN,
      'Verify your email address to analyse photos.',
    );
  }

  private async requireRoomForAnotherWorld(learnerId: string): Promise<void> {
    const worlds = await this.prisma.world.count({ where: { learnerId } });
    if (worlds < this.worldLimit) return;

    throw new AppError(
      ErrorCode.WORLD_LIMIT_REACHED,
      HttpStatus.CONFLICT,
      `A learner can have ${this.worldLimit} worlds. Delete one to make room.`,
      { limit: this.worldLimit },
    );
  }

  private photoRow(
    ownerId: string,
    storageKey: string,
    kind: 'PREPARED' | 'THUMBNAIL',
    image: PreparedImage,
  ) {
    return {
      ownerId,
      storageKey,
      kind,
      contentType: image.contentType,
      width: image.width,
      height: image.height,
      byteSize: image.byteSize,
    };
  }

  private async summaryOf(world: WorldWithPhotos): Promise<WorldSummaryDto> {
    return {
      id: world.id,
      name: world.name,
      status: world.status,
      failureReason: world.failureReason,
      thumbnailUrl: await this.linkTo(world.thumbnail),
      wordCount: world.occurrences?.length ?? 0,
      // Mastery arrives with the game; until then nothing has been learned yet.
      masteredCount: 0,
      createdAt: world.createdAt.toISOString(),
    };
  }

  private async detailOf(world: WorldWithPhotos): Promise<WorldDetailDto> {
    return {
      ...(await this.summaryOf(world)),
      photoUrl: await this.linkTo(world.photo),
      words: (world.occurrences ?? []).map((occurrence) => ({
        id: occurrence.id,
        english: occurrence.vocabularyWord.english,
        thaiMeaning: occurrence.vocabularyWord.thaiMeaning,
        exampleSentence: occurrence.exampleSentence,
        cefrLevel: occurrence.cefrLevel,
        box: {
          x: occurrence.boxX,
          y: occurrence.boxY,
          width: occurrence.boxWidth,
          height: occurrence.boxHeight,
        },
        // The game has not been built yet, so nothing has a mastery level.
        mastery: 'NEW',
      })),
    };
  }

  /**
   * Removes one word from a world (FR-026, FR-027). The last word cannot go: a
   * world with no words is nothing to practise, so the learner deletes it instead
   * (V5). The word itself is deleted when this was its last occurrence, which takes
   * its mastery and mistakes with it.
   */
  async removeWord(
    learnerId: string,
    worldId: string,
    occurrenceId: string,
  ): Promise<void> {
    await this.own(learnerId, worldId);

    await this.prisma.$transaction(async (tx) => {
      const occurrence = await tx.wordOccurrence.findFirst({
        where: { id: occurrenceId, worldId },
      });
      if (!occurrence) {
        throw new AppError(
          ErrorCode.NOT_FOUND,
          HttpStatus.NOT_FOUND,
          'This word is not in this world.',
        );
      }

      const left = await tx.wordOccurrence.count({ where: { worldId } });
      if (left <= 1) {
        throw new AppError(
          ErrorCode.LAST_WORD,
          HttpStatus.CONFLICT,
          'A world keeps at least one word. Delete the world instead.',
        );
      }

      await tx.wordOccurrence.delete({ where: { id: occurrenceId } });

      const elsewhere = await tx.wordOccurrence.count({
        where: { vocabularyWordId: occurrence.vocabularyWordId },
      });
      if (elsewhere === 0) {
        await tx.vocabularyWord.delete({
          where: { id: occurrence.vocabularyWordId },
        });
      }
    });
  }

  /** A link only this learner can use, and only for a few minutes (P4, NFR-008). */
  private linkTo(photo: StoredPhotoModel | null): Promise<string | null> {
    return photo
      ? this.storage.signedLink(photo.storageKey)
      : Promise.resolve(null);
  }
}
