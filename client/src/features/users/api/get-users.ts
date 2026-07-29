/**
 * Typed access to `GET /api/users`.
 *
 * The boundary between the feature and HTTP: this module knows the endpoint and
 * the response type, and nothing above it does. It contains no React — which is
 * what lets the hook layer stay a thin adapter and keeps this callable from a
 * test or a prefetch without a component tree.
 */

import { API_ENDPOINTS, apiGet } from '@/shared/api';
import type { UsersResponse } from '@presight/shared';

import { USERS_PAGE_SIZE } from '../model/list-config';
import type { UsersQueryState } from '../model/users-query';

export interface GetUsersParams extends UsersQueryState {
  page: number;
  limit?: number;
}

/**
 * Fetches one page of users plus the facet counts for the same filtered set.
 *
 * `signal` comes from TanStack Query and is forwarded so that changing a filter
 * mid-flight aborts the request that is no longer wanted — without it, a slow
 * response for an old filter can land after a fast one for the new filter and
 * overwrite it.
 */
export async function getUsers(
  params: GetUsersParams,
  signal?: AbortSignal,
): Promise<UsersResponse> {
  return apiGet<UsersResponse>(API_ENDPOINTS.users, {
    // Empty strings and empty arrays are dropped by the client's param
    // serializer, so an unfiltered request sends only `page` and `limit`.
    params: {
      page: params.page,
      limit: params.limit ?? USERS_PAGE_SIZE,
      search: params.search,
      hobbies: params.hobbies,
      nationalities: params.nationalities,
      sortField: params.sortField,
      sortDirection: params.sortDirection,
    },
    ...(signal ? { signal } : {}),
  });
}
