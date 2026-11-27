import { ServiceUnavailableException } from '@nestjs/common';
import {
  SUPPORTED_EVIDENCE_MIME_TYPES,
  SupabaseObjectStorageAdapter,
} from '../src/modules/evidence/object-storage.service';

describe('SupabaseObjectStorageAdapter', () => {
  const config = {
    get: (key: string) =>
      (
        ({
          SUPABASE_URL: 'https://project.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: 'test-service-role',
          EVIDENCE_STORAGE_BUCKET: 'repairproof-evidence',
          EVIDENCE_MAX_FILE_BYTES: '26214400',
          EVIDENCE_RETENTION_DAYS: '2555',
        }) as any
      )[key],
  } as any;
  const privateBucket = {
    id: 'repairproof-evidence',
    public: false,
    file_size_limit: 26214400,
    allowed_mime_types: [...SUPPORTED_EVIDENCE_MIME_TYPES],
  };

  it('retries transient metadata failures for safe signed URL operations', async () => {
    const getBucket = jest
      .fn()
      .mockResolvedValueOnce({ data: null, error: { statusCode: '503' } })
      .mockResolvedValueOnce({ data: privateBucket, error: null });
    const createSignedUrl = jest.fn().mockResolvedValue({
      data: { signedUrl: 'https://storage.example.test/signed' },
      error: null,
    });
    const client = { storage: { getBucket, from: () => ({ createSignedUrl }) } };
    const adapter = new SupabaseObjectStorageAdapter(config, (() => client) as any);
    await expect(adapter.createDownload('shop/case/file.pdf')).resolves.toContain('/signed');
    expect(getBucket).toHaveBeenCalledTimes(2);
    expect(createSignedUrl).toHaveBeenCalledWith('shop/case/file.pdf', 60);
  });

  it('fails closed on non-retryable public or missing bucket responses', async () => {
    const getBucket = jest
      .fn()
      .mockResolvedValue({ data: { ...privateBucket, public: true }, error: null });
    const adapter = new SupabaseObjectStorageAdapter(config, (() => ({
      storage: { getBucket },
    })) as any);
    await expect(adapter.createSignedUpload('path')).rejects.toThrow(ServiceUnavailableException);
    expect(getBucket).toHaveBeenCalledTimes(1);
  });
});
