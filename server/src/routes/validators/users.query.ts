/**
 * Query-string validation for `GET /api/users`.
 *
 * This is the trust boundary: everything above this line is untrusted user
 * input, everything below it is a fully-typed `UsersQuery`. Doing it here — and
 * only here — is what lets the service and the repositories assume valid,
 * normalised, defaulted values and never re-check them.
 *
 * Policy: **absent means default, present-but-invalid means 400.** A missing
 * `sortField` is not an error, it is "use the default"; a `sortField=salary` is
 * a client bug and gets told so, with the field name and the accepted values,
 * rather than being silently rewritten into something the caller did not ask
 * for. Silent coercion is how a shared URL ends up showing data that does not
 * match what the sender saw.
 */

import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT_DIRECTION,
  DEFAULT_SORT_FIELD,
  MAX_FILTER_VALUES,
  MAX_PAGE,
  MAX_PAGE_SIZE,
  MAX_SEARCH_LENGTH,
  SORT_DIRECTIONS,
  SORT_FIELDS,
  isSortDirection,
  isSortField,
  type SortDirection,
  type SortField,
  type UsersQuery,
} from '@presight/shared';
import { z } from 'zod';

import { HttpError } from '../../lib/http-error';

/**
 * A whole-number query parameter.
 *
 * The regex is deliberate: `Number('')` is 0 and `Number(' 12 ')` is 12, so
 * coercing first and validating after would quietly accept junk. Matching the
 * digits explicitly means `page=1.5`, `page=-1` and `page=abc` all fail with
 * the same clear message instead of three different surprises.
 */
function integerParam(min: number, max: number) {
  return z
    .string()
    .trim()
    .regex(/^\d+$/, 'must be a whole number')
    .transform(Number)
    .refine((value) => value >= min && value <= max, `must be between ${min} and ${max}`);
}

/**
 * A repeatable filter parameter.
 *
 * Accepts both forms a hand-written or generated URL might use:
 *   ?hobbies=Reading&hobbies=Swimming   (repeated key — what the client emits)
 *   ?hobbies=Reading,Swimming           (comma-joined — convenient by hand)
 *
 * Consequence worth knowing: a comma is always a separator, so a filter value
 * that itself contains a comma must use the repeated form. No current hobby or
 * nationality does.
 */
const filterValuesParam = z
  .union([z.string(), z.array(z.string())])
  .transform((raw) => {
    const values = Array.isArray(raw) ? raw : [raw];

    const seen = new Set<string>();
    const result: string[] = [];

    for (const entry of values) {
      for (const part of entry.split(',')) {
        const trimmed = part.trim();
        if (trimmed === '') continue;

        // Case-insensitive de-duplication, matching the NOCASE columns the
        // filter eventually hits. `?hobbies=Reading&hobbies=reading` is one
        // selection, not two — and two would break the hobby AND-filter, whose
        // required match count is the length of this array.
        const key = trimmed.toLowerCase();
        if (seen.has(key)) continue;

        seen.add(key);
        result.push(trimmed);
      }
    }

    return result;
  })
  .refine(
    (values) => values.length <= MAX_FILTER_VALUES,
    `must contain at most ${MAX_FILTER_VALUES} values`,
  );

/**
 * Sort parameters are validated against the shared vocabulary rather than a
 * locally re-declared list, so the API can never accept a field the client's
 * sort control does not offer — or reject one it does.
 */
const sortFieldParam = z
  .string()
  .trim()
  .refine(
    (value): value is SortField => isSortField(value),
    `must be one of: ${SORT_FIELDS.join(', ')}`,
  );

const sortDirectionParam = z
  .string()
  .trim()
  .refine(
    (value): value is SortDirection => isSortDirection(value),
    `must be one of: ${SORT_DIRECTIONS.join(', ')}`,
  );

/**
 * Unknown query keys are stripped rather than rejected — cache-busting params
 * and analytics tags are not the client's fault and should not fail a request.
 */
const usersQuerySchema = z.object({
  page: integerParam(1, MAX_PAGE).optional(),
  limit: integerParam(1, MAX_PAGE_SIZE).optional(),
  search: z
    .string()
    .max(MAX_SEARCH_LENGTH, `must be at most ${MAX_SEARCH_LENGTH} characters`)
    .optional(),
  hobbies: filterValuesParam.optional(),
  nationalities: filterValuesParam.optional(),
  sortField: sortFieldParam.optional(),
  sortDirection: sortDirectionParam.optional(),
});

/**
 * Validates raw `req.query` into a `UsersQuery`.
 *
 * Throws `HttpError.badRequest` with per-field details on invalid input; the
 * error middleware turns that into the shared `ApiErrorBody` envelope.
 */
export function parseUsersQuery(params: unknown): UsersQuery {
  const result = usersQuerySchema.safeParse(params);

  if (!result.success) {
    // Field-level detail so the client can point at the offending input rather
    // than guessing which of seven parameters was wrong.
    throw HttpError.badRequest(
      'Invalid query parameters',
      z.flattenError(result.error).fieldErrors,
    );
  }

  const parsed = result.data;

  return {
    page: parsed.page ?? DEFAULT_PAGE,
    limit: parsed.limit ?? DEFAULT_PAGE_SIZE,
    search: parsed.search?.trim() ?? '',
    hobbies: parsed.hobbies ?? [],
    nationalities: parsed.nationalities ?? [],
    sortField: parsed.sortField ?? DEFAULT_SORT_FIELD,
    sortDirection: parsed.sortDirection ?? DEFAULT_SORT_DIRECTION,
  };
}
