/**
 * App base URL resolution for email / absolute links
 */

describe('getAppBaseUrl', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  it('prefers NEXT_PUBLIC_APP_URL and strips trailing slashes', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://partyplaylist.co.uk/';
    delete process.env.APP_URL;
    delete process.env.VERCEL_URL;

    const { getAppBaseUrl } = await import('@/lib/app-url');
    expect(getAppBaseUrl()).toBe('https://partyplaylist.co.uk');
  });

  it('falls back to https://VERCEL_URL when public URL is unset', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;
    process.env.VERCEL_URL = 'my-app.vercel.app';

    const { getAppBaseUrl } = await import('@/lib/app-url');
    expect(getAppBaseUrl()).toBe('https://my-app.vercel.app');
  });

  it('defaults to localhost when nothing is configured', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;
    delete process.env.VERCEL_URL;

    const { getAppBaseUrl } = await import('@/lib/app-url');
    expect(getAppBaseUrl()).toBe('http://localhost:3000');
  });
});
