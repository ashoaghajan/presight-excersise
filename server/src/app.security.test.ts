/**
 * HTTP-level tests for the security middleware: helmet headers, the `/api`
 * rate limit (including IP-spoofing resistance) and the JSON body limit.
 *
 * Each test builds its own app, so every rate-limit counter starts at zero,
 * and injects a tiny limit through `AppOptions` instead of sending hundreds of
 * requests. The service is a fake: nothing here is about users or SQLite.
 */

import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import type { ApiErrorBody, UsersResponse } from '@presight/shared';

import { createApp, type AppOptions } from './app';
import type { UserService } from './services';

const fakeUserService: UserService = {
  getUsers: (): UsersResponse => ({
    users: [],
    pagination: { page: 1, limit: 50, total: 0, totalPages: 0, hasMore: false },
    hobbies: [],
    nationalities: [],
  }),
};

let server: Server | undefined;

async function start(options: Partial<AppOptions> = {}): Promise<string> {
  const app = createApp({ userService: fakeUserService }, options);
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

describe('security headers (helmet)', () => {
  it('sets the hardening headers on API responses', async () => {
    const res = await fetch(`${await start()}/api/users`);

    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(res.headers.get('strict-transport-security')).toMatch(/max-age=\d+/);
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
  });

  it('does not advertise the framework', async () => {
    const res = await fetch(`${await start()}/api/users`);

    expect(res.headers.get('x-powered-by')).toBeNull();
  });

  it('also sets them on error responses', async () => {
    const res = await fetch(`${await start()}/api/does-not-exist`);

    expect(res.status).toBe(404);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
});

describe('rate limiting on /api', () => {
  it('allows requests up to the limit, then answers 429 in the error envelope', async () => {
    const baseUrl = await start({ rateLimit: { windowMs: 60_000, max: 3 } });

    const statuses = [];
    for (let i = 0; i < 3; i++) statuses.push((await fetch(`${baseUrl}/api/users`)).status);
    const limited = await fetch(`${baseUrl}/api/users`);

    expect(statuses).toEqual([200, 200, 200]);
    expect(limited.status).toBe(429);
    expect(((await limited.json()) as ApiErrorBody).error.code).toBe('RATE_LIMITED');
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('tells clients their quota via standard RateLimit headers', async () => {
    const res = await fetch(
      `${await start({ rateLimit: { windowMs: 60_000, max: 3 } })}/api/users`,
    );

    expect(res.headers.get('ratelimit-policy')).toContain('q=3');
    expect(res.headers.get('ratelimit')).toContain('r=2');
  });

  it('never limits the health check', async () => {
    const baseUrl = await start({ rateLimit: { windowMs: 60_000, max: 1 } });

    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push((await fetch(`${baseUrl}/api/health`)).status);

    expect(statuses).toEqual([200, 200, 200, 200, 200]);
  });

  it('cannot be dodged by spoofing X-Forwarded-For', async () => {
    // With one trusted hop, Express takes the client IP from the entry nginx
    // appends (the last one), not from whatever the client wrote before it.
    const baseUrl = await start({ trustProxyHops: 1, rateLimit: { windowMs: 60_000, max: 2 } });
    const asClient = (spoofed: string) =>
      fetch(`${baseUrl}/api/users`, {
        headers: { 'X-Forwarded-For': `${spoofed}, 203.0.113.7` },
      });

    expect((await asClient('1.1.1.1')).status).toBe(200);
    expect((await asClient('2.2.2.2')).status).toBe(200);
    expect((await asClient('3.3.3.3')).status).toBe(429);
  });
});

describe('JSON body size limit', () => {
  const post = (baseUrl: string, body: string) =>
    fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

  it('rejects a body over the limit with 413 in the error envelope', async () => {
    const baseUrl = await start({ jsonBodyLimit: '1kb' });

    const res = await post(baseUrl, JSON.stringify({ data: 'x'.repeat(2_000) }));

    expect(res.status).toBe(413);
    expect(((await res.json()) as ApiErrorBody).error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('lets a body under the limit through to routing', async () => {
    const baseUrl = await start({ jsonBodyLimit: '1kb' });

    // No POST route exists, so getting past the parser means a 404.
    const res = await post(baseUrl, JSON.stringify({ data: 'small' }));

    expect(res.status).toBe(404);
  });

  it('answers malformed JSON with 400, not 500', async () => {
    const res = await post(await start(), '{"broken": ');

    expect(res.status).toBe(400);
    expect(((await res.json()) as ApiErrorBody).error.code).toBe('BAD_REQUEST');
  });
});
