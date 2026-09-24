import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { PhotoStorage, type PhotoUpload } from './photo-storage.js';

/**
 * Photo storage on any S3-compatible service (A3): Cloudflare R2 in production and
 * SeaweedFS in Docker locally, which is why the endpoint and the credentials are
 * configuration rather than code.
 *
 * Path-style addressing is used throughout. R2 accepts it, SeaweedFS requires it, and
 * it keeps one code path for both.
 */
@Injectable()
export class S3PhotoStorage extends PhotoStorage implements OnModuleInit {
  private readonly logger = new Logger(S3PhotoStorage.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly linkTtlSeconds: number;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super();
    this.bucket = config.get('STORAGE_BUCKET', { infer: true });
    this.linkTtlSeconds = config.get('PHOTO_LINK_TTL_SECONDS', { infer: true });
    this.client = new S3Client({
      endpoint: config.get('STORAGE_ENDPOINT', { infer: true }),
      // R2 has one region, named `auto`; SeaweedFS ignores the value but needs one.
      region: config.get('STORAGE_REGION', { infer: true }),
      credentials: {
        accessKeyId: config.get('STORAGE_ACCESS_KEY_ID', { infer: true }),
        secretAccessKey: config.get('STORAGE_SECRET_ACCESS_KEY', {
          infer: true,
        }),
      },
      forcePathStyle: true,
      /*
       * The SDK otherwise adds integrity checksums that some S3-compatible services
       * reject outright, which would make every upload fail against the local store
       * while working against R2. Only what a request actually needs is sent.
       */
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  /**
   * Creates the bucket when it is missing, which is what a fresh development machine
   * or a CI run needs. In production the bucket exists and the credentials may not be
   * allowed to create one, so a failure is logged rather than fatal: photo storage
   * being unreachable at startup must not stop the API from serving everything else.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(
          new CreateBucketCommand({ Bucket: this.bucket }),
        );
        this.logger.log(`Created photo storage bucket "${this.bucket}"`);
      } catch (error) {
        this.logger.warn(
          `Photo storage bucket "${this.bucket}" is not reachable: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  async store({ key, body, contentType }: PhotoUpload): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async read(key: string): Promise<Buffer> {
    const answer = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const bytes = await answer.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Photo storage returned nothing for ${key}`);
    return Buffer.from(bytes);
  }

  async remove(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  /** A link to one object that stops working after a few minutes (P4). */
  signedLink(key: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: this.linkTtlSeconds },
    );
  }
}
