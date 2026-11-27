import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiGet, apiPost } from '../../lib/api';
import {
  technicianWorkspaceSchema,
  type CaseActionInput,
  type TechnicianWorkspaceData,
} from './types';
import { getSupabaseStorageClient } from '../../lib/supabase-storage';

export const technicianWorkspaceQueryKey = ['technician', 'workspace'] as const;
export const isTechnicianDemoMode =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_FIXTURES === 'true';

export function useTechnicianWorkspace() {
  return useQuery({
    queryKey: technicianWorkspaceQueryKey,
    queryFn: async (): Promise<TechnicianWorkspaceData> => {
      const result = isTechnicianDemoMode
        ? (await import('./mock-data')).technicianWorkspaceMockData
        : await apiGet<unknown>('/cases/workspace');
      return technicianWorkspaceSchema.parse(result);
    },
    retry: isTechnicianDemoMode ? 0 : 1,
  });
}

export function useTechnicianAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, method = 'POST', body }: CaseActionInput) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine)
        throw new Error('This action requires a server connection. It has not been submitted.');
      return method === 'PATCH'
        ? api.patch(path, body)
        : apiPost<unknown, Record<string, unknown>>(path, body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: technicianWorkspaceQueryKey });
    },
  });
}

export function useTechnicianEvidenceUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      caseId,
      file,
      category,
    }: {
      caseId: string;
      file: File;
      category: 'DIAGNOSTIC' | 'DURING_REPAIR' | 'POST_REPAIR';
    }) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine)
        throw new Error('You are offline. The file has not been uploaded. Reconnect and retry.');
      if (file.size <= 0 || file.size > 25 * 1024 * 1024)
        throw new Error('Evidence must be between 1 byte and 25 MB.');
      const supported = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/heic',
        'video/mp4',
        'video/quicktime',
        'application/pdf',
      ];
      if (!supported.includes(file.type))
        throw new Error('Choose a supported image, video, or PDF evidence file.');
      const token = crypto.randomUUID();
      const signed = await apiPost<
        {
          bucket?: string;
          objectPath?: string;
          uploadToken?: string;
          uploadId: string;
          evidenceId?: string;
          alreadyCompleted?: boolean;
        },
        Record<string, unknown>
      >(
        `/cases/${caseId}/evidence/upload-intents`,
        {
          category,
          purpose: file.type.startsWith('image/')
            ? 'PHOTOGRAPH'
            : file.type === 'application/pdf'
              ? 'DIAGNOSTIC_REPORT'
              : category === 'POST_REPAIR'
                ? 'REPAIR_COMPLETION'
                : 'OTHER',
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
        },
        { headers: { 'Idempotency-Key': token } },
      );
      if (signed.alreadyCompleted) return { evidenceId: signed.evidenceId };
      if (!signed.bucket || !signed.objectPath || !signed.uploadToken)
        throw new Error('Upload intent is no longer available. Start a new upload.');
      const { error } = await getSupabaseStorageClient()
        .storage.from(signed.bucket)
        .uploadToSignedUrl(signed.objectPath, signed.uploadToken, file, {
          contentType: file.type,
          upsert: false,
        });
      if (error) throw new Error('The evidence file could not be uploaded. Try again.');
      return apiPost<unknown, Record<string, unknown>>(
        `/cases/${caseId}/evidence/upload-intents/${signed.uploadId}/complete`,
        {},
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: technicianWorkspaceQueryKey });
    },
  });
}
