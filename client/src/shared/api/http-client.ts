/**
 * The one HTTP client in the application.
 *
 * Feature `api/` modules build typed request functions on top of this;
 * components and hooks never import Axios directly. Centralising it means the
 * base URL, timeout, serialisation rules and error normalisation are decided
 * once — a feature cannot accidentally talk to the API a different way.
 *
 * Axios (rather than bare `fetch`) buys three things this app actually uses:
 * interceptors, so every error arrives as an `ApiError` without a try/catch in
 * every caller; a real timeout, which `fetch` still lacks without wiring an
 * AbortController by hand; and `paramsSerializer`, which is how repeated
 * `?hobbies=a&hobbies=b` keys get emitted correctly.
 */

import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';

import { API_BASE_URL, API_TIMEOUT_MS } from '@/shared/config/env';
import { toApiError } from './api-error';
import { serializeParams } from './serialize-params';

function createHttpClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: API_TIMEOUT_MS,
    headers: { Accept: 'application/json' },
    paramsSerializer: { serialize: serializeParams },
  });

  // Single normalisation point: every rejection leaving this client is an
  // `ApiError`, so no caller has to know Axios's error shape.
  instance.interceptors.response.use(
    (response) => response,
    (error: unknown) => Promise.reject(toApiError(error)),
  );

  return instance;
}

export const httpClient = createHttpClient();

/**
 * Typed GET helper.
 *
 * `signal` is threaded through deliberately: TanStack Query passes an
 * AbortSignal into every query function, and forwarding it is what cancels the
 * in-flight request when the user types another character or changes a filter.
 */
export async function apiGet<TResponse>(
  url: string,
  config?: Pick<AxiosRequestConfig, 'params' | 'signal'>,
): Promise<TResponse> {
  const response = await httpClient.get<TResponse>(url, config);
  return response.data;
}
