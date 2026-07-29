/**
 * Query-parameter serialisation for the HTTP client.
 *
 * Kept in its own module — with no `import.meta.env` dependency — so it can be
 * exercised outside a Vite bundle. It is the highest-risk piece of the API
 * layer: get it wrong and filters silently stop reaching the server, with the
 * only symptom being "the counts look off".
 */

/**
 * Serialises parameters the way the API expects.
 *
 * Axios's default turns `{ hobbies: ['a','b'] }` into `hobbies[]=a&hobbies[]=b`.
 * The server's validator reads repeated *bare* keys, so arrays are emitted as
 * `hobbies=a&hobbies=b`.
 *
 * Empty values are dropped rather than sent blank: an unfiltered request should
 * be `?page=1&limit=50`, not a URL carrying seven empty parameters. `URLSearchParams`
 * handles percent-encoding, so values containing spaces or `&` are safe.
 */
export function serializeParams(params: Record<string, unknown>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;

    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry === undefined || entry === null || entry === '') continue;
        search.append(key, String(entry));
      }
      continue;
    }

    search.append(key, String(value));
  }

  return search.toString();
}
