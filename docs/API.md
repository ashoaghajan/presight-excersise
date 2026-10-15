# API Reference

Base path: `/api`. All types below are exported from `@presight/shared`, which
both the server and the client compile against — this document describes the
same contract, it does not define it.

---

## `GET /api/users`

Returns one page of users **and** the sidebar facet counts for the same filtered
set. They are served together on purpose: two separate requests can interleave
and leave the sidebar showing counts that contradict the visible rows.

### Query parameters

All parameters are optional. **Absent means default; present-but-invalid means
`400`** — a missing `sortField` is "use the default", but `sortField=salary` is a
client bug and is reported as one rather than silently rewritten.

| Parameter       | Type     | Default      | Accepted                                        |
| --------------- | -------- | ------------ | ----------------------------------------------- |
| `cursor`        | string   | none         | a `nextCursor` from a previous response         |
| `limit`         | integer  | `50`         | 1 … 100                                         |
| `search`        | string   | `""`         | ≤ 100 characters                                |
| `nationalities` | string[] | `[]`         | ≤ 50 values                                     |
| `hobbies`       | string[] | `[]`         | ≤ 50 values                                     |
| `sortField`     | enum     | `first_name` | `first_name`, `last_name`, `age`, `nationality` |
| `sortDirection` | enum     | `asc`        | `asc`, `desc`                                   |

Unknown query keys are ignored, so cache-busting and analytics parameters do not
fail a request. The one exception is `page`, the parameter used before cursor
pagination: it is rejected with `400` so that an outdated client fails visibly
instead of receiving the first page over and over.

#### Cursor

Omit `cursor` for the first page. For each next page, send back the
`pagination.nextCursor` from the previous response together with the **same**
`sortField`, `sortDirection` and filters.

The cursor is **opaque**: clients must not parse or build it. (Internally it is
base64url-encoded JSON holding the sort field, direction, and the sort value and
`id` of the last row returned; the format is versioned and may change.) A cursor
that does not decode, or that was issued for a different `sortField` /
`sortDirection`, is a `400` with `details.cursor`. Restart from the first page
when the sort changes.

#### Array parameters

`nationalities` and `hobbies` accept either form:

```
?hobbies=Reading&hobbies=Swimming     repeated key — what the client emits
?hobbies=Reading,Swimming             comma-joined — convenient by hand
```

Both are equivalent. Values are trimmed and de-duplicated case-insensitively.
Because a comma is always a separator, a value that itself contains a comma must
use the repeated form (no current hobby or nationality does).

#### Filter semantics

| Filter          | Semantics | `A + B` matches        |
| --------------- | --------- | ---------------------- |
| `nationalities` | **OR**    | users from A _or_ B    |
| `hobbies`       | **AND**   | users having A _and_ B |

The asymmetry is structural, not a preference: a user row holds exactly one
nationality, so selected values are alternatives for one column; hobbies live one
row per (user, hobby), so "has both" is a condition across rows. `search`,
`nationalities` and `hobbies` all apply together (AND).

`search` is a case-insensitive substring match against `first_name` **or**
`last_name`. `%`, `_`, quotes and FTS operators such as `OR` or `*` are matched
literally, not as syntax. Terms of 3+ characters are served by a full-text index;
1–2 character terms use a table scan. The results are the same either way.

### Response `200` — `UsersResponse`

```jsonc
{
  "users": [
    {
      "id": 132,
      "avatar": "https://api.dicebear.com/9.x/avataaars/svg?seed=…",
      "first_name": "Abdullah",
      "last_name": "Al Shehri",
      "age": 43,
      "nationality": "Saudi Arabia",
      "hobbies": ["Basketball", "Chess", "Cooking"], // ALL hobbies; the card shows 2 + "+n"
    },
  ],
  "pagination": {
    "limit": 50, // echoes the effective page size
    "total": 1200, // rows matching the filters — NOT the table size
    "hasMore": true, // true when another page exists after this one
    "nextCursor": "eyJ2IjoxLCJmIjoiZmlyc3RfbmFtZSIs…", // null on the last page
  },
  "hobbies": [{ "value": "Reading", "count": 320 }], // top 20 facets
  "nationalities": [{ "value": "India", "count": 178 }], // top 20 facets
}
```

Notes on the two facet arrays:

