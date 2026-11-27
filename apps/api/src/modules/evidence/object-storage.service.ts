import { Inject, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPPORTED_EVIDENCE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
  'video/mp4',
  'video/quicktime',
] as const;
export const SUPABASE_STORAGE_CLIENT_FACTORY = Symbol('SUPABASE_STORAGE_CLIENT_FACTORY');
type ClientFactory = (url: string, key: string) => SupabaseClient;

@Injectable()
export abstract class ObjectStorageService {
  abstract checkHealth(): Promise<void>;
  abstract get bucket(): string;
  abstract get maxFileBytes(): number;
  abstract get retentionDays(): number;
  abstract createSignedUpload(
    path: string,
  ): Promise<{ bucket: string; objectPath: string; uploadToken: string; signedUploadUrl: string }>;
  abstract createSignedUploadUrl(path: string): Promise<Record<string, string>>;
  abstract createDownload(path: string, expiresInSeconds?: number): Promise<string>;
  abstract download(path: string): Promise<Buffer>;
  abstract createSignedDownload(path: string, expiresInSeconds?: number): Promise<string>;
  abstract move(source: string, destination: string): Promise<void>;
  abstract remove(path: string): Promise<void>;
  abstract uploadDerived(path: string, bytes: Buffer, contentType: string): Promise<void>;
}

@Injectable()
export class SupabaseObjectStorageAdapter extends ObjectStorageService {
  private readonly client?: SupabaseClient;
  readonly bucket: string;
  private verifiedBucketUntil = 0;

  constructor(
    private readonly config: ConfigService,
    @Optional() @Inject(SUPABASE_STORAGE_CLIENT_FACTORY) factory?: ClientFactory,
  ) {
    super();
    const url = config.get<string>('SUPABASE_URL');
    const serviceKey = config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.bucket = config.get<string>('EVIDENCE_STORAGE_BUCKET') || 'repairproof-evidence';
    if (url && serviceKey)
      this.client = (factory ?? createClient)(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
  }

  get maxFileBytes() {
    const configured = Number(
      this.config.get<string>('EVIDENCE_MAX_FILE_BYTES') || 25 * 1024 * 1024,
    );
    return Number.isSafeInteger(configured) && configured > 0 ? configured : 25 * 1024 * 1024;
  }

  get retentionDays() {
    const configured = Number(this.config.get<string>('EVIDENCE_RETENTION_DAYS') || 2555);
    return Number.isSafeInteger(configured) && configured > 0 ? configured : 2555;
  }

  async checkHealth() {
    await this.ensurePrivateBucket();
  }

  private storage() {
    if (!this.client)
      throw new ServiceUnavailableException('Private evidence object storage is not configured');
    return this.client.storage;
  }

  private async ensurePrivateBucket() {
    if (this.verifiedBucketUntil > Date.now()) return;
    const { data, error } = await this.withRetry(() => this.storage().getBucket(this.bucket));
    if (error || !data)
      throw new ServiceUnavailableException(
        `Evidence storage bucket "${this.bucket}" is unavailable`,
      );
    if (data.public || !data.file_size_limit || data.file_size_limit > this.maxFileBytes)
      throw new ServiceUnavailableException(
        'Evidence bucket must be private and enforce a file limit no greater than the configured application limit',
      );
    const allowed = data.allowed_mime_types;
    if (
      !allowed?.length ||
      SUPPORTED_EVIDENCE_MIME_TYPES.some((mime) => !allowed.includes(mime)) ||
      allowed.some((mime) => !(SUPPORTED_EVIDENCE_MIME_TYPES as readonly string[]).includes(mime))
    ) {
      throw new ServiceUnavailableException(
        'Evidence bucket MIME allowlist must exactly match the supported evidence types',
      );
    }
    this.verifiedBucketUntil = Date.now() + 60_000;
  }

  async createSignedUpload(path: string) {
    await this.ensurePrivateBucket();
    const { data, error } = await this.withRetry(() =>
      this.storage().from(this.bucket).createSignedUploadUrl(path, { upsert: false }),
    );
    if (error || !data)
      throw new ServiceUnavailableException('Could not create a signed evidence upload URL');
    return {
      bucket: this.bucket,
      objectPath: data.path,
      uploadToken: data.token,
      signedUploadUrl: data.signedUrl,
    };
  }

  async createSignedUploadUrl(path: string) {
    const result = await this.createSignedUpload(path);
    return { ...result, uploadUrl: result.signedUploadUrl, objectKey: result.objectPath };
  }

  async createDownload(path: string, expiresInSeconds = 60) {
    await this.ensurePrivateBucket();
    const { data, error } = await this.withRetry(() =>
      this.storage().from(this.bucket).createSignedUrl(path, expiresInSeconds),
    );
    if (error || !data?.signedUrl)
      throw new ServiceUnavailableException('Could not create a signed evidence download URL');
    return data.signedUrl;
  }

  async download(path: string) {
    const { data, error } = await this.withRetry(() =>
      this.storage().from(this.bucket).download(path),
    );
    if (error || !data)
      throw new ServiceUnavailableException(
        'Uploaded evidence object is not available for inspection',
      );
    return Buffer.from(await data.arrayBuffer());
  }

  async createSignedDownload(path: string, expiresInSeconds = 60) {
    await this.ensurePrivateBucket();
    const { data, error } = await this.withRetry(() =>
      this.storage().from(this.bucket).createSignedUrl(path, expiresInSeconds),
    );
    if (error || !data?.signedUrl)
      throw new ServiceUnavailableException('Could not create a signed evidence download URL');
    return data.signedUrl;
  }

  async move(source: string, destination: string) {
    const { error } = await this.storage().from(this.bucket).move(source, destination);
    if (error)
      throw new ServiceUnavailableException(
        'Could not move verified evidence into its retained object path',
      );
  }

  async remove(path: string) {
    const { error } = await this.storage().from(this.bucket).remove([path]);
    if (error && !/not found|does not exist|404/i.test(`${error.message ?? ''} ${error.name ?? ''}`))
      throw new ServiceUnavailableException('Could not remove quarantined or expired evidence');
  }

  async uploadDerived(path: string, bytes: Buffer, contentType: string) {
    const { error } = await this.storage()
      .from(this.bucket)
      .upload(path, bytes, { contentType, upsert: false });
    if (error) throw new ServiceUnavailableException('Could not store derived evidence asset');
  }

  private async withRetry<T extends { error: unknown }>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await operation();
        if (!result.error || !isRetryableStorageError(result.error) || attempt >= 2) return result;
      } catch (error) {
        if (!isRetryableStorageError(error) || attempt >= 2) throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
    }
  }
}

function isRetryableStorageError(error: unknown): boolean {
  const value = error as { status?: number | string; statusCode?: number | string; name?: string };
  const status = Number(value?.statusCode ?? value?.status);
  return value?.name === 'TypeError' || status === 408 || status === 429 || status >= 500;
}
