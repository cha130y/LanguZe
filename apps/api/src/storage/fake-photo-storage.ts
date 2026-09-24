import { PhotoStorage, type PhotoUpload } from './photo-storage.js';

/**
 * Photo storage in memory, for tests that care about what was stored rather than
 * about talking to an object store. The storage e2e tests use the real adapter.
 */
export class FakePhotoStorage extends PhotoStorage {
  readonly objects = new Map<string, PhotoUpload>();
  /** Keys that fail on purpose, so retry behaviour can be tested. */
  readonly failing = new Set<string>();

  store(upload: PhotoUpload): Promise<void> {
    this.objects.set(upload.key, upload);
    return Promise.resolve();
  }

  read(key: string): Promise<Buffer> {
    const stored = this.objects.get(key);
    if (!stored) return Promise.reject(new Error(`No photo at ${key}`));
    return Promise.resolve(stored.body);
  }

  remove(key: string): Promise<void> {
    if (this.failing.has(key)) {
      return Promise.reject(new Error(`storage refused to delete ${key}`));
    }
    this.objects.delete(key);
    return Promise.resolve();
  }

  signedLink(key: string): Promise<string> {
    return Promise.resolve(`https://photos.test/${key}?signature=fake`);
  }
}
