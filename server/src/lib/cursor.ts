/**
 * Encoding and decoding of the opaque pagination cursor.
 *
 * Wire format: base64url of a small JSON object
 *
 *   { "v": 1, "f": "age", "d": "desc", "k": 42, "id": 17 }
 *     version  sort field  direction   sort value of the last row, its id
 *
 * Why these choices:
 *  - **Opaque** (base64, documented as "do not parse"): clients cannot start
 *    depending on the fields, so the format can change behind `v` without a
 *    contract change.
 *  - **Sort field and direction inside the cursor**: a position only means
 *    something within one ordering. "After age 42, id 17" is nonsense under
 *    `first_name asc`, so the controller rejects a cursor whose sort does not
 *    match the request instead of returning a silently wrong page.
 *  - **Not signed**: a client that edits its cursor can only move its own
 *    position in a list it is already allowed to read, and every value is
 *    validated here and then bound through `?` placeholders. Signing (HMAC)
 *    would be needed only if the cursor carried something the client must not
 *    change, such as a tenant id.
 */

import {
  SORT_DIRECTIONS,
  SORT_FIELDS,
  type KeysetPosition,
  type SortDirection,
  type SortField,
} from '@presight/shared';
import { z } from 'zod';

export const CURSOR_VERSION = 1;

export interface Cursor {
  sortField: SortField;
  sortDirection: SortDirection;
  position: KeysetPosition;
}

/** Longest text sort value accepted; names in the seed are far shorter. */
const MAX_TEXT_VALUE_LENGTH = 200;

const payloadSchema = z
  .object({
    v: z.literal(CURSOR_VERSION),
    f: z.enum(SORT_FIELDS),
    d: z.enum(SORT_DIRECTIONS),
    k: z.union([z.string().max(MAX_TEXT_VALUE_LENGTH), z.number().int()]),
    id: z.number().int().positive(),
  })
  // The value's type must match the column: `age` is an integer, the others
  // are text. Without this, `k: "42"` for age would compare as text in SQL and
  // land the client somewhere unexpected in the list.
  .refine((p) => (p.f === 'age' ? typeof p.k === 'number' : typeof p.k === 'string'));

export function encodeCursor(cursor: Cursor): string {
  const payload = {
    v: CURSOR_VERSION,
    f: cursor.sortField,
    d: cursor.sortDirection,
    k: cursor.position.value,
    id: cursor.position.id,
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/**
 * Returns the decoded cursor, or `null` if the string is not one we issued
 * (bad base64, bad JSON, unknown version, wrong types). The caller decides
 * what an invalid cursor means; for the API it is a 400.
 */
export function decodeCursor(raw: string): Cursor | null {
  // Node's base64url decoder skips invalid characters instead of failing, so
  // check the alphabet first; otherwise "abc!!" would decode as "abc".
  if (!/^[A-Za-z0-9_-]+$/.test(raw)) return null;

  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  const result = payloadSchema.safeParse(json);
  if (!result.success) return null;

  const { f, d, k, id } = result.data;
  return { sortField: f, sortDirection: d, position: { value: k, id } };
}
