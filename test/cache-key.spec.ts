import { CacheService } from '../src/cache/cache.service';

describe('CacheService', () => {
  it('canonicalizes object key order before hashing', () => {
    const service = new CacheService();

    expect(service.key({ b: 2, a: { d: 4, c: 3 } })).toBe(
      service.key({ a: { c: 3, d: 4 }, b: 2 }),
    );
  });

  it('produces a namespaced sha256 key', () => {
    expect(new CacheService().key({ a: 1 })).toMatch(/^llm:cache:[a-f0-9]{64}$/);
  });
});