import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { FakeMailSender } from '../src/notifications/fake-mail-sender.js';
import { MailSender } from '../src/notifications/mail-sender.js';
import { PhotoStorage, newStorageKey } from '../src/storage/photo-storage.js';

/*
 * The storage adapter against a real S3 service — SeaweedFS from docker-compose,
 * standing in for Cloudflare R2 (A3). Signing, path-style addressing and the
 * checksum behaviour of the SDK can only be proven against a server, not a fake.
 */
// Requires docker-compose's `storage` service (see docs/deployment/local-development.md).
describe('Photo storage (e2e)', () => {
  let app: NestExpressApplication;
  let storage: PhotoStorage;
  let photo: Buffer;
  const keys: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailSender)
      .useValue(new FakeMailSender())
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
      bodyParser: false,
    });
    configureApp(app);
    await app.init();
    storage = app.get(PhotoStorage);

    photo = await sharp({
      create: {
        width: 40,
        height: 30,
        channels: 3,
        background: { r: 10, g: 120, b: 200 },
      },
    })
      .jpeg()
      .toBuffer();
  });

  afterAll(async () => {
    await Promise.all(keys.map((key) => storage.remove(key).catch(() => {})));
    await app.close();
  });

  const store = async () => {
    const key = newStorageKey('PREPARED');
    keys.push(key);
    await storage.store({ key, body: photo, contentType: 'image/jpeg' });
    return key;
  };

  it('stores a photo and hands back exactly those bytes', async () => {
    const key = await store();

    const response = await fetch(await storage.signedLink(key));

    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(photo);
  });

  /** Nothing is public: the link carries a signature and stops working (P4, NFR-008). */
  it('signs the link and gives it an expiry', async () => {
    const link = new URL(await storage.signedLink(await store()));

    expect(link.searchParams.get('X-Amz-Signature')).toBeTruthy();
    expect(Number(link.searchParams.get('X-Amz-Expires'))).toBeGreaterThan(0);
  });

  it('refuses a link whose signature was tampered with', async () => {
    const link = new URL(await storage.signedLink(await store()));
    link.searchParams.set('X-Amz-Signature', '0'.repeat(64));

    const response = await fetch(link);

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('removes a photo, after which the link gives nothing', async () => {
    const key = await store();
    const link = await storage.signedLink(key);

    await storage.remove(key);

    expect((await fetch(link)).status).toBe(404);
  });

  /** The cleanup task retries, so removing something already gone must not throw. */
  it('is content when the object is already gone', async () => {
    await expect(
      storage.remove(newStorageKey('PREPARED')),
    ).resolves.not.toThrow();
  });
});
