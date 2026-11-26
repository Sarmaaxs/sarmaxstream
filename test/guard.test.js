import test from 'node:test';
import assert from 'node:assert/strict';
import { clientIp, rateLimit } from '../api/_guard.js';

function response() {
  return {
    headers: {}, statusCode: 200, body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('client IP prefers the platform real-IP header', () => {
  assert.equal(clientIp({ headers: { 'x-real-ip': '198.51.100.8', 'x-forwarded-for': '203.0.113.4' }, socket: {} }), '198.51.100.8');
  assert.equal(clientIp({ headers: { 'x-forwarded-for': '203.0.113.4, 10.0.0.1' }, socket: {} }), '203.0.113.4');
});

test('Vercel refuses to use an instance-local limiter when Redis is missing', async () => {
  const old = { vercel: process.env.VERCEL, url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN };
  process.env.VERCEL = '1';
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  try {
    const res = response();
    assert.equal(await rateLimit({ headers: { 'x-real-ip': '192.0.2.3' } }, res, { name: 'test', max: 1, windowMs: 60000 }), false);
    assert.equal(res.statusCode, 503);
    assert.equal(res.headers['Cache-Control'], 'no-store');
  } finally {
    if (old.vercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = old.vercel;
    if (old.url === undefined) delete process.env.UPSTASH_REDIS_REST_URL; else process.env.UPSTASH_REDIS_REST_URL = old.url;
    if (old.token === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN; else process.env.UPSTASH_REDIS_REST_TOKEN = old.token;
  }
});

test('Upstash counter blocks requests after the configured limit', async () => {
  const old = { vercel: process.env.VERCEL, url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN, fetch: globalThis.fetch };
  process.env.VERCEL = '1';
  process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  let count = 0;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ result: [++count, 58] }) });
  try {
    const req = { headers: { 'x-real-ip': '192.0.2.9' } };
    const first = response();
    assert.equal(await rateLimit(req, first, { name: 'music', max: 1, windowMs: 60000 }), true);
    const second = response();
    assert.equal(await rateLimit(req, second, { name: 'music', max: 1, windowMs: 60000 }), false);
    assert.equal(second.statusCode, 429);
    assert.equal(second.headers['Retry-After'], '58');
  } finally {
    globalThis.fetch = old.fetch;
    if (old.vercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = old.vercel;
    if (old.url === undefined) delete process.env.UPSTASH_REDIS_REST_URL; else process.env.UPSTASH_REDIS_REST_URL = old.url;
    if (old.token === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN; else process.env.UPSTASH_REDIS_REST_TOKEN = old.token;
  }
});
