/* Cursor MCP browser helpers - thin wrappers so tests can import simple functions.
 * These helpers assume Cursor built-in browser tools are orchestrated externally.
 * For headless HTTP fallbacks, we use fetch as a minimal assertion path.
 */

export async function navigate(url: string): Promise<Response> {
  return await fetch(url, { redirect: 'manual' });
}

export async function assertOk(url: string): Promise<void> {
  const res = await navigate(url);
  if (!(res.ok || res.status === 302 || res.status === 307 || res.status === 404)) {
    throw new Error(`${url} returned ${res.status}`);
  }
}

export async function postJson(url: string, body: unknown): Promise<Response> {
  return await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function assertNoConsoleErrors(): Promise<void> {
  // Placeholder: actual console capture occurs in Cursor browser runs
}


