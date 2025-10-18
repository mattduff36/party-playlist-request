import { assertOk } from './helpers/browser';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

describe('Link crawl smoke', () => {
  it('home reachable', async () => {
    await assertOk(BASE_URL);
  });
});


