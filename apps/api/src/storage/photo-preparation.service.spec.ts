import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { AppError } from '../platform/errors/app-error.js';
import {
  MAX_PHOTO_SIDE,
  PhotoPreparationService,
  THUMBNAIL_SIDE,
} from './photo-preparation.service.js';

const service = new PhotoPreparationService();

/** A photo of the given size, as a camera would hand it over. */
const photo = (
  width: number,
  height: number,
  options: { format?: 'jpeg' | 'png' | 'webp'; orientation?: number } = {},
) => {
  const image = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 180, g: 90, b: 40 },
    },
  });
  const withMetadata = options.orientation
    ? image.withMetadata({ orientation: options.orientation })
    : image;
  return withMetadata.toFormat(options.format ?? 'jpeg').toBuffer();
};

describe('preparing an uploaded photo (FR-017)', () => {
  let large: Buffer;

  beforeAll(async () => {
    large = await photo(4000, 3000);
  });

  it('scales the longer side down to 2,048 pixels (V18)', async () => {
    const { prepared } = await service.prepare(large);

    expect(prepared.width).toBe(MAX_PHOTO_SIDE);
    expect(prepared.height).toBe(1536);
    expect(prepared.byteSize).toBeLessThan(large.byteLength);
  });

  it('leaves a smaller photo at its own size', async () => {
    const { prepared } = await service.prepare(await photo(800, 600));

    expect(prepared.width).toBe(800);
    expect(prepared.height).toBe(600);
  });

  it('makes a thumbnail for the world list (FR-013)', async () => {
    const { thumbnail } = await service.prepare(large);

    expect(thumbnail.width).toBe(THUMBNAIL_SIDE);
    expect(thumbnail.byteSize).toBeLessThan(50_000);
  });

  /*
   * A photo taken in portrait carries its rotation as metadata; applying it to the
   * pixels is what makes the picture appear the right way up everywhere, including
   * where a highlight box will later be drawn on it.
   */
  it('applies the camera orientation to the pixels', async () => {
    const { prepared } = await service.prepare(
      await photo(1000, 500, { orientation: 6 }),
    );

    expect(prepared.width).toBe(500);
    expect(prepared.height).toBe(1000);
  });

  /** The place a photo was taken must not survive the upload (FR-017, PDPA). */
  it('removes every piece of metadata, including where it was taken', async () => {
    const withExif = await sharp(await photo(600, 400))
      .withExif({
        IFD0: { Copyright: 'Nok' },
        IFD2: { GPSLatitude: '13/1 45/1 0/1', GPSLongitude: '100/1 30/1 0/1' },
      })
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    const { prepared, thumbnail } = await service.prepare(withExif);

    expect((await sharp(prepared.data).metadata()).exif).toBeUndefined();
    expect((await sharp(thumbnail.data).metadata()).exif).toBeUndefined();
  });

  it.each(['png', 'webp'] as const)('accepts %s as well', async (format) => {
    const { prepared } = await service.prepare(
      await photo(100, 100, { format }),
    );

    // Everything is stored as JPEG, so one format is served and sent to AI.
    expect(prepared.contentType).toBe('image/jpeg');
  });

  /** FR-011: the type is decided by the content, so a renamed file is still refused. */
  it('refuses a file that is not a photo', async () => {
    await expect(
      service.prepare(Buffer.from('This is a text file, not a photo.')),
    ).rejects.toThrow(AppError);
  });

  it('refuses an image format LanguZe does not accept', async () => {
    const tiff = await sharp({
      create: {
        width: 50,
        height: 50,
        channels: 3,
        background: { r: 1, g: 2, b: 3 },
      },
    })
      .tiff()
      .toBuffer();

    await expect(service.prepare(tiff)).rejects.toThrow(AppError);
  });
});
