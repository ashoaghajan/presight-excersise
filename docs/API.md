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
| `page`          | integer  | `1`          | 1 … 1000000                                     |
| `limit`         | integer  | `50`         | 1 … 100                                         |
| `search`        | string   | `""`         | ≤ 100 characters                                |
| `nationalities` | string[] | `[]`         | ≤ 50 values                                     |
| `hobbies`       | string[] | `[]`         | ≤ 50 values                                     |
| `sortField`     | enum     | `first_name` | `first_name`, `last_name`, `age`, `nationality` |
| `sortDirection` | enum     | `asc`        | `asc`, `desc`                                   |

Unknown query keys are ignored, so cache-busting and analytics parameters do not
fail a request.

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
`last_name`. `%` and `_` are matched literally, not as wildcards.

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
    "page": 1, // echoes the page that produced this payload
    "limit": 50, // echoes the effective page size
    "total": 1200, // rows matching the filters — NOT the table size
    "totalPages": 24, // ceil(total / limit); 0 when total is 0
    "hasMore": true, // true when another page exists after this one
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

- `hasMore` is derived from `total`, not from "did we get a full page", so a page
  landing exactly on the last row reports `false` instead of making the client
  fetch one empty page to find out.
- A `page` past the end returns `users: []` with `hasMore: false` — not a `404`.
- Ordering always ends with `id ASC` as a tie-breaker, so paging through a sorted
  list never duplicates or skips a user.

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

| Status | `code`           | When                                              |
| ------ | ---------------- | ------------------------------------------------- |
| `400`  | `BAD_REQUEST`    | any parameter fails validation                    |
| `404`  | `NOT_FOUND`      | unknown route                                     |
| `500`  | `INTERNAL_ERROR` | unexpected failure (message hidden in production) |

All failing parameters are reported at once:

```bash
$ curl '/api/users?page=abc&limit=999&sortField=nope'
{"error":{"code":"BAD_REQUEST","message":"Invalid query parameters","details":{
  "page":["must be a whole number"],
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
# defaults: page 1, 50 per page, sorted by first_name asc
curl 'http://localhost:4000/api/users'

# search, both filters, sorted oldest first
curl 'http://localhost:4000/api/users?search=a&nationalities=India&nationalities=Pakistan&hobbies=Reading&sortField=age&sortDirection=desc'

# users who have BOTH hobbies (66 of 1200 in the seeded set)
curl 'http://localhost:4000/api/users?hobbies=Reading,Swimming'
```
