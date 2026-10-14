/**
 * HTTP-level tests against the real Express app.
 *
 * This pass exists separately from the repository tests because the validator
 * sits between the wire and the repository and *normalises* values — trimming,
 * de-duplicating, comma-splitting. A drift between validator and repository
 * would be invisible to a unit test of either side alone.
 *
 * The app is bound to port 0 and driven with `fetch` rather than pulled in
 * through supertest: `createApp` already returns an unbound app, so this needs
 * no extra dependency and exercises the same code path a browser would.
 */

import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SORT_DIRECTIONS, SORT_FIELDS, type UsersResponse } from '@presight/shared';

import { createApp } from '../app';
import { createTestContext, expectedOrder, expectedUsers, type TestContext } from '../test/fixture';

let ctx: TestContext;
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  ctx = createTestContext();
  const app = createApp({ userService: ctx.service });

  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });

  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  ctx.close();
});

async function getUsers(queryString = ''): Promise<{ status: number; body: UsersResponse }> {
  const response = await fetch(`${baseUrl}/api/users${queryString}`);
  return { status: response.status, body: (await response.json()) as UsersResponse };
}

describe('GET /api/users', () => {
  it('returns users, pagination and both facet lists', async () => {
    const { status, body } = await getUsers();

    expect(status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['hobbies', 'nationalities', 'pagination', 'users']);
    expect(body.pagination.total).toBe(ctx.oracle.length);
    expect(body.users.length).toBeGreaterThan(0);
  });

  it('serialises a user with exactly the contract fields', async () => {
    const { body } = await getUsers('?limit=1');
    const user = body.users[0]!;

    expect(Object.keys(user).sort()).toEqual(
      ['age', 'avatar', 'first_name', 'hobbies', 'id', 'last_name', 'nationality'].sort(),
    );
    expect(Array.isArray(user.hobbies)).toBe(true);
  });

  it('reads repeated query keys as multiple values', async () => {
    // Express 5's default "simple" query parser drops duplicates; the app sets
    // the extended parser precisely so `?hobbies=a&hobbies=b` survives.
    const hobbies = [...new Set(ctx.oracle.flatMap((user) => user.hobbies))].slice(0, 2);
    const qs = hobbies.map((hobby) => `hobbies=${encodeURIComponent(hobby)}`).join('&');
    const { body } = await getUsers(`?${qs}&limit=100`);

    expect(body.pagination.total).toBe(expectedUsers(ctx.oracle, { hobbies }).length);
    for (const user of body.users) {
      for (const hobby of hobbies) expect(user.hobbies).toContain(hobby);
    }
  });

  it('applies hobby AND / nationality OR over the wire', async () => {
    const nationalities = [...new Set(ctx.oracle.map((user) => user.nationality))].slice(0, 2);
    const qs = nationalities.map((n) => `nationalities=${encodeURIComponent(n)}`).join('&');
    const { body } = await getUsers(`?${qs}&limit=100`);

    expect(body.pagination.total).toBe(expectedUsers(ctx.oracle, { nationalities }).length);
    for (const user of body.users) expect(nationalities).toContain(user.nationality);
  });

  it('caps each facet list at 20 and scopes it to the filtered set', async () => {
    const unfiltered = await getUsers('?limit=1');
    expect(unfiltered.body.hobbies.length).toBeLessThanOrEqual(20);
    expect(unfiltered.body.nationalities.length).toBeLessThanOrEqual(20);

    // A hobby filter narrows the hobby facets, because hobbies are conjunctive.
    const hobby = unfiltered.body.hobbies[0]!.value;
    const byHobby = await getUsers(`?hobbies=${encodeURIComponent(hobby)}&limit=1`);
    const selected = byHobby.body.hobbies.find((facet) => facet.value === hobby);
    expect(selected!.count).toBe(byHobby.body.pagination.total);
  });

  it('keeps the other nationalities selectable over the wire', async () => {
    // Nationality is disjunctive (see facet.repository.ts): selecting one must
    // not hide the rest, or the OR filter could never take a second value.
    const nationality = ctx.oracle[0]!.nationality;
    const filtered = await getUsers(`?nationalities=${encodeURIComponent(nationality)}&limit=1`);

    expect(filtered.body.nationalities.length).toBeGreaterThan(1);
    expect(filtered.body.nationalities.map((facet) => facet.value)).toContain(nationality);

    // And selecting a second one genuinely widens the result set.
    const second = filtered.body.nationalities.find((facet) => facet.value !== nationality)!;
    const both = await getUsers(
      `?nationalities=${encodeURIComponent(nationality)}&nationalities=${encodeURIComponent(second.value)}&limit=1`,
    );
    expect(both.body.pagination.total).toBe(filtered.body.pagination.total + second.count);
  });

  /** Follows `nextCursor` from the first page to the last, like the client. */
  async function walkApi(qs: string): Promise<{ ids: number[]; pages: number }> {
    const ids: number[] = [];
    let cursor: string | null = null;
    let pages = 0;

    do {
      const { status, body }: { status: number; body: UsersResponse } = await getUsers(
        `${qs}${cursor ? `&cursor=${cursor}` : ''}`,
      );
      expect(status).toBe(200);
      ids.push(...body.users.map((user) => user.id));
      pages++;
      expect(body.pagination.hasMore).toBe(body.pagination.nextCursor !== null);
      cursor = body.pagination.nextCursor;
    } while (cursor);

    return { ids, pages };
  }

  it('follows nextCursor to exactly the end, in order, for every sort', async () => {
    for (const sortField of SORT_FIELDS) {
      for (const sortDirection of SORT_DIRECTIONS) {
        const { ids, pages } = await walkApi(
          `?limit=37&sortField=${sortField}&sortDirection=${sortDirection}`,
        );
        const label = `${sortField} ${sortDirection}`;

        expect(ids, label).toEqual(
          expectedOrder(ctx.oracle, sortField, sortDirection).map((user) => user.id),
        );
        expect(pages, label).toBe(Math.ceil(ctx.oracle.length / 37));
      }
    }
  });

  it('walks a filtered and searched set exactly', async () => {
    const nationality = ctx.oracle[0]!.nationality;
    const { ids } = await walkApi(
      `?limit=5&search=a&nationalities=${encodeURIComponent(nationality)}&sortField=age`,
    );
    const expected = expectedOrder(
      expectedUsers(ctx.oracle, { search: 'a', nationalities: [nationality] }),
      'age',
      'asc',
    );

    expect(ids).toEqual(expected.map((user) => user.id));
  });

  it('ends on an exactly full last page without an extra empty request', async () => {
    // 300 rows at 100 per page: page 3 is full, and the probe row is what
    // tells the server there is nothing after it.
    expect(ctx.oracle.length % 100).toBe(0);
    const { ids, pages } = await walkApi('?limit=100');

    expect(pages).toBe(ctx.oracle.length / 100);
    expect(ids).toHaveLength(ctx.oracle.length);
  });

  it('returns an identical payload for an identical request', async () => {
    const first = await getUsers('?sortField=age&sortDirection=desc&limit=20');
    const qs = `?sortField=age&sortDirection=desc&limit=20&cursor=${first.body.pagination.nextCursor}`;
    const [a, b] = await Promise.all([getUsers(qs), getUsers(qs)]);
    expect(JSON.stringify(b.body)).toBe(JSON.stringify(a.body));
  });
});

