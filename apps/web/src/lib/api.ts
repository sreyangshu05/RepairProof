import axios, { type AxiosError, type AxiosRequestConfig } from 'axios';
import { tx, getCurrentLocale } from '../i18n/catalog';

export interface ApiErrorBody {
  message?: string;
  error?: { code?: string; message?: string; details?: unknown };
  success?: false;
}

export class ApiError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(
    message: string,
    options: { status?: number; code?: string; details?: unknown } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

// The API exposes root resource paths and uses header based versioning.
// In production `/api` is reverse proxied by nginx; in local Vite it is proxied
// to the API container/process and stripped before reaching Nest.
const apiBaseUrl = import.meta.env.VITE_API_URL ?? '/api';
let apiAccessToken: string | null = null;

if (typeof window !== 'undefined') {
  try {
    window.localStorage.removeItem('rp_auth_token');
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

/** Keep bearer credentials in memory; refreshing the tab requires signing in again. */
export function setApiAccessToken(token: string | null) {
  apiAccessToken = token;
}

export const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 20_000,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  config.headers.set('X-API-Version', '1');
  config.headers.set('Accept-Language', getCurrentLocale());
  const method = config.method?.toUpperCase();
  if (
    method &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) &&
    !config.headers.get('Idempotency-Key')
  ) {
    const key =
      globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    config.headers.set('Idempotency-Key', key);
  }
  if (apiAccessToken) config.headers.Authorization = `Bearer ${apiAccessToken}`;
  return config;
});

api.interceptors.response.use(
  (response) => {
    const body = response.data as { success?: boolean; data?: unknown } | undefined;
    if (body && typeof body === 'object' && 'success' in body) {
      if (body.success === false) throw new ApiError('The request could not be completed.');
      return body.data;
    }
    return response.data;
  },
  (error: AxiosError<ApiErrorBody>) => {
    const body = error.response?.data;
    const message =
      body?.error?.message ?? body?.message ?? error.message ?? 'An unexpected error occurred.';
    return Promise.reject(
      new ApiError(message, {
        status: error.response?.status,
        code: body?.error?.code,
        details: body?.error?.details,
      }),
    );
  },
);

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await api.get<T>(url, config);
  return response as T;
}

export async function apiPost<TResponse, TBody = unknown>(
  url: string,
  body?: TBody,
  config?: AxiosRequestConfig<TBody>,
): Promise<TResponse> {
  const response = await api.post<TResponse>(url, body, config);
  return response as TResponse;
}

export async function apiPatch<TResponse, TBody = unknown>(
  url: string,
  body?: TBody,
  config?: AxiosRequestConfig<TBody>,
): Promise<TResponse> {
  const response = await api.patch<TResponse>(url, body, config);
  return response as TResponse;
}

export async function apiPut<TResponse, TBody = unknown>(
  url: string,
  body?: TBody,
  config?: AxiosRequestConfig<TBody>,
): Promise<TResponse> {
  const response = await api.put<TResponse>(url, body, config);
  return response as TResponse;
}

export function getApiErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
) {
  const source =
    error instanceof ApiError
      ? error.message
      : axios.isAxiosError(error)
        ? error.message || fallback
        : error instanceof Error
          ? error.message
          : fallback;
  if (getCurrentLocale() === 'en-IN') return source;
  const translated = tx(source);
  return translated === source ? tx('error.generic') : translated;
}
