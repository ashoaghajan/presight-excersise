# feature: users

Owns the user list — fetching it, virtualizing it, and rendering the cards.
It also owns the canonical query state, because that state *is* the argument to
the users request; `filters` and `sorting` only edit slices of it.

Planned modules (none implemented yet):

- `model/users-query.ts` — the `UsersQuery` view state plus its URL codec:
  parse `URLSearchParams` -> query, and serialise query -> `URLSearchParams`.
  Keeping the codec pure and separate from React is what makes URL sync
  testable and keeps back/forward navigation honest.
- `api/get-users.ts` — `getUsers(query, signal): Promise<UsersResponse>`, built
  on `shared/api/http-client`.
- `hooks/useUsersQueryState.ts` — reads/writes the query state through
  `useSearchParams` (single source of truth: the URL, not component state).
- `hooks/useUsersInfiniteQuery.ts` — `useInfiniteQuery` keyed by the query
  state; exposes pages, `fetchNextPage`, `hasNextPage` and the distinct
  initial-load vs. next-page loading flags the design spec requires.
- `components/VirtualUserList.tsx` — `@tanstack/react-virtual` list that
  triggers `fetchNextPage` as the last rendered row approaches the end.
- `components/UserCard.tsx` — avatar, full name, nationality, age, first two
  hobbies and a `+n` badge.
- `components/UserListSkeleton.tsx`, `EmptyState.tsx`, `ErrorState.tsx`.

Note: the facet counts arrive in the same `UsersResponse` as the rows, so the
sidebar reads them from this feature's query cache rather than issuing its own
request — that is what guarantees counts and rows always describe the same set.
