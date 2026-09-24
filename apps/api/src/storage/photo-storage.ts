import { randomUUID } from 'node:crypto';
import type { PhotoKind } from '../generated/prisma/enums.js';

/** A file on its way into photo storage. */
export interface PhotoUpload {
  key: string;
  body: Buffer;
  contentType: string;
}

/**
 * Where prepared photos live (A3). The interface is what the rest of the API sees, so
 * the object store behind it — Cloudflare R2 in production, SeaweedFS locally — is one
 * adapter away. The abstract class is also the injection token, as with `MailSender`.
 *
 * Photos are private: nothing is ever served from a public URL. A browser receives a
 * link that works for a few minutes and only for one object (P4, NFR-008).
 */
export abstract class PhotoStorage {
  abstract store(upload: PhotoUpload): Promise<void>;
  /** The bytes back, which the analysis needs to send the photo to an AI provider. */
  abstract read(key: string): Promise<Buffer>;
  abstract remove(key: string): Promise<void>;
  abstract signedLink(key: string): Promise<string>;
}

/**
 * The key of a new object. Random, and never built from the learner, the world, or the
 * file name: a key that could be guessed from such data would let one learner ask for
 * another's photo, and the key of a deleted account's photo would still describe it.
 */
export function newStorageKey(kind: PhotoKind, extension = 'jpg'): string {
  return `${kind.toLowerCase()}/${randomUUID()}.${extension}`;
}
