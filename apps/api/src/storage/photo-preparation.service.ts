import { HttpStatus, Injectable } from '@nestjs/common';
import sharp, { type Sharp } from 'sharp';
import { AppError } from '../platform/errors/app-error.js';
import { ErrorCode } from '../platform/errors/error-codes.js';

/** Only these three, decided by the file's content rather than its name (FR-011). */
const ACCEPTED_FORMATS = ['jpeg', 'png', 'webp'];

/** The longest side of a stored photo (V18). */
export const MAX_PHOTO_SIDE = 2048;

/** The longest side of the copy the world list shows (FR-013). */
export const THUMBNAIL_SIDE = 320;

/** Everything stored is JPEG, so one format is served, sent to AI, and measured. */
export const PHOTO_CONTENT_TYPE = 'image/jpeg';

export interface PreparedImage {
  data: Buffer;
  contentType: string;
  width: number;
  height: number;
  byteSize: number;
}

export interface PreparedPhoto {
  prepared: PreparedImage;
  thumbnail: PreparedImage;
}

/**
 * Turns an uploaded file into what LanguZe stores (FR-017).
 *
 * Three things happen before anything is written down, and all three matter:
 * the orientation recorded by the camera is applied to the pixels, every piece of
 * metadata is dropped — including the place the photo was taken — and the image is
 * scaled so its longer side is at most 2,048 pixels (V18). Only the result is stored,
 * shown, and sent to an AI provider, so the original never leaves this service.
 */
@Injectable()
export class PhotoPreparationService {
  async prepare(upload: Buffer): Promise<PreparedPhoto> {
    const source = sharp(upload, { failOn: 'error' });
    const { format } = await this.describe(source);

    if (!ACCEPTED_FORMATS.includes(format)) {
      throw new AppError(
        ErrorCode.PHOTO_TYPE_NOT_ALLOWED,
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        'Only JPEG, PNG, and WebP photos can be used.',
      );
    }

    return {
      prepared: await this.render(upload, MAX_PHOTO_SIDE, 82),
      thumbnail: await this.render(upload, THUMBNAIL_SIDE, 70),
    };
  }

  private async describe(image: Sharp): Promise<{ format: string }> {
    try {
      const { format } = await image.metadata();
      return { format: format ?? '' };
    } catch {
      // Not an image at all, or one too damaged to read.
      throw new AppError(
        ErrorCode.PHOTO_TYPE_NOT_ALLOWED,
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        'This file could not be read as a photo.',
      );
    }
  }

  /**
   * `rotate()` without an angle applies the EXIF orientation to the pixels, and sharp
   * writes no metadata unless asked, so nothing from the original survives here.
   */
  private async render(
    upload: Buffer,
    longestSide: number,
    quality: number,
  ): Promise<PreparedImage> {
    const { data, info } = await sharp(upload)
      .rotate()
      .resize({
        width: longestSide,
        height: longestSide,
        fit: 'inside',
        // A small photo stays small; scaling it up would invent detail.
        withoutEnlargement: true,
      })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });

    return {
      data,
      contentType: PHOTO_CONTENT_TYPE,
      width: info.width,
      height: info.height,
      byteSize: data.byteLength,
    };
  }
}