- They are **facet counts for the sidebar**, not any user's hobbies. `count` is
  the number of matching _users_ holding that value.
- They are scoped to the **current** search and filters, never the global
  dataset — with one deliberate exception below.
- **`hobbies` applies every active filter, including the hobby selection.** So
  `hobbies=Reading` recomputes the list within Reading-users, and each hobby you
  add narrows what remains. That is the correct reading of AND.
- **`nationalities` applies the search and hobby filters but _not_ the
  nationality selection** — standard disjunctive faceting. A user has exactly one
  nationality, so counting nationalities within a nationality-filtered set can
  only ever return the selected values: `nationalities=India` would come back as
  `[India]`, every other option would disappear from the sidebar, and the OR
  filter could never be given a second value. Excluding its own filter keeps the
  counts meaningful — with India selected, `{"value":"Japan","count":57}` reads
  as "adding Japan brings in 57 more users", which is what OR means.
- Capped at 20 each, ordered by `count` descending then `value` ascending. The
  secondary sort is not cosmetic: without it, equal-count facets could swap
  places between identical requests and the checkboxes would appear to jump.

Pagination behaviour worth relying on:

- **Keyset, not offset.** `cursor` means "rows after the last row I received",
  so rows inserted or deleted while a client scrolls cannot cause a duplicate or
  a skipped user, and every page costs the same however deep it is.
- **No random access.** There is no "jump to page N" and no `totalPages`; the
  only way forward is the cursor. `total` is still returned for the result
  count.
- `hasMore` is exact: the server reads one row beyond the page to decide it, so
  an exactly full last page reports `false` instead of making the client fetch
  one empty page to find out. `hasMore` is always `nextCursor !== null`.
- `total` is computed by a separate query, so if data changes mid-scroll it
  describes the set at the time of _that_ request.
- Ordering always ends with `id ASC` as a tie-breaker. That makes every
  `(sort value, id)` pair unique, which is what lets a cursor name an exact
  position.

### Errors — `ApiErrorBody`

Every non-2xx response from the API uses one envelope, so the client has exactly
one error-parsing path:

```jsonc
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid query parameters",
    "details": { "limit": ["must be between 1 and 100"] }, // optional, field-level
  },
}
```

| Status | `code`              | When                                                               |
| ------ | ------------------- | ------------------------------------------------------------------ |
| `400`  | `BAD_REQUEST`       | any parameter fails validation, or malformed JSON body             |
| `404`  | `NOT_FOUND`         | unknown route                                                      |
| `413`  | `PAYLOAD_TOO_LARGE` | JSON body over `JSON_BODY_LIMIT` (default `10kb`)                  |
| `429`  | `RATE_LIMITED`      | over `RATE_LIMIT_MAX` requests per IP per window (default 300/min) |
| `500`  | `INTERNAL_ERROR`    | unexpected failure (message hidden in production)                  |

### Rate limiting

Every `/api` route except `/api/health` is limited per client IP. Responses
carry the IETF `RateLimit` / `RateLimit-Policy` headers (remaining quota and
policy), and a `429` also carries `Retry-After` (seconds).

All failing parameters are reported at once:

```bash
$ curl '/api/users?cursor=abc!&limit=999&sortField=nope'
{"error":{"code":"BAD_REQUEST","message":"Invalid query parameters","details":{
  "cursor":["is not a valid cursor"],
  "limit":["must be between 1 and 100"],
  "sortField":["must be one of: first_name, last_name, age, nationality"]}}}
```

---

## `GET /api/health`

Liveness probe used by the Docker healthcheck.

```json
{ "status": "ok", "uptime": 2.04 }
```

---

## Examples

```bash
# defaults: first page, 50 per page, sorted by first_name asc
curl 'http://localhost:4000/api/users'

# next page: pass back pagination.nextCursor with the same sort and filters
curl "http://localhost:4000/api/users?cursor=$NEXT_CURSOR"

# search, both filters, sorted oldest first
curl 'http://localhost:4000/api/users?search=a&nationalities=India&nationalities=Pakistan&hobbies=Reading&sortField=age&sortDirection=desc'

# users who have BOTH hobbies (66 of 1200 in the seeded set)
curl 'http://localhost:4000/api/users?hobbies=Reading,Swimming'
```