describe('error handling', () => {
  it('rejects an invalid parameter with a 400 and a field-level envelope', async () => {
    const response = await fetch(`${baseUrl}/api/users?sortField=salary`);
    const body = (await response.json()) as { error: { code: string; details?: unknown } };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('BAD_REQUEST');
    expect(body.error.details).toHaveProperty('sortField');
  });

  it('rejects a tampered cursor with a 400 on the cursor field', async () => {
    const response = await fetch(`${baseUrl}/api/users?cursor=not-a-real-cursor`);
    const body = (await response.json()) as { error: { details?: unknown } };

    expect(response.status).toBe(400);
    expect(body.error.details).toHaveProperty('cursor');
  });

  it('rejects a cursor reused with a different sort', async () => {
    const { body } = await getUsers('?sortField=age&limit=10');
    const response = await fetch(
      `${baseUrl}/api/users?sortField=last_name&cursor=${body.pagination.nextCursor}`,
    );

    expect(response.status).toBe(400);
  });

  it('rejects the retired page parameter', async () => {
    const response = await fetch(`${baseUrl}/api/users?page=2`);
    expect(response.status).toBe(400);
  });

  it('funnels unmatched routes into the same envelope', async () => {
    const response = await fetch(`${baseUrl}/api/nothing-here`);
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('answers the health check', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok' });
  });
});
